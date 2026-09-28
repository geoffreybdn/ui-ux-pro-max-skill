"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell, Crown, Flame, KeyRound, Stamp, LayoutDashboard, LogOut, Menu, QrCode, ScanLine, Search,
  ShieldCheck, Upload, Users, WalletCards, X,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, admin: true },
  { href: "/admin/scanner", label: "Scanner", icon: ScanLine, admin: false },
  { href: "/admin/clients", label: "Clients", icon: Users, admin: true },
  { href: "/admin/programme", label: "Carte à tampons", icon: Stamp, admin: true },
  { href: "/admin/promotions", label: "Campagnes", icon: Flame, admin: true },
  { href: "/admin/notifications", label: "Notifications push", icon: Bell, admin: true },
  { href: "/admin/affiche", label: "QR d'inscription", icon: QrCode, admin: true },
  { href: "/admin/codes", label: "Codes promo", icon: KeyRound, admin: true },
  { href: "/admin/import", label: "Import CSV", icon: Upload, admin: true },
  { href: "/admin/equipe", label: "Utilisateurs", icon: ShieldCheck, admin: true },
];

export function AdminShell({
  user,
  pizzeriaName,
  children,
}: {
  user: { name: string; role: "admin" | "staff" | "customer" };
  pizzeriaName: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isAdmin = user.role === "admin";
  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  useEffect(() => setOpen(false), [path]);

  return (
    <div className="admin-shell">
      <aside className={`sidebar ${open ? "is-open" : ""}`} aria-label="Navigation administration">
        <div className="sidebar-brand">
          <Crown size={30} className="sidebar-crown" aria-hidden />
          <div>
            <div className="sidebar-name">{pizzeriaName}</div>
            <div className="sidebar-sub">Programme de fidélité</div>
          </div>
          <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Fermer le menu"><X size={20} /></button>
        </div>
        <nav className="sidebar-nav">
          {NAV.filter((l) => isAdmin || !l.admin).map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
              <Icon size={20} /> {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <Link href="/carte"><WalletCards size={20} /> Ma carte</Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit"><LogOut size={20} /> Déconnexion</button>
          </form>
        </div>
      </aside>
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <div className="admin-main">
        <header className="admin-header">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Ouvrir le menu"><Menu size={22} /></button>
          {isAdmin ? (
            <form
              className="admin-search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                const q = String(new FormData(e.currentTarget).get("q") || "").trim();
                router.push(`/admin/clients${q ? `?q=${encodeURIComponent(q)}` : ""}`);
              }}
            >
              <Search size={18} aria-hidden />
              <input name="q" placeholder="Rechercher un client (nom, e-mail, téléphone, code carte)…" aria-label="Rechercher un client" />
            </form>
          ) : (
            <div style={{ flex: 1 }} />
          )}
          {isAdmin && (
            <Link href="/admin/notifications" className="icon-btn" aria-label="Notifications"><Bell size={22} /></Link>
          )}
          <div className="user-chip">
            <span className="avatar" aria-hidden>{initials}</span>
            <span className="user-chip-text">
              <b>{user.name}</b>
              <small>{isAdmin ? "Administrateur" : "Équipe"}</small>
            </span>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
