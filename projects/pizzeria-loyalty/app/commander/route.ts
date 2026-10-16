import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Redirige vers la commande en ligne (lien modifiable dans Admin → Carte à tampons). */
export async function GET(req: Request) {
  const { orderUrl } = await getSettings();
  return NextResponse.redirect(orderUrl || new URL("/", req.url), 307);
}
