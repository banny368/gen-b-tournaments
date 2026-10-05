import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Game, Tournament, WalletBalances } from "@/lib/types";

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

const tournamentSelect = `
  id, game_id, title, slug, description, banner_url, thumbnail_url, format, team_size,
  entry_fee, currency, prize_pool, prize_distribution, max_players, current_players,
  registration_start, registration_end, match_start, estimated_end, status, visibility,
  rules, is_featured, is_demo,
  games (id, name, short_name, slug, icon_url)
`;

export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("games")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  return (data ?? []) as unknown as Game[];
}

export async function getHomeTournaments() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [featured, upcoming, live, completed] = await Promise.all([
    supabase
      .from("tournaments")
      .select(tournamentSelect)
      .eq("is_featured", true)
      .neq("status", "DRAFT")
      .gte("match_start", nowIso)
      .order("match_start")
      .limit(1),
    supabase
      .from("tournaments")
      .select(tournamentSelect)
      .in("status", ["SCHEDULED", "REGISTRATION_OPEN"])
      .order("match_start")
      .limit(6),
    supabase.from("tournaments").select(tournamentSelect).eq("status", "LIVE").order("match_start").limit(4),
    supabase
      .from("tournaments")
      .select(tournamentSelect)
      .eq("status", "COMPLETED")
      .order("estimated_end", { ascending: false })
      .limit(4),
  ]);

  return {
    featured: ((featured.data?.[0] ?? null) as unknown as Tournament | null),
    upcoming: ((upcoming.data ?? []) as unknown as Tournament[]),
    live: ((live.data ?? []) as unknown as Tournament[]),
    completed: ((completed.data ?? []) as unknown as Tournament[]),
  };
}

export async function getTournaments(filters: {
  gameId?: string;
  status?: string;
  maxFee?: number;
  search?: string;
  limit?: number;
}): Promise<Tournament[]> {
  const supabase = await createClient();
  let query = supabase
    .from("tournaments")
    .select(tournamentSelect)
    .neq("status", "DRAFT")
    .order("match_start", { ascending: true })
    .limit(filters.limit ?? 24);

  if (filters.gameId) query = query.eq("game_id", filters.gameId);
  if (filters.status) query = query.in("status", filters.status.split(","));
  else query = query.in("status", ["SCHEDULED", "REGISTRATION_OPEN", "LIVE"]);
  if (filters.maxFee !== undefined) query = query.lte("entry_fee", filters.maxFee);
  if (filters.search) query = query.ilike("title", `%${filters.search}%`);

  const { data } = await query;
  return ((data ?? []) as unknown as Tournament[]);
}

export async function getTournamentBySlugOrId(idOrSlug: string): Promise<Tournament | null> {
  const supabase = await createClient();
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
  const { data } = await supabase
    .from("tournaments")
    .select(tournamentSelect)
    .eq(isUuid ? "id" : "slug", idOrSlug)
    .neq("visibility", "HIDDEN")
    .maybeSingle();
  return ((data ?? null) as unknown as Tournament | null);
}

export async function getWalletBalances(userId: string): Promise<WalletBalances> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_wallet_balances", { p_user: userId });
  return (data as WalletBalances) ?? {};
}

export function walletTotal(balances: WalletBalances): number {
  return (
    (balances.DEPOSIT ?? 0) +
    (balances.WINNINGS ?? 0) +
    (balances.BONUS ?? 0) +
    (balances.REWARD ?? 0) +
    (balances.REFUND ?? 0)
  );
}
