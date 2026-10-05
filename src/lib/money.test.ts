import { describe, expect, it } from "vitest";
import {
  computeWithdrawalFee,
  allocateEntryFee,
  validatePrizeDistribution,
  resolveCommissionRate,
} from "@/lib/money";

describe("withdrawal fee slabs", () => {
  const slabs = [
    { min: 0, max: 499, type: "flat" as const, value: 5 },
    { min: 500, max: 1999, type: "percent" as const, value: 2 },
    { min: 2000, max: null, type: "percent" as const, value: 1 },
  ];

  it("applies flat fee in the lowest slab", () => {
    expect(computeWithdrawalFee(250, slabs)).toBe(5);
  });

  it("applies percent fee in the middle slab", () => {
    expect(computeWithdrawalFee(1000, slabs)).toBe(20);
  });

  it("applies percent fee above the highest max (null = unbounded)", () => {
    expect(computeWithdrawalFee(10000, slabs)).toBe(100);
  });

  it("returns 0 when no slab matches", () => {
    expect(computeWithdrawalFee(50, [])).toBe(0);
  });

  it("never returns a fee above the amount", () => {
    const harsh = [{ min: 0, max: null, type: "flat" as const, value: 100 }];
    expect(computeWithdrawalFee(120, harsh)).toBe(100);
  });
});

describe("entry fee allocation (join split rules)", () => {
  const baseOpts = {
    priority: ["DEPOSIT", "WINNINGS", "REWARD", "BONUS"],
    bonusUsageEnabled: true,
    bonusUsagePercentage: 20,
    rewardUsageEnabled: true,
    rewardUsagePercentage: 20,
    minRealBalancePercentage: 0,
  };

  it("consumes deposit balance first", () => {
    const r = allocateEntryFee(100, { DEPOSIT: 150 }, baseOpts);
    expect(r.error).toBeNull();
    expect(r.allocation).toEqual({ DEPOSIT: 100 });
  });

  it("spills into winnings, then caps bonus at the configured percentage", () => {
    const r = allocateEntryFee(
      100,
      { DEPOSIT: 40, WINNINGS: 30, BONUS: 500 },
      { ...baseOpts, bonusUsagePercentage: 20 },
    );
    // 40 + 30 = 70 real; bonus capped at 20% of 100 = 20 → 90 total < 100 fee
    expect(r.error).toBe("INSUFFICIENT_BALANCE");
  });

  it("allows bonus only up to its cap", () => {
    const r = allocateEntryFee(
      100,
      { DEPOSIT: 85, BONUS: 500 },
      { ...baseOpts, bonusUsagePercentage: 20 },
    );
    expect(r.error).toBeNull();
    expect(r.allocation).toEqual({ DEPOSIT: 85, BONUS: 15 });
  });

  it("enforces the minimum real-balance contribution", () => {
    const r = allocateEntryFee(
      100,
      { DEPOSIT: 20, BONUS: 500 },
      { ...baseOpts, bonusUsagePercentage: 100, minRealBalancePercentage: 60 },
    );
    expect(r.error).toBe("INSUFFICIENT_REAL_BALANCE");
  });

  it("rejects when balances cannot cover the fee", () => {
    const r = allocateEntryFee(100, { DEPOSIT: 10 }, baseOpts);
    expect(r.error).toBe("INSUFFICIENT_BALANCE");
  });

  it("ignores bonus entirely when bonus usage is disabled", () => {
    const r = allocateEntryFee(
      100,
      { BONUS: 1000 },
      { ...baseOpts, bonusUsageEnabled: false, minRealBalancePercentage: 0 },
    );
    expect(r.error).toBe("INSUFFICIENT_BALANCE");
  });
});

describe("prize distribution validation", () => {
  it("accepts a distribution summing to 100", () => {
    expect(validatePrizeDistribution([{ rank: 1, percent: 50 }, { rank: 2, percent: 30 }, { rank: 3, percent: 20 }])).toBe(true);
  });

  it("rejects a distribution that does not sum to 100", () => {
    expect(validatePrizeDistribution([{ rank: 1, percent: 90 }, { rank: 2, percent: 20 }])).toBe(false);
  });
});

describe("commission resolution", () => {
  it("prefers the tournament override", () => {
    expect(resolveCommissionRate({ tournamentOverride: 5, gamePercent: 12, defaultPercent: 10 })).toEqual({
      rate: 5,
      source: "TOURNAMENT_OVERRIDE",
    });
  });

  it("falls back to the game-level rate", () => {
    expect(resolveCommissionRate({ tournamentOverride: null, gamePercent: 12, defaultPercent: 10 })).toEqual({
      rate: 12,
      source: "GAME",
    });
  });

  it("uses the default last", () => {
    expect(resolveCommissionRate({ tournamentOverride: null, gamePercent: null, defaultPercent: 10 })).toEqual({
      rate: 10,
      source: "DEFAULT",
    });
  });
});
