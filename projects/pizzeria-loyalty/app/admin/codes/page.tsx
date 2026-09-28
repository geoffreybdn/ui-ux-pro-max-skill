import { requireAdminPage } from "@/lib/auth";
import { Codes } from "./Codes";

export const metadata = { title: "Codes d'inscription" };

export default async function Page() {
  await requireAdminPage();
  return <Codes />;
}
