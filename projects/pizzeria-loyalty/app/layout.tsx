import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { pizzeriaName } = await getSettings();
  return {
    title: { default: `${pizzeriaName} — Fidélité`, template: `%s · ${pizzeriaName}` },
    description: "Cumulez des tampons à chaque visite et profitez de nos promotions.",
    icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
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
