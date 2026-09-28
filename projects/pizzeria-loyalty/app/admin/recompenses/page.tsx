import { requireAdminPage } from "@/lib/auth";
import { Rewards } from "./Rewards";

export const metadata = { title: "Récompenses" };

export default async function Page() {
  await requireAdminPage();
  return <Rewards />;
}
