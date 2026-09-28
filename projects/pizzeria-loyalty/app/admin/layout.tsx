import { TopBar } from "@/components/TopBar";
import { AdminNav } from "@/components/AdminNav";
import { requireStaffPage } from "@/lib/auth";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage();
  return (
    <>
      <TopBar loggedIn>
        <Link href="/carte" className="btn btn-sm">Ma carte</Link>
      </TopBar>
      <div className="container">
        <AdminNav isAdmin={user.role === "admin"} />
      </div>
      <main className="container page">{children}</main>
    </>
  );
}
