import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

/*
 * StrictMode is intentionally not used: its double-invoked effects would
 * boot the WebGL context and the multi-megabyte Zarr fetch twice in
 * development.
 */
createRoot(document.getElementById("root")!).render(<App />);
