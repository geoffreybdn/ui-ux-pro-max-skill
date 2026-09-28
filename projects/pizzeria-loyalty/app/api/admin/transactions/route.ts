import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth";
import { handle, bad } from "@/lib/api";
import { adjustStamps, recordVisit, redeemStampCard } from "@/lib/loyalty";

const toCents = (v: unknown) => Math.round(Number(String(v ?? 0).replace(",", ".")) * 100);

export const POST = handle(async (req: Request) => {
  const staff = await assertRole(["admin", "staff"]);
  const body = await req.json().catch(() => ({}));
  const customerId = Number(body.customerId);
  if (!customerId) bad("Client manquant");

  try {
    switch (body.action) {
      case "earn": {
        const amountCents = body.amount === undefined || body.amount === "" ? 0 : toCents(body.amount);
        const quantity = Math.trunc(Number(body.quantity || 0));
        if (!(amountCents >= 0) || amountCents > 100_000) bad("Montant invalide");
        if (!(quantity >= 0) || quantity > 50) bad("Quantité invalide");
        return NextResponse.json(await recordVisit({ customerId, amountCents, quantity, staffId: staff.id }));
      }
      case "reward":
        return NextResponse.json(await redeemStampCard({ customerId, staffId: staff.id }));
      case "adjust": {
        if (staff.role !== "admin") bad("Réservé aux administrateurs", 403);
        const stamps = Math.trunc(Number(body.stamps));
        if (!stamps || Math.abs(stamps) > 100) bad("Nombre de tampons invalide");
        return NextResponse.json(
          await adjustStamps({ customerId, stamps, staffId: staff.id, note: String(body.note || "Correction manuelle") })
        );
      }
    }
  } catch (err) {
    if (err instanceof Error && err.constructor === Error) bad(err.message);
    throw err;
  }
  bad("Action inconnue");
});
