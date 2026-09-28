import type { MetadataRoute } from "next";
import { PIZZERIA_NAME } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${PIZZERIA_NAME} — Fidélité`,
    short_name: PIZZERIA_NAME,
    description: "Votre carte de fidélité, vos points et nos promos.",
    start_url: "/carte",
    display: "standalone",
    background_color: "#fef2f2",
    theme_color: "#dc2626",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
