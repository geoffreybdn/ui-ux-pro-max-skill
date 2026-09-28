import { NextResponse } from "next/server";
import { announceStartedPromotions, remindInactiveCustomers } from "@/lib/loyalty";
import { INACTIVITY_REMINDER_DAYS } from "@/lib/config";

export const maxDuration = 60;

/** Appelé chaque jour par Vercel Cron (voir vercel.json). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const promotions = await announceStartedPromotions();
  const reminders = await remindInactiveCustomers(INACTIVITY_REMINDER_DAYS);
  return NextResponse.json({ promotions, reminders });
}
