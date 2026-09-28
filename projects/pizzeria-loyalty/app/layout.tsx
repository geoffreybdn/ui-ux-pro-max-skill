import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PIZZERIA_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: { default: `${PIZZERIA_NAME} — Fidélité`, template: `%s · ${PIZZERIA_NAME}` },
  description: "Cumulez des points à chaque pizza et profitez de nos promotions.",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: PIZZERIA_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#dc2626", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
