import { requireAdminPage } from "@/lib/auth";
import { Clients } from "./Clients";

export const metadata = { title: "Clients" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPage();
  const { q } = await searchParams;
  return <Clients key={q ?? ""} initialQuery={q ?? ""} />;
}
