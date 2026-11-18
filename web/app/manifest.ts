import type { MetadataRoute } from "next";

// Lets the web app install to an iPhone or Android home screen and open full screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pot",
    short_name: "Pot",
    description: "Chip in together. Nobody is in until their money is locked in.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f2ec",
    theme_color: "#f6f2ec",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
