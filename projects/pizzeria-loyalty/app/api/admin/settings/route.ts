import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth";
import { handle } from "@/lib/api";
import { getSettings, saveSettings } from "@/lib/settings";

export const GET = handle(async () => {
  await assertRole(["admin"]);
  return NextResponse.json({ settings: await getSettings() });
});

export const PUT = handle(async (req: Request) => {
  await assertRole(["admin"]);
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ settings: await saveSettings(body.settings) });
});
