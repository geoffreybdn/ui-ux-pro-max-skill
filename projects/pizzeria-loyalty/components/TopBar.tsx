import Link from "next/link";
import { LogOut } from "lucide-react";
import { getSettings } from "@/lib/settings";

export async function TopBar({ loggedIn, children }: { loggedIn?: boolean; children?: React.ReactNode }) {
  const { pizzeriaName } = await getSettings();
  return (
    <header className="topbar">
      <div className="container">
        <Link href="/" className="brand">
          <img src="/icon.svg" alt="" width={32} height={32} style={{ flex: "none" }} />
          {pizzeriaName}
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
