import { useEffect, useState } from "react";
import { useForecastLab, type Lab } from "./hooks/use-forecast-lab";
import { useForecastSession } from "./hooks/use-forecast-session";
import { useHoverBrush } from "./hooks/use-hover-brush";
import type { MapView } from "./lab/map-view";
import { LoadingOverlay, MapPane, MapShell } from "./components/MapPane";
import { ChartCard, ChartSpinner, MosaicCharts } from "./components/MosaicCharts";
import { ForecastControls, SidebarFrame } from "./components/Sidebar";

export function App() {
  const { boot, cubeVersion, progress } = useForecastLab();

  if (boot.phase !== "ready") {
    return (
      <div className="map-app" aria-busy={boot.phase === "loading"}>
        <MapShell>{boot.phase === "loading" && <LoadingOverlay message={boot.message} />}</MapShell>
        <SidebarFrame status={boot.message}>
          <ChartCard title="Temperature Distribution">
            <ChartSpinner />
          </ChartCard>
          <ChartCard title="Temperature Classes">
            <ChartSpinner />
          </ChartCard>
          <ChartCard title="Latitudinal Gradient">
            <ChartSpinner />
          </ChartCard>
        </SidebarFrame>
      </div>
    );
  }

  return <ForecastApp lab={boot.lab} cubeVersion={cubeVersion} progress={progress} />;
}

function ForecastApp({
  lab,
  cubeVersion,
  progress,
}: {
  lab: Lab;
  cubeVersion: number;
  progress: { loadedChunks: number; totalChunks: number };
}) {
  const [map, setMap] = useState<MapView | null>(null);
  const session = useForecastSession(lab, map, cubeVersion);
  const brush = useHoverBrush(lab.selection, map);
  const streaming = progress.loadedChunks < progress.totalChunks;

  useEffect(() => {
    if (cubeVersion > 0) map?.refreshCube();
  }, [map, cubeVersion]);

  return (
    <div className="map-app">
      <MapPane cube={lab.cube.temperature} brush={brush} onMap={setMap} />
      <SidebarFrame
        status={
          streaming
            ? `Streaming ECMWF chunks ${progress.loadedChunks}/${progress.totalChunks}`
            : ""
        }
        onReset={session.reset}
        controls={
          <ForecastControls
            session={session}
            brush={brush}
            validTimeMs={lab.cube.validTimeMs}
            leadCount={lab.cube.leadCount}
          />
        }
      >
        <MosaicCharts coordinator={lab.coordinator} selection={lab.selection} streaming={streaming} />
      </SidebarFrame>
    </div>
  );
}
