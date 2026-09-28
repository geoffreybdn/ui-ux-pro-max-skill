import { NextResponse } from "next/server";
import { HttpError } from "./auth";

/** Enveloppe un handler : transforme les erreurs en réponses JSON propres. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error(err);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
  };
}

export function bad(message: string, status = 400): never {
  throw new HttpError(status, message);
}
