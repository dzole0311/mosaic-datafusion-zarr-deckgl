import { useCallback, useEffect, useRef, useState } from "react";
import type { Selection } from "@uwdata/mosaic-core";
import type { ExprNode } from "@uwdata/mosaic-sql";
import type { Table } from "@uwdata/flechette";
import { CELL_COUNT } from "../lab/types";
import type { MapView } from "../lab/map-view";
import type { Lab } from "./use-forecast-lab";

const PLAYBACK_STEP_MS = 450;

export type ForecastSession = {
  leadIndex: number;
  selectedCount: number;
  meanTemp: number | null;
  playing: boolean;
  requestLead: (index: number) => void;
  togglePlay: () => void;
  reset: () => void;
};

function predicateSql(selection: Selection) {
  const predicate = selection.predicate(undefined, true) as
    | string
    | ExprNode
    | Array<string | ExprNode>
    | undefined;
  if (!predicate || (Array.isArray(predicate) && predicate.length === 0)) return "";
  if (Array.isArray(predicate)) return predicate.map(String).filter(Boolean).join(" AND ");
  return String(predicate);
}

/**
 * Drives the selection loop and the forecast lead. The SQL engine is the
 * source of truth: any Mosaic predicate (chart brushes, category toggles,
 * the map geo circle) becomes one id query whose Arrow result fills a
 * reused mask buffer, avoiding per-cell JS objects on the hot path.
 */
export function useForecastSession(lab: Lab, map: MapView | null, cubeVersion = 0): ForecastSession {
  const [leadIndex, setLeadIndex] = useState(0);
  const [selectedCount, setSelectedCount] = useState(0);
  const [meanTemp, setMeanTemp] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const mapRef = useRef(map);
  mapRef.current = map;
  const leadRef = useRef(0);
  const selectionSeq = useRef(0);
  const selectionMask = useRef(new Uint8Array(CELL_COUNT));
  const pendingLead = useRef<number | null>(null);
  const leadRunning = useRef(false);

  const refreshSelection = useCallback(async () => {
    const seq = ++selectionSeq.current;
    const where = predicateSql(lab.selection);
    const table = (await lab.df.query({
      type: "arrow",
      sql: where
        ? `SELECT id FROM cells_current_lead WHERE ${where}`
        : "SELECT id FROM cells_current_lead",
    })) as Table;
    if (seq !== selectionSeq.current) return;
    const mask = selectionMask.current;
    mask.fill(0);
    let count = 0;
    const ids = table.getChild("id")?.toArray() as ArrayLike<number> | undefined;
    for (let i = 0, n = ids?.length ?? 0; i < n; i += 1) {
      const id = Number(ids![i]);
      if (id >= 0 && id < CELL_COUNT && !mask[id]) {
        mask[id] = 1;
        count += 1;
      }
    }
    mapRef.current?.setMask(mask);
    setSelectedCount(count);

    const rows = (await lab.df.query({
      type: "json",
      sql: `SELECT avg(value) AS mean_temp FROM cells_current_lead${where ? ` WHERE ${where}` : ""}`,
    })) as Array<{ mean_temp: number | null }>;
    if (seq !== selectionSeq.current) return;
    const mean = rows[0]?.mean_temp;
    setMeanTemp(mean == null ? null : Number(mean));
  }, [lab]);

  /**
   * Rematerializes the cells_current_lead table for the new integer lead,
   * then refreshes
   * charts, mask, and readouts. Coalesces to the latest lead if the slider
   * moves faster than the table swap.
   */
  const runLeadLoop = useCallback(async () => {
    leadRunning.current = true;
    try {
      while (pendingLead.current !== null) {
        const lead = pendingLead.current;
        pendingLead.current = null;
        await lab.df.setLead(lead);
        if (pendingLead.current !== null) continue;
        lab.coordinator.clients.forEach((client) => {
          if (client.enabled) void client.requestQuery();
        });
        await refreshSelection();
      }
    } catch (error) {
      console.error("DataFusion lead swap failed", error);
    } finally {
      leadRunning.current = false;
    }
  }, [lab, refreshSelection]);

  const requestLead = useCallback(
    (index: number) => {
      leadRef.current = index;
      setLeadIndex(index);
      mapRef.current?.setLeadIndex(index);
      pendingLead.current = index;
      if (!leadRunning.current) void runLeadLoop();
    },
    [runLeadLoop],
  );

  /**
   * Any selection change (chart brush, category toggle, geo circle) re-runs
   * the mask query; the initial run selects everything. cubeVersion is
   * incremented as streamed Zarr chunks land, so the mask and readouts grow
   * with the data.
   */
  useEffect(() => {
    const onValue = () => void refreshSelection();
    lab.selection.addEventListener("value", onValue);
    void refreshSelection();
    return () => lab.selection.removeEventListener("value", onValue);
  }, [lab, refreshSelection, cubeVersion]);

  useEffect(() => {
    if (!map) return;
    map.setLeadIndex(leadRef.current);
    void refreshSelection();
  }, [map, refreshSelection]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      requestLead((leadRef.current + 1) % lab.cube.leadCount);
    }, PLAYBACK_STEP_MS);
    return () => window.clearInterval(timer);
  }, [playing, lab, requestLead]);

  const togglePlay = useCallback(() => setPlaying((current) => !current), []);

  const reset = useCallback(() => {
    setPlaying(false);
    lab.selection.reset();
    requestLead(0);
  }, [lab, requestLead]);

  return { leadIndex, selectedCount, meanTemp, playing, requestLead, togglePlay, reset };
}
