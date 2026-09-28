import Link from "next/link";
import { LogOut } from "lucide-react";
import { PIZZERIA_NAME } from "@/lib/config";

export function TopBar({ loggedIn, children }: { loggedIn?: boolean; children?: React.ReactNode }) {
  return (
    <header className="topbar">
      <div className="container">
        <Link href="/" className="brand">
          <img src="/icon.svg" alt="" width={32} height={32} style={{ flex: "none" }} />
          {PIZZERIA_NAME}
        </Link>
        <div className="row">
          {children}
          {loggedIn && (
            <form action="/api/auth/logout" method="post">
              <button className="btn btn-ghost btn-sm" aria-label="Se déconnecter">
                <LogOut size={18} /> <span className="small hide-mobile">Sortir</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
