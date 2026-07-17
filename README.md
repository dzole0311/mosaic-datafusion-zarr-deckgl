# Mosaic crossfilter with DataFusion-WASM and Zarr

Client-side forecast explorer. ECMWF IFS ENS temperature is streamed from a
public Zarr store ([dynamical.org](https://dynamical.org)) with zarrita,
queried with DataFusion-WASM through a Mosaic crossfilter and rendered with
[@developmentseed/deck.gl-zarr](https://github.com/developmentseed/deck.gl-raster).

The main reason this demo exists is to see what it takes to run Mosaic on
DataFusion instead of DuckDB in the browser. Mosaic assumes DuckDB in several
places, so swapping the engine means replacing those pieces one by one.

## Run

Requires a patched build of datafusion-wasm from
[dzole0311/datafusion-wasm-bindings](https://github.com/dzole0311/datafusion-wasm-bindings),
cloned next to this folder and built with wasm-pack.

```bash
npm install   # expects ../datafusion-wasm-bindings/pkg next to this folder
npm run dev
```

## Data flow

### 1. Reading the Zarr store

We read only a central Europe bounding box in this showcase. The full grid would be far too
much for a browser tab and the querying we want to explore here (even the crop is sixty chunk fetches of
roughly 3 MB each).

### 2. Getting the data into DataFusion

We encode the cube with [flechette](https://github.com/uwdata/flechette) as an Arrow IPC table with columns `id`,
`time_index` and `temperature` and register it as `cells_all_leads`
(`src/lab/datafusion.ts`).

The Datafusion [bindings](https://github.com/dzole0311/datafusion-wasm-bindings) needed two patches here.
The published bindings only return query results as printed text or JSON,
so the fork adds `execute_ipc` which returns them as an Arrow IPC stream
that the charts can use directly. Also, when I tried `CREATE TABLE ... AS` it crashed with an error about a
missing Tokio runtime. So the patched fork
adds `register_ipc` and `materialize_table` which collect the result on
the current thread and register the batches as an
in-memory table.

### 3. The derived tables

We build two derived tables in SQL. `cells_lead0` unpacks the row id into x/y, lon/lat, cell area and a
temperature category. And the second one, called `cells_current_lead`, is what every chart / active client in the showcase
queries. It is rematerialized on each slider (we join the requested
lead onto `cells_lead0`). I have to revisit this, but was thinking to use a view here, but opted to materialize instead because
each interaction goes out into several queries so the join is done once
per lead change instead of once per query.

### 4. Connecting Mosaic

The `DataFusion` wrapper in the showcase repo is also used as the Mosaic connector, which only needs
a `query({ type, sql })` method. The crossfilter `Selection` is shared by
the chart brushes, the category toggle and the map radius circle.

I turned off Mosaic's pre-aggregation in the showcase. The
cache keys results on SQL text but the tables get rematerialized
underneath it, so it would have served stale rows after a chunk or lead
change. Pre-aggregation
builds its tables with `CREATE TABLE ... AS`, the same statement that
crashes the WASM build and this errors out with DataFusion. A fix I want to try is to intercept those statements in
the connector and route them through `materialize_table`, but long-term this ideally will be handled internally by Mosaic.

Mosaic also assumes DuckDB usage in various places. For example, it checks schemas with
`DESCRIBE` and expects DuckDB type names so the connector translates
DataFusion's answer (`Int32` to `INTEGER`, `Utf8` to `VARCHAR` etc).
Derived values are precomputed as plain columns during materialization so
the generated queries only touch standard SQL that DataFusion handles
as-is.

### 5. Applying selections to the map

Every selection change runs as one
`SELECT id FROM cells_current_lead WHERE ...` query
(`src/hooks/use-forecast-session.ts`). The ids fill a mask that is
uploaded as a GPU texture and a shader discards the unselected raster pixels,
so the map updates correctly. The same predicate feeds the mean
temperature and area readouts that exist in the sidebar.

Then, when the map is brushed using the "hover brush" option, we build a lon/lat
predicate (`src/lab/geo-filter.ts`) from the hover circle radius and it is published into the shared selection,
so the map filters the charts too.

### 6. Visualization and refreshing as chunks come in

The showcase uses [@developmentseed/deck.gl-zarr](https://github.com/developmentseed/deck.gl-raster) for visualization. Also, everything streams so the first chunk should appear on screen fast (time to first visualization is one 3 MB fetch instead of the whole crop). Each later
chunk re-registers `cells_all_leads`, rematerializes the views and
requeries the Mosaic clients, so the user sees more data in the charts as it arrives.
