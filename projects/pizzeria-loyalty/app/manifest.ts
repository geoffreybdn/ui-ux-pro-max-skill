import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { pizzeriaName } = await getSettings();
  return {
    name: `${pizzeriaName} — Fidélité`,
    short_name: pizzeriaName,
    description: "Votre carte à tampons et nos promos.",
    id: "/carte",
    start_url: "/carte",
    scope: "/",
    orientation: "portrait",
    lang: "fr",
    display: "standalone",
    background_color: "#f5ecd8",
    theme_color: "#dc2626",
    icons: [
      { src: "/app-icons/alabella-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icons/alabella-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icons/alabella-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Ma carte", url: "/carte", icons: [{ src: "/app-icons/alabella-192.png", sizes: "192x192" }] },
      { name: "Scanner (équipe)", url: "/admin/scanner", icons: [{ src: "/app-icons/alabella-192.png", sizes: "192x192" }] },
    ],
  };
}
