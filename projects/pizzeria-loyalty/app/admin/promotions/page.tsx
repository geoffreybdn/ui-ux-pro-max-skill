import { requireAdminPage } from "@/lib/auth";
import { Promotions } from "./Promotions";

export const metadata = { title: "Promotions" };

export default async function Page() {
  await requireAdminPage();
  return <Promotions />;
}
