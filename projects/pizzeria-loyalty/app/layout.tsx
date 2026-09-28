import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { pizzeriaName } = await getSettings();
  return {
    title: { default: `${pizzeriaName} — Fidélité`, template: `%s · ${pizzeriaName}` },
    description: "Cumulez des tampons à chaque visite et profitez de nos promotions.",
    icons: {
      icon: [{ url: "/app-icons/alabella-favicon-64.png", type: "image/png", sizes: "64x64" }],
      apple: [{ url: "/app-icons/alabella-apple-180.png", sizes: "180x180" }],
    },
    appleWebApp: { capable: true, title: pizzeriaName, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = { themeColor: "#dc2626", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
