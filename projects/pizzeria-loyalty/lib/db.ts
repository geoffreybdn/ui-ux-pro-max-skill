import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

function getClient() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL n'est pas défini");
    client = neon(url);
  }
  return client;
}

/** Requête SQL paramétrée : sql<Row>`select ... where id = ${id}` */
export async function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  return (await getClient()(strings, ...values)) as T[];
}

export type Customer = {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: "customer" | "staff" | "admin";
  card_code: string;
  points: number;
  lifetime_points: number;
  stamps: number;
  cashback_cents: number;
  birthdate: string | null;
  last_visit_at: string | null;
  created_at: string;
};

export type Promotion = {
  id: number;
  title: string;
  message: string | null;
  multiplier: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
  notified_at: string | null;
};

export type Reward = { id: number; name: string; cost: number; active: boolean };
