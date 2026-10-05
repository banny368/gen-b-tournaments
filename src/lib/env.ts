/** Central env access. NEXT_PUBLIC_* values are public by design; no secrets here. */
export const supabaseConfig = {
  get url() {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  },
  get anonKey() {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  },
  get configured() {
    return Boolean(this.url && this.anonKey);
  },
};
