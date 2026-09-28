import { NextResponse } from "next/server";
import { announceStartedPromotions, celebrateBirthdays, remindInactiveCustomers } from "@/lib/loyalty";

export const maxDuration = 60;

/** Appelé chaque jour par Vercel Cron (voir vercel.json) : promos, anniversaires, relances. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const promotions = await announceStartedPromotions();
  const birthdays = await celebrateBirthdays();
  const reminders = await remindInactiveCustomers();
  return NextResponse.json({ promotions, birthdays, reminders });
}
