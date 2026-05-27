# Gen B Tournaments — Security Architecture

> **Defense-in-depth**: Client validation → RLS policies → SECURITY DEFINER RPC → Audit trail  
> Last updated: 2026-05-26

---

## Table of Contents

1. [Authentication Flow](#1-authentication-flow)
2. [Session Management](#2-session-management)
3. [Row Level Security (RLS) Architecture](#3-row-level-security-rls-architecture)
4. [Admin Role Protection](#4-admin-role-protection)
5. [Wallet Security & Atomic Transactions](#5-wallet-security--atomic-transactions)
6. [Duplicate UTR Detection](#6-duplicate-utr-detection)
7. [Screenshot Verification Process](#7-screenshot-verification-process)
8. [Multi-Account Detection](#8-multi-account-detection)
9. [Rate Limiting Approach](#9-rate-limiting-approach)
10. [Data Validation Rules](#10-data-validation-rules)
11. [Anti-Cheat Architecture](#11-anti-cheat-architecture)
12. [Infrastructure Security](#12-infrastructure-security)
13. [Incident Response](#13-incident-response)
14. [Security Checklist](#14-security-checklist)

---

## 1. Authentication Flow

### 1.1 — JWT Token Architecture

Gen B Tournaments uses **Supabase Auth** which implements the OAuth 2.0 + JWT pattern:

```
┌──────────┐         ┌──────────────────┐         ┌─────────────────┐
│  Browser │         │  Supabase Auth   │         │  PostgreSQL DB  │
└────┬─────┘         └────────┬─────────┘         └────────┬────────┘
     │                        │                            │
     │  1. POST /auth/signIn  │                            │
     │ ─────────────────────► │                            │
     │                        │  2. Validate credentials   │
     │                        │ ──────────────────────────►│
     │                        │  3. Return user record     │
     │                        │ ◄──────────────────────────│
     │  4. access_token (JWT) │                            │
     │  5. refresh_token      │                            │
     │ ◄───────────────────── │                            │
     │                        │                            │
     │  6. API request + JWT  │                            │
     │ ─────────────────────► │                            │
     │                        │  7. Verify JWT signature   │
     │                        │  8. Extract auth.uid()     │
     │                        │  9. Apply RLS policies     │
     │                        │ ──────────────────────────►│
     │                        │  10. Return filtered data  │
     │  11. Response          │ ◄──────────────────────────│
     │ ◄───────────────────── │                            │
```

### 1.2 — JWT Token Structure

```
Header: { "alg": "HS256", "typ": "JWT" }
Payload: {
  "sub":   "user-uuid",       // = auth.uid() in RLS
  "email": "user@example.com",
  "role":  "authenticated",   // NOT the app role
  "aud":   "authenticated",
  "iss":   "supabase",
  "iat":   1700000000,
  "exp":   1700003600         // 1 hour expiry
}
Signature: HMACSHA256(base64Header + "." + base64Payload, JWT_SECRET)
```

**Key security properties**:
- `JWT_SECRET` is stored only on Supabase servers — never exposed to clients
- `sub` field = `auth.uid()` used in ALL RLS policies
- Access tokens expire in **1 hour** (configurable in Supabase Auth settings)
- Refresh tokens last **30 days** and are rotated on each use

### 1.3 — Sign-Up Flow

```
User fills signup form
    │
    ▼
Client validates:
  - Email format valid
  - Password >= 8 chars, contains number
  - Username 3-20 chars, alphanumeric
  - Referral code format (if provided)
    │
    ▼
supabase.auth.signUp() called
    │
    ▼
Supabase creates auth.users record
    │
    ▼ (Database trigger fires)
handle_new_user() trigger:
  - Generates unique username (with collision retry)
  - Generates unique 8-char referral_code
  - Creates profiles record
  - Creates wallets record (all balances = 0)
  - Creates referrals record if referred_by provided
    │
    ▼
Email confirmation sent (if enabled)
    │
    ▼ (User clicks email link)
Session established → JWT issued
```

### 1.4 — Sign-In Flow

```
User submits login form
    │
    ▼
Client validates email/password format
    │
    ▼
supabase.auth.signInWithPassword()
    │
    ▼ (Supabase checks)
  ✓ Email/password match
  ✓ Email confirmed (if enabled)
    │
    ▼
JWT access_token + refresh_token returned
    │
    ▼
Tokens stored in localStorage (Supabase SDK default)
    │
    ▼
Client fetches profile:
  Check is_banned === true → show banned screen, sign out
  Check is_suspended + suspended_until > now → show suspension screen
    │
    ▼
User redirected to appropriate page based on role
```

### 1.5 — Password Reset Flow

```
User requests reset → supabase.auth.resetPasswordForEmail()
    │
    ▼
Supabase sends magic link with secure token to email
(Token expires in 1 hour)
    │
    ▼
User clicks link → redirected to /reset-password.html
    │
    ▼
URL contains #access_token and #type=recovery
Supabase SDK auto-detects and sets temporary session
    │
    ▼
User enters new password
supabase.auth.updateUser({ password: newPassword })
    │
    ▼
Password updated → all existing refresh tokens invalidated
User redirected to login
```

---

## 2. Session Management

### 2.1 — Token Storage

| Token          | Storage Location | Lifetime   | Notes                                      |
|----------------|-----------------|------------|--------------------------------------------|
| access_token   | localStorage    | 1 hour     | Used in every API request as Bearer token  |
| refresh_token  | localStorage    | 30 days    | Used to obtain new access_token            |

> **Note**: localStorage is XSS-vulnerable. Mitigated by CSP headers and input sanitization.

### 2.2 — Auto-Refresh

```javascript
// Supabase SDK handles this automatically with these settings:
const supabase = createClient(url, key, {
  auth: {
    autoRefreshToken:  true,   // Refreshes 60s before expiry
    persistSession:    true,   // Saves to localStorage
    detectSessionInUrl: true   // Handles OAuth/magic link redirects
  }
});
```

### 2.3 — Session Validation on Every Page

```javascript
// Called at top of every protected page
async function requireAuth() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (!session) {
    sessionStorage.setItem('redirect_after_login', window.location.href);
    window.location.replace('/index.html');
    return null;
  }

  // Also check ban status
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_banned, is_suspended, suspended_until, role')
    .eq('id', session.user.id)
    .single();

  if (profile?.is_banned) {
    await supabase.auth.signOut();
    window.location.replace('/index.html?banned=1');
    return null;
  }

  return session;
}
```

### 2.4 — Logout

- All tokens cleared from localStorage
- Supabase server-side session invalidated
- User redirected to homepage

---

## 3. Row Level Security (RLS) Architecture

### 3.1 — How RLS Works

Every database query automatically applies RLS filters based on the authenticated user's JWT:

```sql
-- Without RLS (dangerous):
SELECT * FROM wallets;  -- Returns ALL wallets

-- With RLS enabled + policy:
-- Supabase automatically adds: WHERE user_id = auth.uid()
SELECT * FROM wallets;  -- Returns ONLY the authenticated user's wallet
```

### 3.2 — RLS Policy Hierarchy

```
┌────────────────────────────────────┐
│         anon role                  │  ← Unauthenticated users
│  Can read: announcements (active)  │  
│  Cannot: read anything private     │  
└────────────────────────────────────┘
           ↓
┌────────────────────────────────────┐
│      authenticated role            │  ← Logged-in users
│  Can read own: profile, wallet,    │
│    transactions, payments, etc.    │
│  Can write own: profile updates,   │
│    new payments, withdrawals       │
│  Cannot: modify others' data       │
│  Cannot: update wallet directly    │
└────────────────────────────────────┘
           ↓
┌────────────────────────────────────┐
│         admin role                 │  ← profiles.role = 'admin'
│  Can read: everything              │
│  Can write: everything             │
│  Verified via is_admin() function  │
└────────────────────────────────────┘
           ↓
┌────────────────────────────────────┐
│    SECURITY DEFINER (RPC)         │  ← Runs as postgres superuser
│  Bypasses RLS for atomic ops       │
│  Used for: wallet credits/debits,  │
│    tournament joins, prize dist.   │
│  Always validates inputs manually  │
└────────────────────────────────────┘
```

### 3.3 — Critical Policy: Wallets

No user can directly UPDATE their own wallet balance. All wallet changes go through RPC functions:

```sql
-- There is NO policy allowing users to UPDATE wallets
-- Only admins can UPDATE (for direct adjustments via dashboard)
-- All user-facing wallet changes use SECURITY DEFINER RPC functions

CREATE POLICY "wallet_admin_update"
  ON public.wallets FOR UPDATE
  USING (public.is_admin());
```

### 3.4 — Critical Policy: Role Self-Elevation Prevention

```sql
-- Users cannot promote themselves to admin
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- This prevents changing your own role
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );
```

---

## 4. Admin Role Protection

### 4.1 — Role Verification Architecture

```
Browser (admin page)
    │
    ▼
Page loads → requireAdminAuth() called
    │
    ▼
getSession() → verified JWT
    │
    ▼
SELECT role FROM profiles WHERE id = auth.uid()
    │
    ├── role = 'admin'    → Allow access, load admin UI
    └── role ≠ 'admin'    → Redirect to /index.html
```

### 4.2 — Admin Page Guard

```javascript
// At top of every admin/*.html page
async function requireAdminAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace('/index.html');
    return null;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, is_banned')
    .eq('id', session.user.id)
    .single();

  if (error || !profile || profile.role !== 'admin') {
    // Log unauthorized access attempt
    await supabase.from('analytics_events').insert({
      event_name: 'unauthorized_admin_access',
      user_id:    session.user.id,
      page_url:   window.location.href
    });
    window.location.replace('/index.html');
    return null;
  }

  return { session, profile };
}
```

### 4.3 — Double-Validated Admin Operations

Critical admin operations are protected at **three levels**:

1. **Client-side**: Admin check before showing buttons/forms
2. **RLS policy**: `is_admin()` function check in database policy
3. **RPC function**: Additional `admin` role check inside `SECURITY DEFINER` function

```sql
-- Example from approve_deposit RPC:
IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'admin') THEN
  RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admins only');
END IF;
```

### 4.4 — Admin Action Audit Trail

Every admin operation records who did what:

```sql
-- payments.verified_by    → Admin UUID who approved
-- withdrawals.processed_by → Admin UUID who processed
-- transactions.admin_note → Reason for manual adjustments
-- analytics_events        → All page views and actions logged
```

---

## 5. Wallet Security & Atomic Transactions

### 5.1 — Why SECURITY DEFINER RPC?

Wallet operations MUST be atomic — either the entire operation succeeds or nothing changes:

```
WITHOUT atomic transactions (DANGEROUS):
  Step 1: Deduct fee from wallet ✓
  Step 2: Insert registration   ✗ (fails)
  Result: User lost money but didn't join! 💸

WITH RPC atomic transaction (SAFE):
  BEGIN;
    Step 1: Deduct fee from wallet
    Step 2: Insert registration
    Step 3: Increment filled_slots
  COMMIT;  ← All or nothing
  Result: Consistent state guaranteed ✓
```

### 5.2 — Balance Verification Before Deduction

```sql
-- In join_tournament RPC:
-- 1. Lock the wallet row (FOR UPDATE prevents concurrent reads)
SELECT * FROM wallets WHERE user_id = p_user_id FOR UPDATE;

-- 2. Check sufficient balance BEFORE any deduction
IF v_wallet.main_balance < v_tournament.entry_fee THEN
  RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
END IF;

-- 3. Only then deduct
UPDATE wallets SET main_balance = main_balance - entry_fee WHERE ...;
```

### 5.3 — Pessimistic Locking Strategy

```sql
-- Row-level locks prevent race conditions:
-- User A and User B both try to join tournament with 1 slot left at the same time

-- Transaction 1 (User A):
SELECT * FROM tournaments WHERE id = X FOR UPDATE;  -- Acquires lock
-- ... processes ...
UPDATE tournaments SET filled_slots = filled_slots + 1;  -- Succeeds
COMMIT;  -- Releases lock

-- Transaction 2 (User B):
SELECT * FROM tournaments WHERE id = X FOR UPDATE;  -- WAITS for lock
-- Lock released, B reads: filled_slots = max_slots
-- B receives: "Tournament is full"
-- No double-booking possible ✓
```

### 5.4 — Negative Balance Prevention

Database-level CHECK constraints guarantee balances never go negative:

```sql
-- In wallets table definition:
main_balance     NUMERIC(12,2) DEFAULT 0 CHECK (main_balance >= 0),
bonus_balance    NUMERIC(12,2) DEFAULT 0 CHECK (bonus_balance >= 0),
winning_balance  NUMERIC(12,2) DEFAULT 0 CHECK (winning_balance >= 0),
```

If an RPC tries to set balance below 0, PostgreSQL raises an exception and rolls back the entire transaction.

### 5.5 — Wallet Priority Spending Order

When a user joins a tournament, balance is deducted in this priority:

```
1. main_balance (real deposited money)
2. winning_balance (prize money)
3. bonus_balance (promotional credits)
```

This benefits the platform (real money spent first) and protects bonus integrity.

---

## 6. Duplicate UTR Detection

UTR (Unique Transaction Reference) is the reference number from UPI payments.

### 6.1 — Detection Flow

```
User submits deposit with UTR = "123456789012"
    │
    ▼
Client-side check (instant UX):
SELECT id FROM payments WHERE utr_number = '123456789012'
    │
    ├── Found → Show error "UTR already submitted"
    └── Not found → Allow submission
         │
         ▼
Payment inserted with status = 'pending'
         │
         ▼
Admin clicks "Approve"
         │
         ▼
approve_deposit RPC runs:
  -- Check for approved payments with same UTR
  IF EXISTS (SELECT 1 FROM payments WHERE utr_number = X AND status = 'approved')
    UPDATE payments SET status = 'duplicate' WHERE id = p_payment_id
    RETURN error: "Duplicate UTR detected"
```

### 6.2 — UTR Validation Rules

```javascript
// Client-side UTR validation
function validateUTR(utr) {
  // UTR format: 12 digits (bank reference) or alphanumeric
  const utrRegex = /^[A-Z0-9]{8,22}$/i;
  if (!utrRegex.test(utr)) return 'Invalid UTR format';
  if (utr.length < 8 || utr.length > 22) return 'UTR must be 8-22 characters';
  return null; // Valid
}
```

### 6.3 — UTR Database Index

```sql
-- Fast lookup for duplicate detection:
CREATE INDEX idx_payments_utr ON public.payments(utr_number);
```

### 6.4 — Protection Against UTR Manipulation

- UTR is stored **as-is** from user input (uppercased)
- Admin sees the original submitted UTR and the screenshot together
- Admin manually verifies UTR on screenshot matches submitted UTR
- Amount discrepancy (user claims ₹500, screenshot shows ₹100) → Admin rejects

---

## 7. Screenshot Verification Process

### 7.1 — Upload Security

```
User selects screenshot file
    │
    ▼
Client validates:
  - File type: image/jpeg, image/png, image/webp only
  - File size: max 5 MB
  - File not empty
    │
    ▼
Upload to Cloudinary (or Supabase Storage) with user_id in path
    │
    ▼
URL stored in payments.screenshot_url
File stored at: /user_id/timestamp.ext
    │
    ▼
Only the owner + admins can view (via RLS)
```

### 7.2 — Admin Review Checklist

Admins verify these before approving:

| Check | Description |
|-------|-------------|
| ✅ UTR Match | UTR on screenshot matches submitted UTR number |
| ✅ Amount Match | Amount on screenshot matches claimed amount (admin can adjust) |
| ✅ Date Valid | Payment date is recent (within 24-48 hours) |
| ✅ UPI ID Match | Payment sent to correct UPI ID shown in admin settings |
| ✅ Status | Screenshot shows "Success" or "Completed" |
| ✅ Not Duplicate | UTR not previously approved |
| ✅ Not Edited | Screenshot doesn't appear digitally altered |

### 7.3 — Screenshot Storage Security

```sql
-- Private bucket RLS: Only owner or admin can view
CREATE POLICY "payment_proofs_owner_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs' AND
    (auth.uid()::TEXT = (storage.foldername(name))[1] OR public.is_admin())
  );
```

Screenshots are stored with user's UUID in the path, preventing path traversal.

---

## 8. Multi-Account Detection

### 8.1 — Detection Signals

The platform collects multiple signals to detect users creating duplicate accounts:

| Signal | Collection Method | Risk Level |
|--------|------------------|------------|
| Email | auth.users | High (unique constraint) |
| Device fingerprint | Client-side JS | Medium |
| Browser fingerprint | Canvas, fonts, screen | Medium |
| IP address | analytics_events | Low (shared IPs) |
| Game UID (BGMI/FF) | profiles table | High |
| Referral pattern | referrals table | Medium |
| Payment UPI ID | withdrawals table | High |

### 8.2 — Game UID Uniqueness (Primary Detection)

```sql
-- Detect shared game UIDs
SELECT game_uid_bgmi, COUNT(*) as account_count, array_agg(username) as usernames
FROM public.profiles
WHERE game_uid_bgmi IS NOT NULL AND game_uid_bgmi != ''
GROUP BY game_uid_bgmi
HAVING COUNT(*) > 1;

-- Admin can run this query to find multi-account patterns
```

### 8.3 — Referral Abuse Detection

```sql
-- Detect self-referral chains (user A refers B, B refers C, C refers A)
-- or rapid referral farming
SELECT referrer_id, COUNT(*) as referral_count
FROM public.referrals
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY referrer_id
HAVING COUNT(*) > 5
ORDER BY referral_count DESC;
```

### 8.4 — UPI ID Sharing Detection

```sql
-- Multiple accounts withdrawing to same UPI
SELECT upi_id, COUNT(DISTINCT user_id) as user_count, array_agg(DISTINCT user_id) as user_ids
FROM public.withdrawals
GROUP BY upi_id
HAVING COUNT(DISTINCT user_id) > 1;
```

### 8.5 — Client-Side Fingerprinting

```javascript
// Collect fingerprint for analytics (stored in analytics_events)
async function getDeviceFingerprint() {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency,
    navigator.deviceMemory || 'unknown'
  ];

  // Canvas fingerprint
  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('fingerprint', 2, 2);
  components.push(canvas.toDataURL());

  // Hash the combined string
  const str    = components.join('|');
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### 8.6 — Enforcement Actions

When multi-account is detected:

1. **Flag for review**: `analytics_events` record with `multi_account_suspected`
2. **Manual review**: Admin compares accounts, game UIDs, payment history
3. **Action options**:
   - Warn user (notification)
   - Suspend secondary accounts
   - Ban all accounts
   - Confiscate fraudulently earned bonuses

---

## 9. Rate Limiting Approach

### 9.1 — Database-Level Rate Limiting

Supabase enforces connection limits. For application-level rate limiting:

```sql
-- Prevent rapid deposit submissions (max 3 pending per user)
-- Client enforces this; DB enforces via CHECK or trigger

CREATE OR REPLACE FUNCTION check_payment_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  pending_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO pending_count
  FROM public.payments
  WHERE user_id = NEW.user_id AND status = 'pending';

  IF pending_count >= 3 THEN
    RAISE EXCEPTION 'Too many pending deposits. Wait for existing ones to be reviewed.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_payment_rate_limit
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION check_payment_rate_limit();
```

### 9.2 — Spin Cooldown Enforcement

Enforced at database level in `process_spin` RPC — client UI state is cosmetic only:

```sql
-- In process_spin RPC:
IF v_hours_since < v_cooldown_hours THEN
  RETURN error + next_spin_at
END IF;
```

### 9.3 — Daily Claim Cooldown

Same approach — enforced in `claim_daily_reward` RPC with 20-hour minimum.

### 9.4 — Tournament Registration Limits

```sql
-- Optional: limit how many active tournaments a user can be registered for
CREATE OR REPLACE FUNCTION check_tournament_reg_limit()
RETURNS TRIGGER AS $$
DECLARE
  active_regs INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_regs
  FROM public.tournament_registrations tr
  JOIN public.tournaments t ON t.id = tr.tournament_id
  WHERE tr.user_id = NEW.user_id
    AND t.status IN ('upcoming', 'ongoing');

  IF active_regs >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 active tournament registrations allowed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 9.5 — Vercel Edge Rate Limiting (Future Enhancement)

For API abuse prevention at the CDN level, add `vercel.json` rate limit rules or use Vercel's middleware:

```javascript
// middleware.js (future)
export function middleware(request) {
  // Implement token bucket algorithm
  // Block IPs exceeding N requests/minute
}
```

### 9.6 — Supabase Connection Limits

| Plan    | DB Connections | Row reads/month |
|---------|---------------|-----------------|
| Free    | 60            | Unlimited        |
| Pro     | 200           | Unlimited        |

Enable **Supabase Connection Pooling (PgBouncer)** to multiply effective connections.

---

## 10. Data Validation Rules

### 10.1 — Client-Side Validation

```javascript
const VALIDATION_RULES = {
  username: {
    minLength:   3,
    maxLength:   20,
    pattern:     /^[a-zA-Z0-9_]+$/,
    message:     'Username must be 3-20 characters, letters/numbers/underscore only'
  },
  password: {
    minLength:   8,
    pattern:     /^(?=.*[0-9])(?=.*[a-zA-Z]).+$/,
    message:     'Password must be at least 8 characters with at least one number'
  },
  email: {
    pattern:     /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message:     'Enter a valid email address'
  },
  amount: {
    min:         1,
    max:         100000,
    decimals:    2,
    message:     'Amount must be between ₹1 and ₹1,00,000'
  },
  utrNumber: {
    minLength:   8,
    maxLength:   22,
    pattern:     /^[A-Z0-9]+$/i,
    message:     'UTR must be 8-22 alphanumeric characters'
  },
  upiId: {
    pattern:     /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/,
    message:     'Enter a valid UPI ID (e.g., name@upi)'
  },
  gameUid: {
    minLength:   5,
    maxLength:   20,
    pattern:     /^[a-zA-Z0-9]+$/,
    message:     'Game UID must be 5-20 alphanumeric characters'
  },
  chatMessage: {
    minLength:   1,
    maxLength:   500,
    message:     'Message must be 1-500 characters'
  }
};

function validate(field, value) {
  const rule = VALIDATION_RULES[field];
  if (!rule) return null;

  if (rule.minLength && value.length < rule.minLength) return rule.message;
  if (rule.maxLength && value.length > rule.maxLength) return rule.message;
  if (rule.pattern   && !rule.pattern.test(value))     return rule.message;
  if (rule.min       && Number(value) < rule.min)       return rule.message;
  if (rule.max       && Number(value) > rule.max)       return rule.message;

  return null; // Valid
}
```

### 10.2 — Database-Level Constraints

All business rules are also enforced at the database level:

```sql
-- Amount constraints (always positive)
entry_fee  NUMERIC(10,2) CHECK (entry_fee >= 0)
prize_pool NUMERIC(10,2) CHECK (prize_pool >= 0)
amount     NUMERIC(10,2) CHECK (amount > 0)         -- payments, withdrawals

-- Role constraint
role TEXT CHECK (role IN ('user', 'admin', 'moderator'))

-- Status constraint
status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate'))

-- Balance constraint (never negative)
main_balance NUMERIC(12,2) CHECK (main_balance >= 0)

-- Level/XP must be positive
level INTEGER CHECK (level >= 1)
xp    INTEGER CHECK (xp >= 0)

-- Clan tag length
tag TEXT CHECK (char_length(tag) BETWEEN 2 AND 5)

-- Message length
text TEXT CHECK (char_length(text) BETWEEN 1 AND 500)
```

### 10.3 — XSS Prevention

```javascript
// Sanitize all user-generated content before rendering
function sanitizeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// Always use textContent, not innerHTML for user data
element.textContent = userMessage; // ✅ Safe
element.innerHTML   = userMessage; // ❌ XSS risk

// For rich content that MUST use innerHTML, use DOMPurify
import DOMPurify from 'dompurify';
element.innerHTML = DOMPurify.sanitize(userContent);
```

### 10.4 — SQL Injection Prevention

Supabase JS SDK uses parameterized queries by default:

```javascript
// SAFE — SDK parameterizes automatically:
.eq('username', userInput)
.eq('amount', userAmount)

// NEVER use raw SQL with user input in client code
// If using .sql() or RPC, always use parameters:
supabase.rpc('my_function', { p_param: userInput }); // ✅ Safe
```

---

## 11. Anti-Cheat Architecture

### 11.1 — Current Implementation

**Score submission integrity**: Admins manually enter results via the admin dashboard. Players cannot self-report scores.

```
Tournament ends
    │
    ▼
Admin collects results (in-game screenshots, kill feeds)
    │
    ▼
Admin enters results in admin panel
    │
    ▼
distribute_prizes() RPC validates + credits prizes
    │
    ▼
Players receive notification with placement + prize
```

### 11.2 — Kill Verification

```
Player claims: "I got 20 kills"
    │
    ▼
Admin checks in-game death recap or spectator recording
    │
    ▼
Admin enters verified kill count
    │
    ▼
Only verified kills earn per_kill_bonus
```

### 11.3 — Account Eligibility Checks (in join_tournament RPC)

```sql
-- Check user is not banned or suspended
IF EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = p_user_id
    AND (is_banned = true OR (is_suspended = true AND suspended_until > NOW()))
) THEN
  RETURN error: 'Account is banned or suspended';
END IF;
```

### 11.4 — Future Anti-Cheat Roadmap

| Feature | Priority | Description |
|---------|----------|-------------|
| Room code reveal gating | High | Only show room code to verified game UID accounts |
| Game API integration | Medium | Fetch match data directly from BGMI/FF API |
| Screenshot AI analysis | Low | ML model to detect edited screenshots |
| Elo/MMR system | Low | Match players of similar skill |
| Report system | Medium | Players can flag suspicious opponents |
| Replay verification | Medium | Require post-match game replay upload |

### 11.5 — Room Code Security

```javascript
// Room ID/password only shown if:
// 1. User is registered for tournament
// 2. room_published = true in tournaments table
// 3. Tournament has not yet ended

async function getRoomDetails(tournamentId) {
  const { data: { user } } = await supabase.auth.getUser();

  // Verify registration
  const { data: reg } = await supabase
    .from('tournament_registrations')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('user_id', user.id)
    .single();

  if (!reg) throw new Error('Not registered for this tournament');

  // Fetch room details (RLS ensures only registered users see this)
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('room_id, room_password, room_published, status')
    .eq('id', tournamentId)
    .single();

  if (!tournament.room_published) throw new Error('Room details not yet published');
  if (tournament.status === 'completed') throw new Error('Tournament has ended');

  return { roomId: tournament.room_id, roomPassword: tournament.room_password };
}
```

---

## 12. Infrastructure Security

### 12.1 — HTTPS Enforcement

Vercel automatically provisions TLS/SSL certificates and enforces HTTPS. HTTP requests are automatically redirected to HTTPS.

### 12.2 — Security Headers

From `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options",  "value": "nosniff" },
        { "key": "X-Frame-Options",         "value": "DENY" },
        { "key": "X-XSS-Protection",        "value": "1; mode=block" },
        { "key": "Referrer-Policy",          "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

| Header | Protection |
|--------|------------|
| X-Content-Type-Options: nosniff | Prevents MIME sniffing attacks |
| X-Frame-Options: DENY | Prevents clickjacking |
| X-XSS-Protection: 1; mode=block | Enables browser XSS filter |
| Referrer-Policy: strict-origin | Controls referrer header leakage |

### 12.3 — Content Security Policy (Recommended Addition)

```json
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://res.cloudinary.com https://*.supabase.co; connect-src 'self' https://*.supabase.co https://api.cloudinary.com wss://*.supabase.co;"
}
```

### 12.4 — Supabase Key Security

| Key Type | Exposure | Usage |
|----------|----------|-------|
| `anon` key | Public (frontend) | Auth + RLS-filtered queries |
| `service_role` key | **NEVER public** | Server-side admin operations only |
| `JWT_SECRET` | Supabase internal | Token signing/verification |

### 12.5 — API Key Rotation

If `anon` key is compromised:
1. Go to Supabase > Project Settings > API
2. Click **Rotate anon key**
3. Update `config.js` with new key
4. Redeploy to Vercel

---

## 13. Incident Response

### 13.1 — Suspected Fraud

```
1. Admin flags user: set is_suspended = true, suspended_until = NOW() + 7 days
2. Review: transactions, payments, tournament history
3. If confirmed fraud:
   - Set is_banned = true, ban_reason = 'Fraud: ...'
   - Reverse fraudulent transactions (admin_debit transactions)
   - Document in analytics_events
4. If false positive:
   - Remove suspension
   - Send apology notification
```

### 13.2 — Compromised Admin Account

```
1. Immediately: Go to Supabase > Auth > Users > Find admin user
2. Click "Send password reset" or "Invalidate all sessions"
3. Review recent admin actions:
   SELECT * FROM analytics_events WHERE user_id = 'compromised_admin_id' ORDER BY created_at DESC;
   SELECT * FROM transactions WHERE admin_note IS NOT NULL ORDER BY created_at DESC LIMIT 100;
4. Reverse any suspicious transactions
5. Rotate Supabase anon key if needed
```

### 13.3 — Data Breach Response

```
1. Immediately rotate Supabase anon key
2. Review Supabase Auth logs for unauthorized access
3. Check analytics_events for unusual patterns
4. Notify affected users per applicable privacy laws
5. Review and tighten RLS policies
6. Enable MFA for admin accounts (Supabase Auth supports TOTP)
```

---

## 14. Security Checklist

### Pre-Launch

- [ ] RLS enabled on ALL tables
- [ ] `service_role` key NOT in any frontend file
- [ ] All admin pages have `requireAdminAuth()` guard
- [ ] Wallet updates ONLY through RPC functions (no direct UPDATE policy for users)
- [ ] Database CHECK constraints on all amount fields
- [ ] UTR duplicate detection tested
- [ ] Security headers in `vercel.json`
- [ ] HTTPS enforced (Vercel default)
- [ ] Input validation on all forms (client + DB level)
- [ ] Spam prevention: pending payment limit trigger
- [ ] Analytics events table to audit suspicious activity
- [ ] Admin action audit trail (verified_by, processed_by fields)

### Ongoing

- [ ] Review pending payments daily
- [ ] Run multi-account detection query weekly
- [ ] Monitor analytics for unusual activity
- [ ] Review admin_settings for unauthorized changes
- [ ] Check withdrawals for suspicious UPI patterns
- [ ] Update Supabase project (automatic security patches)
- [ ] Review Supabase Auth logs monthly

---

*End of Security Architecture — Gen B Tournaments*
