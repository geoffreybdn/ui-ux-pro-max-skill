"use client";

import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";

export function PeriodSelect({ value, options, range }: { value: string; options: Record<string, string>; range: string }) {
  const router = useRouter();
  return (
    <label className="period-select">
      <CalendarDays size={18} aria-hidden />
      <span className="period-range">{range}</span>
      <select value={value} onChange={(e) => router.push(`/admin?periode=${e.target.value}`)} aria-label="Période">
        {Object.entries(options).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </label>
  );
}
