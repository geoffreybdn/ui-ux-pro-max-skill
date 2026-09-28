import { NextResponse } from "next/server";
import Papa from "papaparse";
import { assertRole } from "@/lib/auth";
import { handle, bad } from "@/lib/api";
import { normalizeEmail } from "@/lib/config";
import { importLegacyCustomers, type LegacyRow } from "@/lib/loyalty";

export const maxDuration = 60;

// Noms de colonnes acceptés (insensible à la casse / aux accents)
const EMAIL = ["email", "e-mail", "mail", "courriel", "adresse mail", "adresse email"];
const POINTS = ["points", "point", "solde", "pts", "fidelite", "points fidelite"];
const NAME = ["nom", "name", "prenom", "client", "nom complet"];
const PHONE = ["telephone", "tel", "phone", "portable", "mobile"];

const clean = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[_]/g, " ").trim();

export const POST = handle(async (req: Request) => {
  await assertRole(["admin"]);
  const { csv, dryRun } = await req.json().catch(() => ({}));
  if (typeof csv !== "string" || !csv.trim()) bad("Fichier CSV vide");

  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: true,
    delimitersToGuess: [";", ",", "\t"],
    transformHeader: clean,
  });
  const headers = parsed.meta.fields ?? [];
  const find = (names: string[]) => headers.find((h) => names.includes(h));
  const emailCol = find(EMAIL);
  const pointsCol = find(POINTS);
  const nameCol = find(NAME);
  const phoneCol = find(PHONE);
  if (!emailCol || !pointsCol) {
    bad(`Colonnes "email" et "points" obligatoires. Colonnes trouvées : ${headers.join(", ") || "aucune"}`);
  }

  const byEmail = new Map<string, LegacyRow>();
  const errors: string[] = [];
  parsed.data.forEach((r, i) => {
    const email = normalizeEmail(r[emailCol] || "");
    const points = Math.trunc(Number(String(r[pointsCol] || "0").replace(/\s/g, "").replace(",", ".")));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Ligne ${i + 2} : e-mail invalide "${r[emailCol] ?? ""}"`);
      return;
    }
    if (!Number.isFinite(points)) {
      errors.push(`Ligne ${i + 2} : points invalides "${r[pointsCol]}"`);
      return;
    }
    // En cas de doublon dans le fichier, on additionne les points
    const prev = byEmail.get(email);
    byEmail.set(email, {
      email,
      points: (prev?.points ?? 0) + points,
      name: (nameCol && r[nameCol]?.trim()) || prev?.name || null,
      phone: (phoneCol && r[phoneCol]?.trim()) || prev?.phone || null,
    });
  });

  const rows = [...byEmail.values()];
  if (dryRun) {
    return NextResponse.json({ preview: rows.slice(0, 10), total: rows.length, errors: errors.slice(0, 50) });
  }
  const result = await importLegacyCustomers(rows);
  return NextResponse.json({ ...result, errors: errors.slice(0, 50) });
});
