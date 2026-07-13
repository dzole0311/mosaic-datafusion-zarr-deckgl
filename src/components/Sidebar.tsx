import type { ReactNode } from "react";
import { CELL_COUNT } from "../lab/types";
import type { ForecastSession } from "../hooks/use-forecast-session";
import type { HoverBrush } from "../hooks/use-hover-brush";

/**
 * Full sidebar chrome: header card with status and reset plus optional
 * forecast controls, followed by the chart cards passed as children.
 */
export function SidebarFrame({
  status,
  onReset,
  controls,
  children,
}: {
  status: string;
  onReset?: () => void;
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <aside className="control-panel">
      <section className="forecast-control">
        <div className="control-head">
          <div>
            <h1>ECMWF IFS ENS</h1>
            <p className="status">{status}</p>
          </div>
          <button type="button" className="reset-button" onClick={onReset} disabled={!onReset}>
            Reset
          </button>
        </div>
        {controls}
      </section>
      {children}
    </aside>
  );
}

function formatUtc(ms: number) {
  const date = new Date(ms);
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${month} ${date.getUTCDate()} ${String(date.getUTCHours()).padStart(2, "0")}Z`;
}

export function ForecastControls({
  session,
  brush,
  validTimeMs,
  leadCount,
  loading,
}: {
  session: ForecastSession;
  brush: HoverBrush;
  validTimeMs: number[];
  leadCount: number;
  loading?: boolean;
}) {
  const brushReadout = !brush.enabled
    ? "pan mode"
    : brush.active
      ? `${session.selectedCount} cells · ${brush.radiusKm} km`
      : `${brush.radiusKm} km radius`;

  return (
    <>
      <dl className="metric-grid">
        <div>
          <dt>Forecast time</dt>
          <dd>{formatUtc(validTimeMs[session.leadIndex] ?? 0)}</dd>
        </div>
        <div>
          <dt>Mean temp</dt>
          <dd>{session.meanTemp == null ? "-" : `${session.meanTemp.toFixed(1)} °C`}</dd>
        </div>
        <div>
          <dt>Selected cells</dt>
          <dd>
            {session.selectedCount} / {CELL_COUNT}
          </dd>
        </div>
      </dl>

      <div className="time-control">
        <button
          type="button"
          className="icon-button"
          onClick={session.togglePlay}
          disabled={loading}
          aria-label={session.playing ? "Pause forecast" : "Play forecast"}
        >
          {session.playing ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          min={0}
          max={leadCount - 1}
          step={1}
          value={session.leadIndex}
          disabled={loading}
          onChange={(event) => session.requestLead(Number(event.target.value))}
        />
      </div>

      <div className="map-brush-control">
        <button
          type="button"
          className={`tool-toggle${brush.enabled ? " active" : ""}`}
          aria-pressed={brush.enabled}
          onClick={brush.toggle}
        >
          Hover Brush
        </button>
        <input
          type="range"
          min={25}
          max={350}
          step={5}
          value={brush.radiusKm}
          disabled={!brush.enabled}
          aria-label="Hover brush radius"
          onChange={(event) => brush.setRadiusKm(Number(event.target.value))}
        />
        <span className="brush-readout">{brushReadout}</span>
      </div>
    </>
  );
}
