import { requireAdminPage } from "@/lib/auth";
import { Notifications } from "./Notifications";

export const metadata = { title: "Notifications" };

export default async function Page() {
  await requireAdminPage();
  return <Notifications />;
}
