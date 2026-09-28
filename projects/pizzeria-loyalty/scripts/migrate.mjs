// Applique db/schema.sql sur la base Neon pointée par DATABASE_URL.
// Usage : DATABASE_URL=... npm run db:migrate
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant");
  process.exit(1);
}

const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const pool = new Pool({ connectionString: url });
try {
  await pool.query(schema);
  console.log("Schéma appliqué ✔");
} finally {
  await pool.end();
}
