# Mosaic crossfilter with DataFusion-WASM and Zarr

Client-side forecast explorer. ECMWF IFS ENS temperature is streamed from a
public Zarr store ([dynamical.org](https://dynamical.org)) with zarrita,
queried with DataFusion-WASM through a Mosaic crossfilter and rendered with
[@developmentseed/deck.gl-zarr](https://github.com/developmentseed/deck.gl-raster).

## Run

Requires a patched build of datafusion-wasm from
[dzole0311/datafusion-wasm-bindings](https://github.com/dzole0311/datafusion-wasm-bindings),
cloned next to this folder and built with wasm-pack.

```bash
npm install   # expects ../datafusion-wasm-bindings/pkg next to this folder
npm run dev
```
