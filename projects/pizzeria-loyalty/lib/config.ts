export const PIZZERIA_NAME = process.env.NEXT_PUBLIC_PIZZERIA_NAME || "La Bella Pizza";
export const POINTS_PER_EURO = Number(process.env.POINTS_PER_EURO || 1);
export const INACTIVITY_REMINDER_DAYS = Number(process.env.INACTIVITY_REMINDER_DAYS || 30);

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
