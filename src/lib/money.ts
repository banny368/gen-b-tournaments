/**
 * Pure TypeScript mirrors of the fee/split rules that live in Postgres.
 * The DB functions remain the single source of truth at runtime; these
 * mirrors exist so the same configurable rules can be unit-tested (master
 * prompt §84–85) and used for UI previews.
 */

export interface FeeSlab {
  min: number;
  max: number | null;
  type: "flat" | "percent";
  value: number;
}

/** Mirrors compute_withdrawal_fee() in 0006. First matching slab applies. */
export function computeWithdrawalFee(amount: number, slabs: FeeSlab[]): number {
  for (const slab of slabs) {
    const minOk = amount >= slab.min;
    const maxOk = slab.max === null || amount <= slab.max;
    if (minOk && maxOk) {
      return round2(slab.type === "percent" ? (amount * slab.value) / 100 : slab.value);
    }
  }
  return 0;
}

/** Mirrors the entry-fee allocation in join_tournament() (0005). */
export function allocateEntryFee(
  fee: number,
  balances: Record<string, number>,
  opts: {
    priority: string[];
    bonusUsageEnabled: boolean;
    bonusUsagePercentage: number;
    rewardUsageEnabled: boolean;
    rewardUsagePercentage: number;
    minRealBalancePercentage: number;
  },
): { allocation: Record<string, number>; error: null } | { allocation: null; error: "INSUFFICIENT_REAL_BALANCE" | "INSUFFICIENT_BALANCE" } {
  const allocation: Record<string, number> = {};
  let remaining = round2(fee);
  let realContributed = 0;

  // pass 1: real balances (no caps)
  for (const acct of opts.priority) {
    if (remaining <= 0) break;
    if (acct !== "DEPOSIT" && acct !== "WINNINGS") continue;
    const take = Math.min(balances[acct] ?? 0, remaining);
    if (take > 0) {
      allocation[acct] = round2((allocation[acct] ?? 0) + take);
      remaining = round2(remaining - take);
      realContributed = round2(realContributed + take);
    }
  }

  const minReal = round2((fee * opts.minRealBalancePercentage) / 100);
  if (minReal > 0 && realContributed < minReal) {
    return { allocation: null, error: "INSUFFICIENT_REAL_BALANCE" };
  }

  // pass 2: promotional balances with configurable caps
  for (const acct of opts.priority) {
    if (remaining <= 0) break;
    if (acct !== "BONUS" && acct !== "REWARD") continue;
    const enabled = acct === "BONUS" ? opts.bonusUsageEnabled : opts.rewardUsageEnabled;
    if (!enabled) continue;
    const cap = Math.max(0, round2((fee * (acct === "BONUS" ? opts.bonusUsagePercentage : opts.rewardUsagePercentage)) / 100) - (allocation[acct] ?? 0));
    const take = Math.min(balances[acct] ?? 0, remaining, cap);
    if (take > 0) {
      allocation[acct] = round2((allocation[acct] ?? 0) + take);
      remaining = round2(remaining - take);
    }
  }

  if (remaining > 0) return { allocation: null, error: "INSUFFICIENT_BALANCE" };
  return { allocation, error: null };
}

/** Prize distribution percents must sum to exactly 100 (mirrors publish_results_and_pay). */
export function validatePrizeDistribution(dist: { rank: number; percent: number }[]): boolean {
  const total = dist.reduce((sum, d) => sum + d.percent, 0);
  return Math.abs(total - 100) < 0.001;
}

/** Commission: tournament override → game → default (mirrors publish_results_and_pay). */
export function resolveCommissionRate(opts: {
  tournamentOverride: number | null;
  gamePercent: number | null;
  defaultPercent: number;
}): { rate: number; source: "TOURNAMENT_OVERRIDE" | "GAME" | "DEFAULT" } {
  if (opts.tournamentOverride !== null) return { rate: opts.tournamentOverride, source: "TOURNAMENT_OVERRIDE" };
  if (opts.gamePercent !== null) return { rate: opts.gamePercent, source: "GAME" };
  return { rate: opts.defaultPercent, source: "DEFAULT" };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
