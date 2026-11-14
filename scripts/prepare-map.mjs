import { mkdir, copyFile } from "node:fs/promises";
await mkdir(new URL("../public/maps/", import.meta.url), { recursive: true });
await copyFile(
  new URL(
    "../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
    import.meta.url,
  ),
  new URL("../public/maps/maplibre-worker.mjs", import.meta.url),
);
