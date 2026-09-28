import { requireAdminPage } from "@/lib/auth";
import { getSettings, NOTIFICATION_INFO } from "@/lib/settings";
import { ProgramForm } from "./ProgramForm";

export const metadata = { title: "Carte à tampons" };

export default async function Page() {
  await requireAdminPage();
  return <ProgramForm initial={await getSettings()} info={NOTIFICATION_INFO} />;
}
