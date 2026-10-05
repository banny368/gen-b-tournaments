# GEN B TOURNAMENTS — UNIVERSAL MASTER BUILD PROMPT
## Free-First, Mobile-First, Android + Web, Future-Ready Esports Tournament Platform

> **Purpose:** This document is a master prompt/specification for an AI coding agent. Give this entire file to the coding agent and instruct it to build the product phase-by-phase, verify every phase, and never declare the project complete until the final audit passes.
>
> **Important:** The platform may involve real-money gaming, deposits, withdrawals, prizes, advertising, and payments. The implementation MUST include configurable compliance/eligibility controls and MUST NOT assume that a particular game, state, payment provider, app store, or legal regime permits the proposed real-money model. Before production launch, obtain applicable legal/compliance advice and provider approval. The app must support disabling real-money features by jurisdiction/user eligibility.

---

# 1. PRODUCT VISION

Build a premium, scalable, mobile-first esports tournament platform called **Gen B Tournaments**.

The platform should allow players to discover and join tournaments for multiple competitive games, initially including:

- BGMI
- Free Fire / Free Fire MAX where permitted
- Call of Duty / COD Mobile where permitted
- Future games configurable from Admin Panel
- Any future game/category without changing application architecture

The product must work as:

1. Android application
2. Responsive mobile web app
3. Tablet web interface
4. Desktop/laptop web interface
5. Future PWA/installable web experience
6. Future iOS/client support without redesigning the backend

The platform must be **mobile-first**, but desktop web must feel like a complete product rather than a stretched mobile page.

---

# 2. CORE PRODUCT PRINCIPLES

Follow these principles throughout development:

- Production-grade architecture
- Security-first
- Mobile-first
- Free/open-source-first
- Vendor-neutral architecture
- Modular services
- Server-authoritative financial logic
- Immutable financial ledger
- Idempotent payment processing
- Role-based access control
- Auditability
- Accessibility
- Performance
- Offline/error resilience
- Future extensibility
- Feature flags
- Configurable business rules
- No hard-coded commissions, fees, game names, limits, or reward values
- No client-side authority over money, tournament results, prizes, or admin actions
- No fake payment success
- No fake wallet balance
- No security secrets inside client applications

---

# 3. FREE-FIRST DEVELOPMENT RULE

The project should be buildable and testable using free/open-source tools wherever reasonably possible.

## Prefer

- Flutter or another mature cross-platform framework
- Dart/TypeScript/JavaScript/Python depending on architecture
- PostgreSQL
- Supabase free tier where appropriate
- Firebase free-tier services where appropriate
- Cloudflare free services where appropriate
- GitHub
- GitHub Actions free allowance where applicable
- Vercel/Cloudflare Pages/Firebase Hosting for suitable frontend/static workloads
- Open-source icon libraries
- SVG
- Lottie/Rive free/open tooling where licensing permits
- Local development
- Docker
- Open-source testing tools
- Free analytics/self-hosted analytics where practical

## Do NOT design the architecture around mandatory paid SaaS.

If a paid service is optional, create an abstraction layer so it can be replaced.

Examples:

```text
PaymentProvider
 ├── RazorpayProvider
 ├── CashfreeProvider
 └── ManualUPIProvider

NotificationProvider
 ├── FirebaseProvider
 └── WebPushProvider

StorageProvider
 ├── SupabaseStorageProvider
 ├── CloudinaryProvider
 └── LocalDevelopmentStorageProvider
```

The application must run in development without paid credentials.

---

# 4. IMPORTANT PAYMENT / LEGAL RULE

Never assume that because a payment API works technically, the proposed tournament model is legally or contractually permitted.

The system must include:

- jurisdiction configuration
- eligibility rules
- age-gating where applicable
- responsible-gaming controls where applicable
- real-money feature kill switch
- payment-provider enable/disable switch
- withdrawal enable/disable switch
- tournament entry enable/disable switch
- game/category enable/disable switch
- geographic restrictions where legally required
- KYC/verification state
- compliance review state
- terms acceptance version
- privacy policy version
- consent records

Production activation of real-money functionality must be a deliberate Admin/Compliance action.

---

# 5. RECOMMENDED ARCHITECTURE

The AI agent may choose a better current framework after checking official documentation, but the architecture must preserve these requirements.

## Preferred option

### Frontend

**Flutter**

Targets:

- Android
- Web
- Windows/Linux/macOS where practical in future

Alternative:

- React Native / Expo for mobile
- Next.js for web
- Shared TypeScript domain packages

The AI may select another modern framework if it provides a clear technical advantage.

### Backend

Preferred:

- Supabase/PostgreSQL + Edge Functions where practical

Alternative:

- Node.js + TypeScript
- Fastify/NestJS/Express
- PostgreSQL
- Redis only if actually needed

### Authentication

- Email/password
- Phone OTP where provider availability permits
- Google login where appropriate
- Future Apple login
- Secure session management

### Database

PostgreSQL preferred.

Use relational constraints and database transactions for:

- wallets
- ledger
- tournament entries
- prizes
- deposits
- withdrawals
- refunds
- commissions

### Realtime

Use:

- Supabase Realtime
- WebSockets
- Firebase Realtime Database

Choose one according to selected architecture.

---

# 6. NO EMOJIS IN PRODUCT UI

The application UI must NOT use emojis as interface icons.

Do not use:

- emoji buttons
- emoji navigation
- emoji badges
- emoji wallet icons
- emoji game icons

Instead use:

- SVG icons
- custom vector illustrations
- open-source icon systems
- generated assets
- branded game/category artwork where licensing permits

If a visual asset is required and no suitable licensed asset exists, use an AI image/icon generation workflow or create an original vector asset.

The coding agent must inspect available image/design-generation skills and use the appropriate skill/tool when available.

---

# 7. PREMIUM VISUAL DIRECTION

Create a premium esports interface.

Suggested visual language:

- Dark-first interface
- Deep black/navy background
- Electric blue primary accent
- Secondary neon accents
- Glass-like surfaces used carefully
- Soft gradients
- Strong typography
- Large tournament cards
- Compact information hierarchy
- High-contrast status indicators
- Subtle glow
- Smooth micro-interactions
- Professional dashboard
- No childish gaming clutter

Do not overuse neon.

The UI should feel closer to a premium esports platform than a generic gaming template.

---

# 8. ANIMATION SYSTEM

Animations must improve usability rather than slow the application.

Use:

- page transitions
- card entrance animations
- skeleton loading
- wallet transaction feedback
- tournament countdown
- live status transitions
- leaderboard updates
- button interaction
- modal transitions
- expandable sections
- success/error state animation

Avoid:

- continuous unnecessary animations
- huge particle effects
- heavy video backgrounds
- animations that cause low-end Android performance issues

Respect reduced-motion accessibility preferences.

---

# 9. MAIN NAVIGATION

Mobile:

1. Home
2. Tournaments
3. Wallet
4. Rewards
5. Profile

Desktop:

- Left sidebar or adaptive navigation
- Top search
- Notification center
- Wallet summary
- User profile
- Main content area

Additional pages accessible from appropriate locations:

- My Matches
- My Tournaments
- Clan
- Global Chat
- Leaderboards
- Transactions
- Claims/Disputes
- Help Center
- Notifications
- Settings
- Legal
- Security
- Responsible Gaming / Eligibility where applicable

---

# 10. HOME DASHBOARD

Home should contain:

## Header

- Profile
- Notifications
- Wallet balance
- Search

## Hero

- Featured tournament
- Countdown
- Join CTA
- Prize pool
- Entry fee
- Game
- Match time

## Game Categories

Example:

- BGMI
- Free Fire
- COD
- More Games

Admin must be able to add unlimited categories.

## Tournament Sections

- Upcoming
- Live
- Completed

Also:

- Featured
- Recommended
- My Matches
- Recently Joined
- Trending

---

# 11. TOURNAMENT SYSTEM

Every tournament must be data-driven.

Tournament fields:

```text
id
game_id
category_id
title
slug
description
banner
thumbnail
mode
team_size
entry_fee
currency
prize_pool
max_players
current_players
registration_start
registration_end
match_start
estimated_end
status
visibility
rules
scoring_rules
room_release_time
room_id
room_password
spectator_enabled
result_status
payout_status
created_by
created_at
updated_at
```

Statuses:

```text
DRAFT
SCHEDULED
REGISTRATION_OPEN
REGISTRATION_CLOSED
ROOM_PENDING
ROOM_RELEASED
LIVE
RESULT_PENDING
RESULT_REVIEW
COMPLETED
CANCELLED
REFUNDING
REFUNDED
DISPUTED
```

Never rely only on a client-side status.

Server time must control tournament transitions.

---

# 12. TOURNAMENT TYPES

Support:

- 1v1
- 2v2
- Squad
- Duo
- Solo
- Battle Royale
- Custom Room
- Clan vs Clan
- Knockout
- League
- Points table
- Elimination
- Multi-round tournament
- Scheduled recurring tournament
- Free tournament
- Paid tournament
- Promotional tournament

Future tournament formats must be configurable.

---

# 13. GAME CATEGORY SYSTEM

Games must NOT be hard-coded.

Admin can create:

```text
Game
 ├── name
 ├── short_name
 ├── icon
 ├── banner
 ├── description
 ├── active
 ├── supported_modes
 ├── allowed_regions
 ├── minimum_age
 ├── rules
 └── metadata
```

This allows adding future games without application redesign.

---

# 14. TOURNAMENT JOIN FLOW

Example:

```text
Open Tournament
      ↓
Tournament Details
      ↓
Check Eligibility
      ↓
Check Wallet / Entry Requirement
      ↓
Confirm Rules
      ↓
Confirm Entry
      ↓
Server Transaction
      ↓
Tournament Entry Created
      ↓
Entry Confirmation
```

Never deduct money merely because the user clicked a button.

Use an atomic server transaction.

Prevent:

- double join
- double payment
- duplicate entry
- race conditions
- joining after registration closes
- joining after capacity is full

---

# 15. TEAM / CLAN SYSTEM

Users can:

- Create clan
- Join clan
- Request membership
- Invite members
- Remove members
- Promote leader
- Assign co-leader
- Leave clan
- Disband clan
- View clan stats
- Clan leaderboard
- Clan tournaments
- Clan chat

Clan fields:

```text
id
name
tag
logo
owner_id
description
member_limit
status
created_at
```

---

# 16. GLOBAL CHAT

Create real-time global chat.

Features:

- message
- timestamp
- user display name
- avatar
- moderation
- report
- mute
- block
- rate limiting
- spam detection
- profanity filtering
- admin delete
- admin mute
- user block
- pinned announcements

Do not allow unlimited message flooding.

---

# 17. CLAN CHAT

Each clan can have private chat.

Security requirement:

A user must not receive clan messages unless they are authorized members.

Server-side authorization is mandatory.

---

# 18. WALLET ARCHITECTURE

This is one of the most important parts.

DO NOT store only:

```text
user.balance = 1000
```

Instead use an immutable transaction ledger.

Use:

```text
Wallet
WalletAccount
LedgerTransaction
LedgerEntry
Deposit
Withdrawal
BonusGrant
TournamentEntry
PrizePayout
Refund
Commission
Adjustment
```

Recommended conceptual accounts:

```text
DEPOSITED_BALANCE
BONUS_BALANCE
REWARD_BALANCE
WINNINGS_BALANCE
REFUND_BALANCE
LOCKED_BALANCE
WITHDRAWABLE_BALANCE
```

Exact accounting treatment must be confirmed with the applicable business/accounting model.

---

# 19. DOUBLE-ENTRY LEDGER

Every financial event must create a ledger transaction.

Example:

```text
Deposit ₹500

DEPOSIT_CLEARING       +500
USER_DEPOSIT_BALANCE   +500
```

Tournament entry:

```text
USER_DEPOSIT_BALANCE   -100
TOURNAMENT_ESCROW      +100
```

Commission:

```text
TOURNAMENT_ESCROW      -10
PLATFORM_REVENUE       +10
```

Prize:

```text
TOURNAMENT_ESCROW      -90
WINNER_BALANCE         +90
```

Do not modify historical ledger entries.

If an error occurs, create a correcting transaction.

---

# 20. BALANCE TYPES

Separate money by source.

At minimum:

### Deposited Balance

Real-money deposited amount subject to applicable rules.

### Winnings Balance

Prize/winnings balance where legally permitted and eligible.

### Bonus Balance

Promotional balance.

### Reward Balance

Ad/referral/promotional reward balance.

### Locked Balance

Funds temporarily unavailable due to:

- tournament entry
- withdrawal review
- dispute
- fraud review

### Withdrawable Balance

Computed from eligible ledger entries and rules.

Never allow the client to decide whether a balance is withdrawable.

---

# 21. USER'S REQUESTED SPEND RULE

Support configurable rules such as:

```text
Maximum bonus/reward contribution per entry = 20%
Minimum eligible deposited/winnings contribution = 80%
```

But DO NOT hard-code 70/80/95 percentages.

Create an Admin configuration:

```text
bonus_usage_enabled
bonus_usage_percentage
deposit_usage_percentage
reward_usage_percentage
minimum_real_balance_requirement
```

The exact values must be configurable and subject to applicable terms/compliance.

---

# 22. DEPOSIT SYSTEM

Support multiple providers through an abstraction.

## Provider A

Razorpay

## Provider B

Cashfree

## Provider C

Manual UPI

## Future

Other providers.

Never couple wallet logic directly to one provider.

---

# 23. AUTOMATIC PAYMENT FLOW

```text
User enters amount
       ↓
Server creates payment order
       ↓
Payment provider checkout
       ↓
Provider processes payment
       ↓
Webhook/server verification
       ↓
Signature verification
       ↓
Idempotency check
       ↓
Ledger transaction
       ↓
Wallet balance becomes available
       ↓
User notification
```

Never credit the wallet only because the frontend reports success.

---

# 24. MANUAL UPI FLOW

User enters:

```text
₹ amount
```

Then app shows:

- UPI ID
- QR code
- Copy UPI ID
- Pay button/deep link where supported
- Payment instructions
- Unique deposit reference

Then:

```text
User pays
   ↓
User returns
   ↓
Submit UTR
   ↓
Upload proof optionally
   ↓
Deposit becomes PENDING
   ↓
Admin reviews
   ↓
Approve / Reject / Request Evidence
   ↓
If approved:
ledger credit
   ↓
wallet updated
```

Never trust the UTR by itself.

Prevent:

- duplicate UTR
- reused UTR
- amount mismatch
- suspicious frequency
- duplicate screenshots
- fake proof
- same payment submitted to multiple accounts

Create reconciliation tools.

---

# 25. DEPOSIT RECORD

Fields:

```text
id
user_id
amount
currency
provider
provider_order_id
provider_payment_id
utr
status
submitted_at
verified_at
verified_by
proof_url
risk_score
failure_reason
notes
created_at
updated_at
```

Statuses:

```text
CREATED
PAYMENT_PENDING
PAYMENT_SUCCESS
PENDING_REVIEW
APPROVED
REJECTED
REFUNDED
EXPIRED
FLAGGED
```

---

# 26. WITHDRAWAL SYSTEM

Support:

- withdrawal request
- available balance calculation
- minimum withdrawal
- maximum withdrawal
- daily limit
- monthly limit
- fee
- slab
- processing time
- status
- admin review
- KYC requirement
- bank/UPI destination
- audit history

Example configurable slab:

```text
₹50–₹499      = ₹X or X%
₹500–₹1,999   = X%
₹2,000–₹9,999 = X%
₹10,000+      = X%
```

Do not hard-code these values.

---

# 27. WITHDRAWAL FLOW

```text
User requests withdrawal
        ↓
Server checks eligibility
        ↓
KYC/identity check
        ↓
Balance check
        ↓
Risk/fraud checks
        ↓
Fee calculation
        ↓
Funds locked
        ↓
Withdrawal created
        ↓
Admin/provider processing
        ↓
Success / Failed / Reversed
        ↓
Ledger finalization
```

If failed:

```text
locked funds → released/reversed through ledger
```

Never silently delete a withdrawal.

---

# 28. ADMIN COMMISSION ENGINE

Admin can configure:

- tournament commission %
- entry commission
- prize deduction
- withdrawal fee
- withdrawal slab
- payment fee handling
- promotional contribution
- refund policy
- cancellation fee
- tax-related configurable metadata where applicable

All configuration changes must be audited.

Do not overwrite historical transaction calculations.

Each transaction should store the applied rule/version.

---

# 29. REWARDS SYSTEM

Reward sources:

- daily login
- referral
- tournament participation
- promotional campaigns
- achievement
- verified milestone
- ad reward
- event reward
- admin grant

Each reward must have:

```text
source
amount
expiry
usage restriction
withdrawability
campaign_id
created_at
```

---

# 30. REWARDED ADS

IMPORTANT:

Do not implement "Google AdSense inside Android app" as if AdSense were the native mobile rewarded-ad SDK.

Use the appropriate Google advertising product for the target platform and current policy.

For Android, research and use the current **Google Mobile Ads / AdMob rewarded-ad implementation** where eligible.

For Web, use a web-appropriate advertising implementation only if the product, placement, reward model, and policy permit it.

Before production:

- check current Google policy
- check rewarded-ad policy
- check real-money gaming policy
- check age/consent requirements
- check app-store policy
- check provider eligibility

Rewarded ad flow:

```text
User opts in
     ↓
Ad loads
     ↓
Ad completed according to provider callback
     ↓
Server verifies reward event where possible
     ↓
Reward ledger transaction
     ↓
Non-withdrawable reward balance
```

Never award money simply because the frontend says "ad watched."

---

# 31. REWARD ANTI-ABUSE

Add:

- daily reward cap
- session cap
- cooldown
- device risk
- account risk
- repeated account detection
- suspicious ad completion detection
- referral abuse detection
- multi-account detection
- velocity checks

---

# 32. REFERRAL SYSTEM

Configurable referral system:

```text
Referral code
Referral link
Referral signup
Qualification event
Reward
Reward expiry
Maximum reward
Campaign
```

Never reward merely for creating unlimited accounts.

---

# 33. TOURNAMENT ROOM SYSTEM

Admin can configure:

- room ID
- password
- room release time
- match time
- server/region
- map
- mode
- spectator rules

Room credentials should:

- remain hidden until authorized
- be encrypted/protected where appropriate
- never appear in public tournament listing
- be visible only to eligible participants
- automatically hide after tournament end if configured

---

# 34. RESULTS SYSTEM

Support:

- manual result
- screenshot evidence
- score entry
- placement
- kills
- points
- round result
- dispute
- admin review
- correction
- finalization

Future:

- game API integrations where officially available
- automated result verification

Never assume unofficial game APIs are stable or permitted.

---

# 35. LEADERBOARDS

Support:

- global
- weekly
- monthly
- seasonal
- game-specific
- tournament-specific
- clan
- friends

Metrics:

- matches
- wins
- kills
- points
- earnings where legally appropriate
- participation
- rank

Leaderboard calculations must be server-side.

---

# 36. CLAIM / DISPUTE SYSTEM

Create a formal support/claim system.

User can create:

- payment claim
- missing deposit claim
- wrong result claim
- prize claim
- tournament cancellation claim
- refund claim
- technical issue
- cheating report
- account issue

Ticket fields:

```text
ticket_id
category
priority
user
related_transaction
related_tournament
description
attachments
status
assigned_admin
internal_notes
created_at
updated_at
resolution
```

Statuses:

```text
OPEN
IN_REVIEW
WAITING_USER
WAITING_ADMIN
RESOLVED
REJECTED
CLOSED
```

---

# 37. ANTI-CHEAT / FAIR PLAY

Build platform-level controls:

- suspicious account detection
- duplicate account detection
- device fingerprinting where legally appropriate
- IP/risk signals where appropriate
- unusual join patterns
- abnormal win-rate alerts
- repeated withdrawal patterns
- result dispute history
- admin investigation tools

Do not claim that platform-level controls can detect all game cheats.

Allow:

- report player
- report match
- evidence upload
- investigation
- temporary suspension
- permanent ban
- appeal

---

# 38. NOTIFICATION SYSTEM

Support:

- push notifications
- in-app notifications
- email where available
- web notifications where supported

Events:

- tournament reminder
- room released
- match starting
- result published
- prize credited
- deposit approved
- deposit rejected
- withdrawal update
- claim update
- clan invite
- referral reward
- maintenance
- announcement

Allow notification preferences.

---

# 39. PROFILE SYSTEM

Profile:

- avatar
- username
- unique player ID
- verified status
- joined date
- game IDs
- tournament statistics
- clan
- achievements
- transaction summary
- security
- notification settings
- privacy settings

Legal pages accessible from profile:

- Terms
- Privacy
- Refund Policy
- Tournament Rules
- Responsible Gaming / Eligibility
- Payment Policy
- Withdrawal Policy
- Community Rules
- Contact
- Grievance/support information where applicable

Admin controls all published legal/content versions.

---

# 40. AUTHENTICATION & SECURITY

Implement:

- secure authentication
- password hashing
- session expiry
- refresh tokens where appropriate
- MFA for admins
- device/session management
- login history
- suspicious login alerts
- account lockout/rate limiting
- CAPTCHA/risk controls where necessary

Never store:

- plaintext passwords
- payment secrets
- API secret keys
- admin secrets

inside client code.

---

# 41. ADMIN PANEL

Admin panel is a first-class product.

Dashboard:

- users
- active users
- tournaments
- live matches
- deposits
- withdrawals
- revenue
- commission
- pending claims
- fraud alerts
- system health
- notification queue

---

# 42. ADMIN TOURNAMENT MANAGER

Admin can:

- create
- edit
- duplicate
- archive
- cancel
- pause
- reopen
- publish
- schedule
- set entry fee
- set prize pool
- configure slots
- configure game
- configure mode
- set room
- release room
- upload banner
- configure rules
- configure scoring
- assign moderators
- publish results
- trigger refunds

---

# 43. ADMIN USER MANAGEMENT

Admin can:

- search
- filter
- view
- suspend
- ban
- unban
- verify
- reset account
- view sessions
- view tournament history
- view wallet ledger
- view deposits
- view withdrawals
- view claims
- view risk signals

Never allow arbitrary balance editing.

Instead:

```text
Manual Adjustment
    ↓
Reason required
    ↓
Admin identity
    ↓
Approval if sensitive
    ↓
Ledger transaction
    ↓
Audit log
```

---

# 44. ADMIN ROLES

Create granular roles:

```text
SUPER_ADMIN
FINANCE_ADMIN
TOURNAMENT_ADMIN
SUPPORT_ADMIN
MODERATOR
CONTENT_ADMIN
RISK_ADMIN
ANALYST
```

Permissions should be configurable.

Example:

```text
VIEW_USERS
EDIT_USERS
CREATE_TOURNAMENT
EDIT_TOURNAMENT
CANCEL_TOURNAMENT
VIEW_DEPOSITS
APPROVE_DEPOSIT
VIEW_WITHDRAWALS
APPROVE_WITHDRAWAL
CONFIGURE_FEES
VIEW_LEDGER
CREATE_ADJUSTMENT
MODERATE_CHAT
MANAGE_LEGAL_CONTENT
VIEW_ANALYTICS
MANAGE_ROLES
```

---

# 45. SUPER ADMIN PROTECTION

Super admin must have:

- MFA
- secure session
- IP/device alerts
- sensitive-action confirmation
- audit log
- optional approval workflow
- emergency disable switch

---

# 46. AUDIT LOG

Every sensitive action must create:

```text
actor
role
action
resource
resource_id
before
after
timestamp
IP/risk metadata where appropriate
reason
request_id
```

Audit logs should be append-only.

---

# 47. ADMIN GLOBAL SETTINGS

Create configuration categories:

### General

- app name
- logo
- support email
- maintenance mode

### Tournament

- default registration time
- max tournament size
- cancellation rules

### Wallet

- minimum deposit
- maximum deposit
- minimum withdrawal
- maximum withdrawal
- withdrawal slabs

### Commission

- default commission
- per-game commission
- per-tournament override

### Rewards

- daily reward
- referral reward
- ad reward
- reward caps

### Security

- rate limits
- suspicious activity thresholds

### Notifications

- templates
- channels

### Legal

- terms version
- privacy version
- refund policy version

---

# 48. ANALYTICS

Admin analytics:

- DAU/WAU/MAU
- registrations
- tournament participation
- game popularity
- tournament fill rate
- cancellation rate
- deposit volume
- withdrawal volume
- pending withdrawals
- commission
- refunds
- rewards
- ad reward activity
- referral activity
- support tickets
- fraud flags

Do not expose sensitive personal data unnecessarily.

---

# 49. SEARCH & FILTER

Global search:

- tournaments
- games
- players
- clans
- transaction IDs
- tickets

Filters:

- game
- entry fee
- date
- status
- prize pool
- tournament type
- team size

---

# 50. PERFORMANCE REQUIREMENTS

Target:

- fast first screen
- optimized images
- lazy loading
- pagination
- caching
- skeleton states
- minimal network requests
- compressed assets
- efficient database indexes
- realtime only where needed
- background processing where appropriate

Avoid loading thousands of records at once.

---

# 51. OFFLINE / ERROR EXPERIENCE

Handle:

- no internet
- timeout
- server error
- payment pending
- payment unknown
- duplicate request
- maintenance
- expired tournament
- full tournament
- session expired

Never show a false "success" state.

Example:

```text
Payment status: Verification pending

Do not retry blindly.
Reference: DEP-XXXX
```

---

# 52. IDEMPOTENCY

Mandatory for:

- payment confirmation
- deposit approval
- withdrawal creation
- prize payout
- refund
- tournament join
- reward grant
- admin adjustment

Use idempotency keys.

A repeated request must not create duplicate money movement.

---

# 53. DATABASE DESIGN

Create normalized relational tables similar to:

```text
users
profiles
roles
permissions
user_roles
games
game_modes
tournaments
tournament_rounds
tournament_entries
teams
team_members
clans
clan_members
wallets
ledger_transactions
ledger_entries
deposits
withdrawals
payment_orders
payment_events
prizes
refunds
commissions
reward_campaigns
reward_grants
ad_reward_events
referrals
chat_channels
chat_members
chat_messages
chat_reports
notifications
claims
claim_messages
attachments
kyc_records
risk_events
audit_logs
legal_documents
legal_acceptances
admin_settings
feature_flags
support_agents
```

Add indexes based on actual query patterns.

---

# 54. API DESIGN

Use versioned APIs:

```text
/api/v1/auth
/api/v1/users
/api/v1/games
/api/v1/tournaments
/api/v1/entries
/api/v1/wallet
/api/v1/deposits
/api/v1/withdrawals
/api/v1/payments
/api/v1/rewards
/api/v1/referrals
/api/v1/clans
/api/v1/chat
/api/v1/claims
/api/v1/notifications
/api/v1/admin
```

Use consistent response format:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "requestId": "..."
}
```

Errors:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "TOURNAMENT_FULL",
    "message": "This tournament is full."
  },
  "requestId": "..."
}
```

Never expose stack traces in production.

---

# 55. CONFIGURATION

Use environment variables for:

```text
DATABASE_URL
AUTH_SECRET
PAYMENT_KEY
PAYMENT_SECRET
RAZORPAY_KEY
RAZORPAY_SECRET
CASHFREE_APP_ID
CASHFREE_SECRET
STORAGE_KEY
PUSH_CONFIG
ANALYTICS_CONFIG
```

Provide:

```text
.env.example
```

Do not commit real secrets.

---

# 56. DEVELOPMENT MODES

Create:

### Demo Mode

No real money.

Use fake credits.

### Sandbox Mode

Payment provider sandbox/test environment.

### Production Mode

Only activated after compliance checks and secret configuration.

Use feature flags.

---

# 57. FEATURE FLAGS

Examples:

```text
REAL_MONEY_ENABLED
WITHDRAWAL_ENABLED
MANUAL_UPI_ENABLED
RAZORPAY_ENABLED
CASHFREE_ENABLED
REWARDED_ADS_ENABLED
REFERRALS_ENABLED
CLANS_ENABLED
GLOBAL_CHAT_ENABLED
KYC_ENABLED
```

Admin cannot bypass backend security through UI.

---

# 58. RESPONSIVE DESIGN

Mobile:

- bottom navigation
- full-screen cards
- thumb-friendly controls
- bottom sheets
- compact tables

Desktop:

- sidebar
- multi-column dashboard
- data tables
- expanded filters
- keyboard navigation

Tablet:

- adaptive layout

Never simply stretch the mobile layout to desktop.

---

# 59. ACCESSIBILITY

Include:

- readable typography
- contrast
- semantic labels
- screen reader support
- keyboard navigation on web
- focus states
- touch targets
- reduced motion
- error descriptions

---

# 60. ASSET SYSTEM

Create an asset strategy.

Folders:

```text
assets/
  icons/
  logos/
  games/
  tournaments/
  backgrounds/
  illustrations/
  animations/
```

Use optimized:

- SVG
- WebP
- AVIF where supported
- compressed PNG only when necessary

Do not use copyrighted game artwork without appropriate permission/licensing.

---

# 61. AI-GENERATED ASSETS

If the AI environment has image/design-generation capabilities:

- inspect available skills
- use the relevant skill
- generate original visual assets
- keep consistent visual language
- do not generate copyrighted logos pretending to be official
- do not create misleading official game branding

Use generated assets for:

- generic esports backgrounds
- abstract tournament graphics
- original icons
- empty states
- achievement art

---

# 62. SEARCH / DISCOVERY

Add:

- game search
- tournament search
- filters
- sorting
- favorites
- recently viewed
- recommended tournaments

Future AI recommendation engine should be optional.

---

# 63. FAVORITES

Users can favorite:

- games
- tournaments
- clans

Use favorites to improve discovery.

---

# 64. CALENDAR

Allow:

- tournament calendar
- upcoming matches
- reminders
- add-to-calendar future feature

---

# 65. COUNTDOWN

Tournament countdown must use server time.

Show:

```text
Registration closes in
Match starts in
Room opens in
```

Do not trust device clock.

---

# 66. PAYMENT HISTORY

User can see:

- deposits
- withdrawals
- tournament entries
- winnings
- refunds
- commissions where applicable
- rewards

Every entry should link to a transaction detail page.

---

# 67. TRANSACTION DETAIL

Show:

```text
Transaction ID
Date
Type
Amount
Status
Reference
Related tournament
Payment provider
Fee
Net amount
```

Never expose internal secrets.

---

# 68. REFUND ENGINE

Support:

- tournament cancelled
- match not started
- technical failure
- duplicate entry
- approved dispute

Refunds must be ledger transactions.

Never simply add balance without a corresponding financial record.

---

# 69. TOURNAMENT CANCELLATION

When cancelled:

```text
Freeze tournament
Stop new entries
Calculate eligible refunds
Create refund transactions
Notify users
Close tournament
Audit action
```

---

# 70. FRAUD / RISK ENGINE

Build a rule-based risk engine.

Signals:

- repeated failed payments
- duplicate UTR
- multiple accounts
- unusual deposit frequency
- unusual withdrawal frequency
- suspicious device patterns
- rapid account creation
- referral abuse
- unusual tournament patterns

Risk levels:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

High-risk actions can require manual review.

---

# 71. SUPPORT CENTER

Include:

- FAQ
- ticket creation
- ticket history
- payment help
- tournament help
- wallet help
- account help
- report player
- report match

---

# 72. ADMIN COMMUNICATION

Admin can publish:

- announcements
- maintenance notices
- tournament notices
- emergency alerts

Support:

- in-app banner
- notification
- modal
- push where supported

---

# 73. MULTI-LANGUAGE READY

Initially:

- English
- Hindi
- Gujarati

Architecture must support future languages.

Never hard-code UI strings directly inside business logic.

Use localization files.

---

# 74. TIMEZONE

Store timestamps in UTC.

Display using user/admin timezone.

Tournament calculations must use server time.

---

# 75. SECURITY CHECKLIST

Implement:

- HTTPS
- secure headers
- CORS policy
- CSRF protection where applicable
- input validation
- output encoding
- SQL injection prevention
- XSS protection
- rate limiting
- abuse prevention
- secure file uploads
- file type validation
- file size limits
- authorization checks
- server-side validation
- secrets management
- dependency scanning
- audit logging

---

# 76. FILE UPLOAD SECURITY

For screenshots/proofs:

- whitelist file types
- validate MIME
- validate file signatures where practical
- size limits
- image reprocessing
- malware scanning where available
- private storage
- signed URLs
- access control

---

# 77. PRIVACY

Collect minimum required data.

Allow users to:

- view privacy settings
- manage sessions
- request account deletion where legally applicable
- access relevant data
- control notifications

Do not expose private user data through public APIs.

---

# 78. LEGAL CONTENT ENGINE

Legal content should be versioned.

Each acceptance stores:

```text
document
version
user
timestamp
IP/session metadata where appropriate
```

Documents:

- Terms
- Privacy
- Refund
- Tournament Rules
- Payment Policy
- Withdrawal Policy
- Community Guidelines
- Responsible Gaming/Eligibility

---

# 79. APP STORE / DISTRIBUTION READINESS

Before release, the AI must research current:

- Google Play policies
- Apple App Store policies if iOS is added
- Google advertising policies
- payment-provider terms
- applicable Indian regulations
- game publisher tournament/community rules

Do not state that compliance is guaranteed.

Create a release checklist requiring human/legal/provider verification.

---

# 80. FREE HOSTING STRATEGY

Create a development deployment path using free tiers where possible.

Example:

```text
Frontend
→ Vercel / Cloudflare Pages / Firebase Hosting

Backend
→ Supabase / suitable free-tier backend

Database
→ PostgreSQL / Supabase

Storage
→ Supabase Storage / Cloudinary free tier if appropriate

Auth
→ Supabase Auth / Firebase Auth

Realtime
→ Supabase Realtime / Firebase

Source Control
→ GitHub

CI
→ GitHub Actions

Android Build
→ Local Flutter/Android build tools
```

The AI must verify current free-tier limits before choosing a production architecture.

Never claim "100% free forever."

Free tiers can change.

---

# 81. COST CONTROL

Build with:

- pagination
- caching
- optimized queries
- image compression
- rate limiting
- batched notifications
- minimal realtime subscriptions
- cleanup jobs
- database indexes

Admin dashboard should show usage where provider APIs make that possible.

---

# 82. OBSERVABILITY

Add:

- structured logs
- request IDs
- error tracking
- payment event logs
- webhook logs
- audit logs
- system health
- database health
- job failures

Never log:

- passwords
- payment secrets
- private authentication tokens
- unnecessary sensitive information

---

# 83. BACKUPS

Plan:

- database backups
- backup verification
- restore test
- export tools
- disaster recovery procedure

A backup that has never been restored is not considered verified.

---

# 84. TESTING

Create tests for:

## Unit

- commission calculation
- withdrawal slab
- reward calculation
- eligibility
- tournament status
- wallet rules

## Integration

- payment order
- webhook
- UTR submission
- deposit approval
- withdrawal
- tournament join
- refund
- prize distribution

## Security

- authorization
- duplicate request
- race conditions
- privilege escalation
- invalid input

## UI

- mobile
- tablet
- desktop
- accessibility

---

# 85. CRITICAL MONEY TESTS

The AI must specifically test:

1. Double-click join
2. Two devices joining simultaneously
3. Duplicate payment webhook
4. Duplicate UTR
5. Same UTR for different users
6. Failed payment after order creation
7. Successful payment but delayed webhook
8. Withdrawal during tournament lock
9. Tournament cancellation
10. Prize payout retry
11. Admin adjustment retry
12. Refund retry
13. Network interruption during payment
14. User closes app during payment
15. Server restart during transaction

No test should create duplicate money movement.

---

# 86. ADMIN SIMULATION MODE

Create an admin-only test/sandbox mode where admins can simulate:

- deposit success
- deposit failure
- withdrawal success
- withdrawal failure
- tournament cancellation
- prize distribution
- refund

Simulation must never touch production financial balances.

---

# 87. SEED DATA

Create safe demo data:

Games:

- BGMI
- Free Fire
- COD

Tournament examples:

- 1v1
- Duo
- Squad
- Battle Royale

Use clearly marked demo/sandbox data.

---

# 88. DESIGN SYSTEM

Create centralized:

```text
Colors
Typography
Spacing
Radius
Elevation
Icons
Buttons
Inputs
Cards
Dialogs
Bottom Sheets
Navigation
Badges
Tables
Charts
Skeletons
Toasts
```

Do not duplicate styling everywhere.

---

# 89. COMPONENT SYSTEM

Create reusable components:

```text
GameCard
TournamentCard
TournamentStatusBadge
PrizePoolCard
WalletCard
TransactionRow
UserAvatar
ClanCard
LeaderboardRow
NotificationItem
ClaimCard
AdminDataTable
AdminFilterBar
StatCard
ConfirmDialog
LoadingState
EmptyState
ErrorState
```

---

# 90. MOBILE UX DETAILS

Optimize for one-handed use.

Use:

- bottom sheets
- sticky CTA
- thumb-friendly controls
- large join button
- clear entry fee
- clear prize
- clear timing
- short content blocks

Never hide critical financial information.

---

# 91. DESKTOP UX DETAILS

Use:

- multi-column layouts
- data tables
- side navigation
- keyboard navigation
- command/search interface in future
- dashboard charts
- bulk actions for admin

---

# 92. FUTURE FEATURE ROADMAP

Architecture must support:

### Phase Future 1

- iOS
- Windows native client
- macOS client

### Phase Future 2

- automated game-result integrations
- esports API integrations
- advanced anti-cheat

### Phase Future 3

- live tournament streaming
- OBS integration
- spectator mode
- embedded streams

### Phase Future 4

- creator/organizer accounts
- tournament marketplace
- organizer verification
- organizer analytics

### Phase Future 5

- sponsorship system
- branded tournaments
- advertisements
- campaign management

### Phase Future 6

- season pass
- achievements
- badges
- player progression

### Phase Future 7

- AI tournament recommendations
- AI support assistant
- automated moderation
- fraud-risk ML

### Phase Future 8

- esports team profiles
- player statistics
- scouting profiles
- public player pages

---

# 93. SMART FEATURES TO ADD

Add these if they do not unnecessarily increase MVP complexity:

- tournament favorites
- reminder notifications
- player verification
- match history
- achievements
- referral dashboard
- seasonal rankings
- clan rankings
- organizer profiles
- tournament templates
- duplicate tournament feature
- emergency tournament pause
- mass notification
- CSV export
- financial reconciliation export
- admin approval queues
- fraud review queue
- system maintenance mode
- feature flags
- announcement center

---

# 94. FUTURE AI FEATURES

Do not make AI mandatory for core operation.

Optional future:

- AI support assistant
- AI tournament recommendation
- AI moderation
- AI fraud detection
- AI result evidence assistance
- AI analytics summaries
- AI-generated tournament banners

All AI features must have human override.

---

# 95. DEVELOPMENT PHASES

## PHASE 0 — RESEARCH

Before coding:

1. Inspect repository.
2. Inspect installed skills/tools.
3. Inspect current framework versions.
4. Check official payment documentation.
5. Check current advertising documentation.
6. Check current app-store rules.
7. Check relevant gaming/payment/legal requirements.
8. Decide architecture.
9. Document decisions.

Do not blindly use outdated tutorials.

---

# 96. PHASE 1 — FOUNDATION

Build:

- project
- design system
- routing
- authentication
- user profile
- game categories
- tournament data model
- database
- basic admin authentication

Acceptance:

- user can register
- user can login
- admin can login
- games display
- tournaments display
- responsive UI works

---

# 97. PHASE 2 — TOURNAMENT ENGINE

Build:

- tournament creation
- tournament listing
- upcoming
- live
- completed
- tournament details
- join
- team/clan registration
- server-side status transitions

Acceptance:

- users can safely join demo tournaments
- duplicate joining impossible
- tournament capacity enforced

---

# 98. PHASE 3 — WALLET LEDGER

Build:

- wallet
- ledger
- transaction history
- deposit
- bonus
- refund
- locked balance
- withdrawable balance calculation

Acceptance:

- every balance change has ledger entry
- no direct client balance mutation
- double-entry transaction tests pass

---

# 99. PHASE 4 — PAYMENTS

Implement:

- payment abstraction
- Razorpay adapter
- Cashfree adapter
- manual UPI
- webhook
- UTR
- reconciliation
- idempotency

Initially run only in sandbox/test mode.

Acceptance:

- duplicate webhook cannot duplicate balance
- manual UTR cannot be reused
- failed payment does not credit wallet

---

# 100. PHASE 5 — WITHDRAWALS

Build:

- withdrawal request
- slab engine
- fee calculation
- eligibility
- KYC state
- admin review
- payout integration abstraction
- reversal

Production withdrawal must remain disabled until compliance/provider approval.

---

# 101. PHASE 6 — SOCIAL

Build:

- global chat
- clan
- clan chat
- player profile
- leaderboard
- notifications

---

# 102. PHASE 7 — REWARDS

Build:

- referral
- bonus
- campaigns
- rewarded ads
- reward ledger
- anti-abuse

Do not connect real ad rewards until policy/eligibility checks pass.

---

# 103. PHASE 8 — ADMIN

Build:

- dashboard
- users
- tournaments
- payments
- wallet
- withdrawals
- claims
- moderation
- settings
- analytics
- audit logs

---

# 104. PHASE 9 — SECURITY

Run:

- dependency audit
- permission audit
- authorization tests
- payment tests
- race-condition tests
- file-upload tests
- rate-limit tests
- secret scan
- database policy review

---

# 105. PHASE 10 — PERFORMANCE

Test:

- low-end Android
- slow network
- high tournament count
- high chat activity
- large transaction history
- admin tables
- concurrent tournament joins

Optimize based on measurement.

---

# 106. PHASE 11 — RELEASE

Prepare:

- Android release build
- Web production build
- environment variables
- privacy/legal pages
- store assets
- screenshots
- release notes
- monitoring
- backup
- rollback plan

---

# 107. FINAL MASTER AUDIT

Before declaring "COMPLETE", perform all of the following:

## Functional

- Every button works
- Every route works
- Every form validates
- Every API is connected
- Every database query works
- Admin permissions work

## Financial

- Deposit works
- Manual UPI works
- UTR workflow works
- Duplicate UTR blocked
- Payment webhook idempotent
- Wallet ledger correct
- Commission correct
- Withdrawal slab correct
- Refund correct
- Prize payout correct

## Tournament

- Create
- Join
- Capacity
- Schedule
- Room release
- Live
- Results
- Prize
- Cancellation
- Refund

## Social

- Global chat
- Clan
- Clan chat
- Reports
- Moderation

## Security

- Authorization
- Authentication
- Rate limits
- File security
- Secrets
- Admin MFA
- Audit logs

## UX

- Android
- Mobile web
- Tablet
- Desktop
- Accessibility
- Dark mode
- Loading states
- Error states

## Performance

- startup
- network
- database
- images
- realtime
- memory

---

# 108. "DO NOT DECLARE COMPLETE" RULE

The AI agent MUST NOT say:

> "The application is complete."

until:

1. All planned phases are implemented.
2. Automated tests pass.
3. Critical money-flow tests pass.
4. Security review passes.
5. Responsive UI review passes.
6. Production build succeeds.
7. Admin workflow is tested.
8. Payment sandbox workflow is tested.
9. Database policies are reviewed.
10. Documentation is updated.
11. Known limitations are listed.
12. Compliance-dependent production features are clearly marked as disabled/not approved until verified.

---

# 109. SKILL / TOOL ROUTING RULE

At the beginning of every phase:

1. Inspect available skills/tools.
2. Find the skill relevant to the current task.
3. Read its instructions.
4. Use that specialized skill/tool for the task.
5. Do not invent tool workflows when an installed skill already exists.

Examples:

```text
UI/design → design/Figma/Canva skill
Backend/database → Supabase skill
Deployment → Vercel/deployment skill
Next.js → Next.js skill
Documentation → Notion/document skill
Research → research/web tools
Image generation → image generation skill/tool
Testing/browser → browser verification skill
```

If no relevant skill exists, use the most reliable available engineering method.

---

# 110. AI CODING AGENT BEHAVIOR

You are not merely generating sample code.

You are acting as:

- Product architect
- UI/UX engineer
- Backend engineer
- Database engineer
- Security engineer
- QA engineer
- DevOps engineer
- Payment integration engineer
- Tournament-system engineer

For each implementation:

```text
PLAN
→ IMPLEMENT
→ RUN/VERIFY
→ TEST
→ FIX
→ RECHECK
→ DOCUMENT
```

Never stop after generating code.

---

# 111. SOURCE OF TRUTH RULE

Do not assume the user's message is always technically accurate.

If the user requests:

- outdated framework
- deprecated API
- incorrect ad product
- unsafe payment design
- insecure wallet design

correct the architecture while preserving the user's business goal.

Example:

If the request says "AdSense rewarded ads inside Android":

Do not blindly implement it.

Research the current appropriate Google advertising product and use the correct implementation.

---

# 112. NO MOCKING IN PRODUCTION

Mock data may be used in:

```text
development
demo
sandbox
```

but production paths must connect to real backend services.

Never leave:

- fake payment success
- fake wallet
- fake withdrawal
- fake admin approval
- fake tournament result

in production.

---

# 113. DATA OWNERSHIP

The backend/database is the source of truth.

Client only displays server state.

Server controls:

- money
- tournament eligibility
- entry
- prizes
- withdrawals
- commissions
- rewards
- permissions
- room access

---

# 114. CONCURRENCY

Design for simultaneous users.

Example:

100 users attempt the last 5 slots.

Database transaction must guarantee:

```text
max_players cannot be exceeded
```

No negative balances.

No duplicate entries.

No duplicate prizes.

---

# 115. FUTURE MULTI-TENANT SUPPORT

Keep the architecture extensible for:

```text
Platform
 ├── Organizer
 │     ├── tournaments
 │     ├── players
 │     └── analytics
```

Future organizers could manage their own tournaments without changing the core system.

---

# 116. FUTURE WHITE-LABEL

Architecture should eventually support:

```text
Brand
Logo
Theme
Domain
Payment configuration
Games
Tournament rules
```

Do not implement full white-label MVP unless it is easy and safe.

---

# 117. FUTURE API / PARTNER SYSTEM

Prepare future API architecture for:

- tournament organizers
- sponsors
- game statistics providers
- streaming providers
- external communities

Use API keys/scopes later.

---

# 118. FUTURE WEBHOOK ENGINE

Create a generic event system:

```text
TournamentCreated
TournamentStarted
TournamentCompleted
PaymentReceived
DepositApproved
WithdrawalCreated
WithdrawalCompleted
PrizeDistributed
ClaimCreated
UserSuspended
```

This makes future integrations easier.

---

# 119. FUTURE EVENT BUS

If scale requires it, introduce:

- queue
- worker
- event bus
- retry policy
- dead-letter queue

Do not add complex infrastructure before it is justified.

---

# 120. FINAL OUTPUT EXPECTED FROM THE AI CODING AGENT

At the end provide:

```text
1. Architecture
2. Technology choices
3. Project structure
4. Database schema
5. API documentation
6. Environment variables
7. Installation steps
8. Development commands
9. Test commands
10. Build commands
11. Deployment steps
12. Security checklist
13. Payment configuration
14. Admin guide
15. User guide
16. Known limitations
17. Compliance-dependent features
18. Future roadmap
19. Final QA report
```

---

# 121. MASTER EXECUTION COMMAND

Use this as the final instruction to the AI coding agent:

> **BUILD THIS PRODUCT AS A REAL, TESTED, PRODUCTION-READY SYSTEM — NOT A UI MOCKUP.**
>
> Start by inspecting the available skills, tools, repository, framework versions, and current official documentation. Choose the best free/open-source-first architecture that satisfies Android + responsive Web + future scalability. Do not blindly follow an outdated framework or API.
>
> Build the application phase-by-phase using the specification above.
>
> At every phase:
>
> **Research → Plan → Implement → Run → Test → Fix → Re-test → Document.**
>
> Use specialized installed skills whenever applicable.
>
> The backend must be authoritative for all financial, tournament, reward, permission, and security decisions.
>
> Use an immutable ledger and transactional/idempotent financial architecture.
>
> Never trust client-side payment success, balance values, tournament status, or admin permissions.
>
> Build payment providers behind an abstraction layer.
>
> Build Manual UPI + UTR as a pending/reconciliation workflow, not instant trusted credit.
>
> Keep real-money features behind feature flags and compliance gates.
>
> Build the complete admin panel with granular RBAC and audit logging.
>
> Make the UI premium, responsive, animated, accessible, and emoji-free.
>
> Use original/custom/vector assets or properly licensed assets.
>
> Optimize for low-end Android devices and slow networks.
>
> Use free/open-source resources whenever possible and avoid unnecessary paid dependencies.
>
> Do not claim any third-party service is free forever; verify current limits.
>
> Do not claim legal or app-store compliance without verification.
>
> Do not declare the project complete until the final audit and critical financial tests pass.
>
> If something cannot safely or legally be implemented without external approval, implement the correct abstraction/configuration and clearly mark the production feature as disabled pending approval.
>
> **The final result must be a maintainable, scalable, secure Gen B Tournaments platform that can evolve from an MVP into a large multi-game esports platform without rewriting the core financial, tournament, or user architecture.**

---

# 122. FINAL "FUTURE EVERYTHING" CHECKLIST

The architecture should leave room for:

- Android
- Web
- PWA
- iOS
- Windows
- macOS
- Linux
- multiple games
- multiple tournament formats
- multiple organizers
- clans
- teams
- leagues
- seasons
- rankings
- player profiles
- streaming
- sponsorships
- advertisements
- referrals
- rewards
- campaigns
- AI assistance
- automated moderation
- fraud detection
- game-result integrations
- payment gateways
- manual payments
- automated payouts
- KYC
- analytics
- webhooks
- APIs
- multi-language
- multi-region
- multi-currency architecture
- white-label
- partner ecosystem

---

# 123. NON-NEGOTIABLE QUALITY STANDARD

The application must feel:

**Premium + Fast + Secure + Reliable + Scalable + Professional + Mobile-first + Future-ready.**

It must NOT feel like:

- a template
- a demo
- a static HTML mockup
- a fake wallet
- a fake payment application
- a basic CRUD dashboard
- an unfinished prototype

Build it as a real software product.

---

# END OF MASTER PROMPT
