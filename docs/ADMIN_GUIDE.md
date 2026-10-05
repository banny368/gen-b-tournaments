# Admin Guide

## Roles & permissions

8 roles (seeded). `SUPER_ADMIN` has everything. Permission matrix lives in
`supabase/migrations/0004_functions.sql` (`role_has_permission`); per-user overrides are possible
via `user_permission_overrides` (admin panel → Users → Roles).

| Role | Can |
| --- | --- |
| FINANCE_ADMIN | Deposits, withdrawals, fees, ledger, adjustments |
| TOURNAMENT_ADMIN | Create/edit/cancel tournaments, rooms, results, payouts |
| SUPPORT_ADMIN | Read users/deposits/withdrawals/ledger; handle claims |
| MODERATOR | Chat moderation (delete/mute) |
| CONTENT_ADMIN | Legal content, announcements |
| RISK_ADMIN | Risk events, ledger/queues read access |
| ANALYST | Analytics + read-only views |

## First-run checklist

1. Deploy (see `docs/DEPLOYMENT.md`) and create the first SUPER_ADMIN via SQL.
2. Admin → Settings: set `app_name`, `support_email`, `manual_upi_id` (later, when deposits go
   live), review all limits/commission defaults.
3. Admin → Settings → Feature Flags: verify `REAL_MONEY_ENABLED`, `WITHDRAWAL_ENABLED`,
   `MANUAL_UPI_ENABLED`, `RAZORPAY_ENABLED` are **OFF** (they are, by seed).
4. Admin → Tournaments: create real tournaments (leave "Demo tournament" unchecked when using real
   entry fees post-approval).

## Daily workflows

### Deposits (Manual UPI)
1. Player pays your UPI ID and submits their UTR (deposits → PENDING_REVIEW).
2. Admin → Deposits: verify the UTR in your UPI/bank statement (amount + reference must match).
3. **Approve** (credits the player's DEPOSIT balance via the ledger) or **Reject** (reason is sent
   to the player). Duplicate UTRs are rejected by the database automatically.
4. Approving a player's first deposit also qualifies their referral (if configured).

### Withdrawals
1. Player requests → funds move to the WITHDRAWAL_CLEARING account (locked).
2. Admin → Withdrawals → **Approve** → pay via your UPI/bank → **Mark paid** with the payout
   reference (fee goes to PLATFORM_REVENUE; ledger closes the clearing entry).
3. **Reject** returns the locked funds to the player's WINNINGS balance via a reversal ledger
   transaction. Withdrawals can never be deleted — only reversed.

### Tournaments
1. **Create**: title, game, format, slots, entry fee, prize pool, prize distribution (JSON lines,
   percents must total 100), schedule, rules.
2. **Room**: set room ID/password/release time; players see credentials only via
   `get_room_credentials` (participants, after release). Release manually with "Release Room".
3. **Results**: "Publish Results & Pay" — enter rank-1..3 user IDs (UUID) + kills/points. The DB
   function computes commission (override → game → default), pays each winner's WINNINGS balance
   from escrow, and marks the tournament COMPLETED. Idempotent — retrying never double-pays.
4. **Cancel & Refund**: every ACTIVE paid entry is refunded from escrow to the player's REFUND
   balance; statuses update; users are notified. Idempotent per entry.

### User management
- Ban/unban with a mandatory reason (banned users cannot join tournaments or chat).
- **Manual Adjustment**: creates a reason-required ledger transaction (ADJUSTMENT account). There
  is deliberately no "edit balance" button anywhere.
- Roles: grant/revoke any of the 8 admin roles.

### Configuration & audit
- Settings editor: every key is JSON-valued; commission %, deposit/withdrawal limits, fee slabs,
  entry-balance priority, bonus caps, referral rules — all live here, never in code.
- Feature flags: per-feature kill switches, active instantly on the next request.
- Audit Log: append-only record of every sensitive admin action (who, what, when, reason).

## Compliance posture (do not skip)

Real-money features ship disabled. Enabling `REAL_MONEY_ENABLED` is a business/legal decision:
confirm jurisdiction rules (age gating, state restrictions, responsible-gaming requirements),
provider approval, and replace the template legal documents (Admin → Legal via
`legal_documents` table) with counsel-reviewed versions. The platform records terms/privacy
acceptances per version once you publish updated documents.
