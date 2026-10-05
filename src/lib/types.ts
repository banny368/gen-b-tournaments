/** Shared domain types mirroring the database schema. */

export type TournamentStatus =
  | "DRAFT" | "SCHEDULED" | "REGISTRATION_OPEN" | "REGISTRATION_CLOSED"
  | "ROOM_PENDING" | "ROOM_RELEASED" | "LIVE" | "RESULT_PENDING"
  | "RESULT_REVIEW" | "COMPLETED" | "CANCELLED" | "REFUNDING" | "REFUNDED" | "DISPUTED";

export type BalanceAccount = "DEPOSIT" | "BONUS" | "REWARD" | "WINNINGS" | "REFUND" | "LOCKED";

export interface Profile {
  id: string;
  username: string | null;
  player_code: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country: string | null;
  is_verified: boolean;
  is_banned: boolean;
  referral_code: string;
  language: string;
  created_at: string;
}

export interface Game {
  id: string;
  name: string;
  short_name: string;
  slug: string;
  icon_url: string | null;
  banner_url: string | null;
  description: string | null;
  active: boolean;
  supported_modes: string[];
  minimum_age: number;
  sort_order: number;
}

export interface Tournament {
  id: string;
  game_id: string;
  title: string;
  slug: string;
  description: string | null;
  banner_url: string | null;
  thumbnail_url: string | null;
  format: string;
  team_size: number;
  entry_fee: number;
  currency: string;
  prize_pool: number;
  prize_distribution: { rank: number; percent: number }[];
  max_players: number;
  current_players: number;
  registration_start: string;
  registration_end: string | null;
  match_start: string;
  estimated_end: string | null;
  status: TournamentStatus;
  visibility: "PUBLIC" | "PRIVATE" | "HIDDEN";
  rules: string | null;
  is_featured: boolean;
  is_demo: boolean;
  games: Pick<Game, "id" | "name" | "short_name" | "slug" | "icon_url"> | null;
}

export interface WalletBalances {
  DEPOSIT?: number;
  BONUS?: number;
  REWARD?: number;
  WINNINGS?: number;
  REFUND?: number;
  LOCKED?: number;
}

export interface LedgerEntry {
  id: string;
  transaction_id: string;
  account: string;
  direction: "DEBIT" | "CREDIT";
  amount: number;
  created_at: string;
  ledger_transactions: {
    id: string;
    txn_type: string;
    description: string | null;
    created_at: string;
    reference_type: string | null;
  } | null;
}

export interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  provider: "MANUAL_UPI" | "RAZORPAY" | "CASHFREE" | "DEMO";
  reference_code: string;
  utr: string | null;
  status:
    | "CREATED" | "PAYMENT_PENDING" | "PAYMENT_SUCCESS" | "PENDING_REVIEW"
    | "APPROVED" | "REJECTED" | "REFUNDED" | "EXPIRED" | "FLAGGED";
  failure_reason: string | null;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  amount: number;
  fee: number;
  net_amount: number;
  destination_type: "UPI" | "BANK";
  status:
    | "REQUESTED" | "UNDER_REVIEW" | "APPROVED" | "PROCESSING"
    | "COMPLETED" | "FAILED" | "REJECTED" | "REVERSED" | "CANCELLED";
  created_at: string;
}

export interface Claim {
  id: string;
  ticket_code: string;
  category: string;
  subject: string;
  description: string;
  status:
    | "OPEN" | "IN_REVIEW" | "WAITING_USER" | "WAITING_ADMIN"
    | "RESOLVED" | "REJECTED" | "CLOSED";
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

/** Standard envelope returned by all money/tournament RPCs. */
export interface RpcResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}
