import { requireAdminPage } from "@/lib/auth";
import { Clients } from "./Clients";

export const metadata = { title: "Clients" };

export default async function Page() {
  await requireAdminPage();
  return <Clients />;
}
