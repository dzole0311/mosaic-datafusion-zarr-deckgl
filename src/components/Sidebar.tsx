import type { ReactNode } from "react";
import { CELL_COUNT } from "../lab/types";
import { HOT_THRESHOLD_C, type ForecastSession } from "../hooks/use-forecast-session";
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
            <p className="status">
              {status && <span className="spinner" aria-hidden="true" />}
              {status}
            </p>
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

function formatAreaKm2(km2: number | null) {
  if (km2 == null) return "-";
  if (km2 >= 1e6) return `${(km2 / 1e6).toFixed(2)}M km²`;
  return `${Math.round(km2 / 1e3)}k km²`;
}

export function ForecastControls({
  session,
  brush,
  leadCount,
  loading,
}: {
  session: ForecastSession;
  brush: HoverBrush;
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
          <dd>{session.forecastTimeMs == null ? "-" : formatUtc(session.forecastTimeMs)}</dd>
        </div>
        <div>
          <dt>Mean temp</dt>
          <dd>{session.meanTemp == null ? "-" : `${session.meanTemp.toFixed(1)} °C`}</dd>
        </div>
        <div>
          <dt>Selected cells</dt>
          <dd>
            {session.selectedCount}/{CELL_COUNT}
          </dd>
        </div>
        <div>
          <dt>Selected area</dt>
          <dd>{formatAreaKm2(session.selectedAreaKm2)}</dd>
        </div>
        <div>
          <dt>Area ≥ {HOT_THRESHOLD_C} °C</dt>
          <dd>
            {formatAreaKm2(session.hotAreaKm2)}
            {session.hotAreaKm2 != null && session.selectedAreaKm2 ? (
              <span className="metric-share">
                {((100 * session.hotAreaKm2) / session.selectedAreaKm2).toFixed(0)}%
              </span>
            ) : null}
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
