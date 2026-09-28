import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth";
import { handle, bad } from "@/lib/api";
import { recordVisit, redeemStampCard, removeStamps } from "@/lib/loyalty";

const MAX = 50;

export const POST = handle(async (req: Request) => {
  const staff = await assertRole(["admin", "staff"]);
  const body = await req.json().catch(() => ({}));
  const customerId = Number(body.customerId);
  if (!customerId) bad("Client manquant");
  const count = Math.trunc(Number(body.count));

  try {
    switch (body.action) {
      case "add": {
        if (!(count >= 1) || count > MAX) bad(`Nombre de tampons entre 1 et ${MAX}`);
        const amountCents = body.amount ? Math.round(Number(String(body.amount).replace(",", ".")) * 100) : 0;
        if (!(amountCents >= 0) || amountCents > 100_000) bad("Montant invalide");
        return NextResponse.json(await recordVisit({ customerId, count, amountCents, staffId: staff.id }));
      }
      case "remove": {
        if (!(count >= 1) || count > MAX) bad(`Nombre de tampons entre 1 et ${MAX}`);
        const note = String(body.note || "").trim().slice(0, 120) || "Retrait en caisse";
        return NextResponse.json(await removeStamps({ customerId, count, staffId: staff.id, note }));
      }
      case "reward":
        return NextResponse.json(await redeemStampCard({ customerId, staffId: staff.id }));
    }
  } catch (err) {
    if (err instanceof Error && err.constructor === Error) bad(err.message);
    throw err;
  }
  bad("Action inconnue");
});
