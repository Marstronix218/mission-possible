import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MISSION: POSSIBLE — Code Blue",
    short_name: "Mission Possible",
    description:
      "Design a satellite, simulate its mission, and compare what it sees with real NASA Earth observations.",
    start_url: "/map",
    scope: "/",
    display: "standalone",
    background_color: "#07121b",
    theme_color: "#0b1838",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/brand/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
