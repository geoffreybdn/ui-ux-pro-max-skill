import { requireAdminPage } from "@/lib/auth";
import { Team } from "./Team";

export const metadata = { title: "Équipe" };

export default async function Page() {
  const me = await requireAdminPage();
  return <Team meId={me.id} />;
}
