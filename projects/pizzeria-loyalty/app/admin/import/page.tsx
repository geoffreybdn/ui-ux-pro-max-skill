import { requireAdminPage } from "@/lib/auth";
import { Import } from "./Import";

export const metadata = { title: "Import CSV" };

export default async function Page() {
  await requireAdminPage();
  return <Import />;
}
