import { NextResponse } from "next/server";
import { announceStartedPromotions } from "@/lib/loyalty";

/** Passage supplémentaire en fin de journée pour annoncer les promos lancées l'après-midi (voir vercel.json). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return NextResponse.json({ promotions: await announceStartedPromotions() });
}
