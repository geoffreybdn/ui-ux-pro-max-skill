import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth";
import { handle, bad } from "@/lib/api";
import { adjustPoints, recordVisit, redeemReward, redeemStampCard, useCashback } from "@/lib/loyalty";

const toCents = (v: unknown) => Math.round(Number(String(v ?? 0).replace(",", ".")) * 100);

export const POST = handle(async (req: Request) => {
  const staff = await assertRole(["admin", "staff"]);
  const body = await req.json().catch(() => ({}));
  const customerId = Number(body.customerId);
  if (!customerId) bad("Client manquant");

  try {
    switch (body.action) {
      case "earn": {
        const amountCents = toCents(body.amount);
        const extraPoints = Math.trunc(Number(body.extraPoints || 0));
        if (!(amountCents >= 0) || amountCents > 100_000) bad("Montant invalide");
        if (!(extraPoints >= 0) || extraPoints > 1000) bad("Points bonus invalides");
        return NextResponse.json(await recordVisit({ customerId, amountCents, extraPoints, staffId: staff.id }));
      }
      case "redeem":
        return NextResponse.json(await redeemReward({ customerId, rewardId: Number(body.rewardId), staffId: staff.id }));
      case "stamps":
        return NextResponse.json(await redeemStampCard({ customerId, staffId: staff.id }));
      case "cashback": {
        const cents = toCents(body.amount);
        if (!(cents > 0) || cents > 100_000) bad("Montant invalide");
        return NextResponse.json(await useCashback({ customerId, cents, staffId: staff.id }));
      }
      case "adjust": {
        if (staff.role !== "admin") bad("Réservé aux administrateurs", 403);
        const points = Math.trunc(Number(body.points));
        if (!points) bad("Nombre de points invalide");
        return NextResponse.json(
          await adjustPoints({ customerId, points, staffId: staff.id, note: String(body.note || "Ajustement manuel") })
        );
      }
    }
  } catch (err) {
    if (err instanceof Error && err.constructor === Error) bad(err.message);
    throw err;
  }
  bad("Action inconnue");
});
