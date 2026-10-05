import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a numeric INR amount for display (e.g. ₹1,250). Server values are plain numbers. */
export function formatINR(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return `₹${(Number.isFinite(n) ? n : 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Generate a client idempotency key for money operations. */
export function idempotencyKey(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}
