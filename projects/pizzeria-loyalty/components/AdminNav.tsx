"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, Flame, Gift, KeyRound, ScanLine, Upload, Users } from "lucide-react";

const LINKS = [
  { href: "/admin", label: "Tableau de bord", icon: BarChart3, admin: true },
  { href: "/admin/scanner", label: "Scanner", icon: ScanLine, admin: false },
  { href: "/admin/clients", label: "Clients", icon: Users, admin: true },
  { href: "/admin/promotions", label: "Promotions", icon: Flame, admin: true },
  { href: "/admin/codes", label: "Codes d'inscription", icon: KeyRound, admin: true },
  { href: "/admin/recompenses", label: "Récompenses", icon: Gift, admin: true },
  { href: "/admin/import", label: "Import CSV", icon: Upload, admin: true },
  { href: "/admin/notifications", label: "Notifications", icon: Bell, admin: true },
];

export function AdminNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  return (
    <nav className="admin-nav" aria-label="Administration">
      {LINKS.filter((l) => isAdmin || !l.admin).map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
          <Icon size={16} /> {label}
        </Link>
      ))}
    </nav>
  );
}
