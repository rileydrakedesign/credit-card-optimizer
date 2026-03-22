# GOAL

Build an MVP web app where a user uploads one or more bank CSV files of transactions and the app:

1) Parses and normalizes transactions into a consistent internal schema.
2) Categorizes spending into understandable categories and shows:
   - totals by category
   - percentages by category
   - date range covered
   - total spend included vs excluded
3) Recommends credit cards based on the user's spending habits using /data/cards.json as the ONLY source of earn rules and annual fees.
4) Calculates estimated rewards ROI over the uploaded period as reward UNITS (no point/mile-to-dollar valuation):
   - points earned for points cards
   - miles earned for miles cards
   - cash back dollars for cash-back cards
   - annual fee shown separately (USD) and pro-rated for the uploaded period

MVP constraints:
- Single-user, no accounts/auth.
- Local-only computation; no external APIs.
- Must work end-to-end for at least 2 sample CSV formats plus robust column-mapping for unknown headers.
- Priority: correctness, determinism, and transparency over sophisticated UI.

Deliverable: a runnable local app with a clean UX, tests for core calculations, and clear documentation.

# PLAYGROUND

## Tech stack (do not change once initialized)
- Next.js (App Router) + TypeScript
- TailwindCSS + shadcn/ui
- CSV parsing in-process (no external services)
- Storage: in-memory/session state only for MVP (no DB unless required)

## Repo structure to create
- /app
  - / (single-page: upload + mapping + insights + tabbed detail sections)
- /components
  - charts, tables, upload widgets, toggles
- /lib
  - /csv (parsing + normalization + column mapping)
  - /categorize (rules engine + overrides)
  - /cards (load + validate cards.json schema)
  - /rewards (simulation engine + caps + special rules)
  - /utils (money/rounding/date helpers)
- /data
  - cards.json (provided schema)
  - category_rules.json (create; keywords + mappings)
  - /sample_csv (create; 2-3 examples)
- /tests (or __tests__)
  - csv normalization tests
  - categorization tests
  - rewards simulation tests
- README.md
  - setup
  - supported CSV formats
  - how column mapping works
  - category rules customization
  - cards.json schema expectations and how to update safely
  - assumptions and approximations (explicitly listed)

## Functional milestones (implement in this order)
1) Initialize project; app runs locally; single-page UI with a simple upload drop box and a "Load sample CSV" option.
2) Upload + parse:
   - upload one CSV
   - auto-detect columns where possible
   - user column mapping UI for date/description/amount (required)
   - upon successful upload (or sample data load) and submit, collapse the upload/mapping area (re-openable for new upload)
3) Categorization:
   - rules-based categorization from description
   - show category totals and percentages
   - allow per-transaction category override in UI
4) Multi-file support:
   - upload multiple CSVs and merge transactions
   - de-duplicate if identical rows appear (document de-dupe rule)
5) Insights:
   - spending insights is the first displayed analytics section after upload
   - spend by category chart + table
   - time range and total spend included
   - excluded transactions summary
6) Card simulation:
   - load /data/cards.json and validate
   - simulate rewards for every card across the user's categorized spend
7) Recommendations UI:
   - show separate rankings by reward currency:
     - Cash back (rank by USD cash back)
     - Points (group by program/currency and rank by units)
     - Miles (rank by units)
   - show top 3 per section with "why"
   - place Recommendations inside a tabbed section alongside Transactions and Spending by Category
8) Tests:
   - implement unit tests for parsing, categorization, and rewards logic including caps
9) Demo mode:
   - "Load sample CSV" button to run end-to-end without user data

# DATA CONTRACTS (MUST FOLLOW)

## Internal NormalizedTransaction type
- id: string (stable hash; see dedupe)
- source_file: string
- date: ISO string (YYYY-MM-DD)
- description: string
- amount_usd: number
  - positive = spend
  - negative = refund/credit
- raw_category?: string
- app_category: AppCategory
- card_category: CardCategory (derived)
- excluded: boolean
- exclude_reason?: string

## AppCategory (UI-facing categories)
- Groceries
- Dining
- Drugstores
- Streaming
- Entertainment
- Travel
- Airfare
- Gas
- Shopping
- Bills & Utilities
- Health
- Other
- Transfer/Payment (special)
- Unknown (fallback during mapping)

Note: AppCategory list can be larger than card categories; mapping controls how rewards are simulated.

## CardCategory (cards.json earn_rules.category values)
These are the ONLY categories used for simulation:
- travel_portal
- dining
- drugstores
- groceries
- airfare
- travel
- streaming
- entertainment
- rotating_bonus_categories
- top_eligible_category_each_billing_cycle
- all_purchases
- all_other

## cards.json requirements
Use /data/cards.json exactly as provided by the user. Do not alter schema or add unverified card rules.
Cards contain:
- annual_fee_usd (USD)
- activation_required (boolean)
- earn_rules[] with:
  - category (CardCategory)
  - optional subcategory
  - multiplier
  - unit
  - optional cap (amount_usd + period + applies_to)
No card benefits, welcome offers, or valuations are used in MVP.

## category_rules.json requirements (create)
Must contain:
1) Keyword rules to assign app_category based on description.
2) Mapping from app_category -> default card_category.
3) Keyword rules for exclusions (payments, transfers).

### Default app_category -> card_category mapping (start here)
- Groceries -> groceries
- Dining -> dining
- Drugstores -> drugstores
- Streaming -> streaming
- Entertainment -> entertainment
- Airfare -> airfare
- Travel -> travel (default)
- Gas -> all_other
- Shopping -> all_other
- Bills & Utilities -> all_other
- Health -> all_other
- Other -> all_other
- Transfer/Payment -> excluded (not simulated)
- Unknown -> all_other

### Additional heuristics
- Only assign travel_portal if the user explicitly flags a transaction as portal in UI.
- Otherwise travel purchases remain travel.
- If description matches airline patterns, map to Airfare (not Travel).

# CSV PARSING + NORMALIZATION REQUIREMENTS

## Supported input variations
Handle common bank CSV issues:
- varying header names:
  - date: "Date", "Transaction Date", "Posted Date"
  - description: "Description", "Payee", "Merchant", "Name"
  - amount: "Amount", or split "Debit"/"Credit"
- amounts with:
  - parentheses for negatives
  - currency symbols and commas
- extra columns ignored safely
- empty rows and footer rows ignored

## Column mapping UI
If headers are unknown or ambiguous, require the user to map:
- date column
- description column
- amount (either single amount or debit+credit)

## Amount normalization rules
- If single Amount column:
  - parse signed number
- If Debit/Credit:
  - amount_usd = debit as positive spend; credit as negative
- Always store spend as positive, refunds as negative.

## Date normalization rules
- Parse common formats: YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY when detectible
- If ambiguous, show an error and require user selection/confirmation.

## Exclusions
Exclude from "spend" totals and from rewards simulation by default:
- transfers
- credit card payments
- cash advances
- ATM withdrawals
- fees (optional; if detected)
Implementation:
- mark excluded=true with exclude_reason.
- Still display excluded summary in Insights.

# CATEGORIZATION REQUIREMENTS

## Rules engine
- Rules-based categorization using category_rules.json.
- Order matters: exclusions first, then specific categories, then fallback Other.
- Support manual override of category per transaction in UI.
- After override, recompute insights + rewards.

## Transparency
- For each transaction, show:
  - assigned category
  - whether it was overridden
  - optional rule match reason (MVP can show simple reason strings)

# REWARDS SIMULATION REQUIREMENTS (NO VALUATIONS)

## Output currencies and units
For each card, compute rewards as:
- cash_back_usd (number) for cash-back-oriented rules
- points (number) for points programs
- miles (number) for miles programs
Store results with:
- reward_currency (string from cards.json)
- total_units (number)
- cash_back_usd (if applicable)
- breakdown_by_card_category and/or by app_category (for explanation)

## Interpreting earn_rules units
cards.json uses units:
- percent_cash_back
- points_per_dollar
- miles_per_dollar
- percent_or_points_per_dollar

Simulation must implement:

1) points_per_dollar:
   earned_units += spend_usd * multiplier

2) miles_per_dollar:
   earned_units += spend_usd * multiplier

3) percent_cash_back:
   earned_cash_back_usd += spend_usd * (multiplier / 100)

4) percent_or_points_per_dollar:
   Determine treatment using card.reward_currency:
   - if reward_currency indicates cash back (cash_back, cash_rewards):
     treat multiplier as percent cash back
   - if reward_currency indicates points/miles (ultimate_rewards_points, membership_rewards_points, thankyou_points..., miles):
     treat multiplier as points/miles per dollar
If still ambiguous, pick one deterministic interpretation and document it in README.

## Category matching precedence
When simulating a transaction:
- Find the most specific applicable earn_rule:
  - match by category + subcategory if subcategory logic exists in your app
  - else match by category
- If no match exists, fall back in this order:
  - all_purchases if present
  - all_other if present
If neither exists, treat as 0 rewards (document).

## Caps
Implement caps exactly as described:
- cap.amount_usd applies to eligible spend, not rewards
- cap.period:
  - annual: calendar year based on transaction date year
  - quarterly: calendar quarter based on transaction date
  - billing_cycle: approximate as calendar month (document approximation)
- cap.applies_to indicates aggregation scope:
  - combined_bonus_category_spend
  - top_eligible_spend_category
  - other values treated conservatively (document)

When cap is reached:
- apply the fallback earn rule (usually all_other/all_purchases) for remaining spend in that period.

## Special earn rule categories (explicit handling)
1) rotating_bonus_categories
- Only apply if:
  - card.activation_required=true AND user sets an "Activated" toggle for that card.
- If not activated:
  - those transactions earn at fallback rate.

Note: Do NOT attempt to model which rotating categories apply in which quarter.
MVP handling:
- Provide a UI control that lets the user optionally tag transactions as "Rotating Bonus Eligible" for a given card/period.
- If user does not tag, treat as not eligible (fallback rate).
Document this clearly.

2) top_eligible_category_each_billing_cycle (Citi Custom Cash style)
MVP behavior (deterministic):
- For each billing cycle (calendar month approximation):
  - compute total spend per eligible CardCategory
  - choose the highest-spend eligible category for that month
  - apply 5% up to $500 spend cap for that month in that category
  - apply fallback (usually 1%) to remaining spend and other categories
Document:
- monthly approximation for billing cycle
- eligible categories list (use categories defined in cards.json and exclude all_other).

## Refunds / credits
- Negative amount transactions reduce rewards in the same category assignment.
- If refund category unknown, apply to all_other.
- Do not allow negative rewards totals below 0 for a period without documenting behavior; choose a deterministic approach.

## Annual fee handling WITHOUT valuations
Annual fee is USD.
- Always display annual_fee_usd separately for every card.
- Compute a pro-rated annual fee for the analyzed period:
  prorated_fee_usd = annual_fee_usd * (days_in_period / 365)
- Do NOT subtract fees from points/miles totals.
- For cash-back cards, you may show:
  net_cash_back_usd = cash_back_usd - prorated_fee_usd
- For points/miles cards, show:
  - earned_units
  - annual_fee_usd and prorated_fee_usd
  - do not compute "net units" (would require valuation)

# RECOMMENDATION REQUIREMENTS (NO CROSS-CURRENCY COMPARISONS)

## Do not compare different reward currencies directly
Because there is no valuation, the app must NOT claim one card is universally "best overall" across:
- cash back USD
- Ultimate Rewards points
- Membership Rewards points
- ThankYou points
- miles

## Recommendation sections
Show separate leaderboards:
1) Cash Back Recommendations
   - rank by cash_back_usd (and optionally net_cash_back_usd)
2) Points Recommendations (grouped by reward_currency)
   - within each reward_currency, rank by total_units
3) Miles Recommendations
   - rank by total_units

## Explanation requirements ("why")
For each recommended card show:
- the top 2-4 contributing categories
- contribution per category (units or cash back)
- any caps hit and how much spend was forced to fallback rate
- whether activation_required rules were applied and their status

# UX REQUIREMENTS (MVP)

## Flow
- Single-page: Upload/Map (collapsible after submit) -> Spending Insights -> Tabbed section (Transactions | Spending by Category | Card Recommendations)

## Required displays
- Date range covered (min date to max date)
- Total included spend (sum of positive non-excluded)
- Total excluded (sum + count) with reasons
- Spending Insights section displayed first after upload:
  - category breakdown chart + table
- Tabbed section:
  - Transactions tab: transactions table with filters for excluded vs included
  - Spending by Category tab: category breakdown chart + table (can mirror/extend Insights view)
  - Card Recommendations tab: recommendations as separate sections by currency
- Clear notes in UI:
  - "Rewards shown as units (points/miles) and cash-back dollars. No point valuation is applied in MVP."

## Controls
- Upload drop box with multi-file support
- "Load sample CSV" button
- Upload/Map area collapses after successful upload or sample load submit; can be expanded for a new upload
- Category override per transaction
- For cards with activation_required, toggle Activated
- For rotating categories, optional tagging control (MVP must be deterministic; do not guess quarterly categories)

## Motion + personality (minimal)
- Add progressive increase animation for all displayed numbers and progress bars:
  - animation starts from 0 and increases until it reaches the computed value
  - animation must not change the underlying computed values, only presentation
- Add subtle, minimal UI personality without reducing clarity or adding non-deterministic behavior

# TESTING REQUIREMENTS

## Unit tests must cover
- CSV parsing:
  - varied headers
  - debit/credit split
  - negative parsing formats
- Normalization:
  - stable IDs and dedupe behavior
  - exclusion detection
- Categorization:
  - keyword rules ordering
  - overrides
- Rewards simulation:
  - correct rule matching
  - fallback behavior
  - caps for quarterly/annual/monthly approximation
  - rotating activation toggle behavior
  - top_eligible_category_each_billing_cycle monthly logic

# DOCUMENTATION REQUIREMENTS

README.md must include:
- How to run locally
- Supported CSV formats and how to map columns
- How categories are assigned + how to edit category_rules.json
- How rewards are simulated
- Known approximations:
  - billing_cycle approximated as calendar month
  - rotating categories not auto-detected; require manual tagging
- What is excluded by default and why
- What the app does NOT do in MVP:
  - no point valuations
  - no welcome offers
  - no statement credits
  - no external APIs

# SIGNS (TUNING RULES)

## Discipline
- Do not change the tech stack once initialized.
- Make small, incremental changes per iteration.
- Prefer editing over rewriting large files.

## Always runnable
- Keep npm run dev working at all times.
- If tests exist, keep npm test passing; do not leave failing tests behind.

## No hallucinated card rules
- Use ONLY /data/cards.json for earn rules and annual fees.
- If data is missing, do not guess; document limitation.

## Deterministic behavior
- Do not infer rotating quarterly categories.
- Do not infer portal purchases; require user tagging/toggle.
- Do not compare different reward currencies as if equivalent.

## Transparency
- Every recommendation must show the categories and rules that produced it.
- Document approximations and assumptions clearly.

## When uncertain
- Choose the simplest approach that preserves correctness and determinism.
- Proceed without asking the user unless absolutely required to implement the next milestone.
