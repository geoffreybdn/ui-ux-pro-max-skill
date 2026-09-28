import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth";
import { handle, bad } from "@/lib/api";
import { broadcast } from "@/lib/push";

export const POST = handle(async (req: Request) => {
  await assertRole(["admin"]);
  const { title, body } = await req.json().catch(() => ({}));
  if (!String(title || "").trim() || !String(body || "").trim()) bad("Titre et message requis");
  const sent = await broadcast({ title: String(title).trim(), body: String(body).trim() }, "manual");
  return NextResponse.json({ sent });
});
