import { AdminShell } from "@/components/AdminShell";
import { requireStaffPage } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, settings] = await Promise.all([requireStaffPage(), getSettings()]);
  return (
    <AdminShell user={{ name: user.name, role: user.role }} pizzeriaName={settings.pizzeriaName}>
      {children}
    </AdminShell>
  );
}
