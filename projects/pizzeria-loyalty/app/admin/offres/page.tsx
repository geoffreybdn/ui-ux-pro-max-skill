import { requireAdminPage } from "@/lib/auth";
import { Offers } from "./Offers";

export const metadata = { title: "Codes promo" };

export default async function Page() {
  await requireAdminPage();
  return <Offers />;
}
