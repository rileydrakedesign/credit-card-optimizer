# UI Redesign Plan

## Architecture: Two-State Layout

Replace the current single-page + 3-tab layout with two clean states:

**State 1: Onboarding** — Full-screen centered connect flow (shown when `!hasData`)
**State 2: Results** — Hero card + ranked list + spending chart (shown when `hasData`)

---

## Step 1: Global Theme — Dark Minimal Aesthetic

**File: `app/globals.css`**
- Force dark theme (remove light mode variables)
- Set `--background: slate-950` (#020617), `--foreground: slate-50` (#f8fafc)
- Add accent color variables: `--accent: emerald-400` (#34d399), `--accent-dim: emerald-600`
- Add a subtle body gradient or noise texture for depth

**File: `app/layout.tsx`**
- Add `dark` class to `<html>` to force dark mode
- Update metadata title/description to match new branding

---

## Step 2: Onboarding State (Full-Screen Connect)

**File: `components/PlaidLinkSection.tsx`** — Rewrite to be a full-screen centered onboarding view

When `!hasData`:
- Full viewport height, centered content
- Big bold headline: "Find your best card" or similar
- Subtitle: "Connect your bank to see which card earns the most on your actual spending"
- Large emerald "Connect Bank" button (not a dashed border box)
- Subtle "or try sample data" link below
- Remove the collapsible toggle/accordion pattern entirely
- Keep error/linking/loading/success states but restyle to match dark theme

When `hasData`:
- Collapse to a minimal top bar showing connected institution + "Start Over" link
- No longer takes up significant space

---

## Step 3: Results Hero — Top Card Recommendation

**New file: `components/ResultsView.tsx`** — Main results container

This replaces `InsightsSection` + `TabsSection` with a single scrollable results page:

### Hero Section (top of results)
- Large card showing the #1 recommendation (best net cash back)
- Card name, issuer in big text
- Giant animated number for net earnings (e.g., "$847.32 back")
- Annual fee shown simply as "No annual fee" or "$95/yr fee → $752 net"
- Remove "pro-rated fee" language — just show net value
- Emerald accent for positive values

### Ranked List (below hero)
- Single unified list of ALL cards ranked by net cash back (not split by type)
- Each row: rank number, card name, net earnings, annual fee badge
- Expandable rows: click to see category breakdown
- Points/miles cards shown with unit count + "(points)" or "(miles)" label
- No MVP disclaimer text

### Spending Summary (below rankings)
- Compact horizontal bar chart (reuse the SpendingByCategoryTab bar chart logic)
- Shows category breakdown in one clean section
- Date range + total spend as a small header above the chart
- Remove duplicate InsightsSection — this is the only place spending data appears

### Transactions Link (bottom)
- Small text link: "View all X transactions"
- Expands inline or scrolls to a collapsible transactions table
- Power-user feature, not a primary tab

---

## Step 4: Restyle Card Results

**File: `components/RecommendationsTab.tsx`** — Refactor into inline components within ResultsView

- Remove the 3-grid split (cash back / points / miles)
- Single ranked list sorted by net value (cash back cards by net_cash_back_usd, points/miles by total_units with type indicator)
- Hero card (#1) gets special large treatment
- Cards #2+ get compact row treatment
- Remove "pro-rated fee" text — show "annual fee" simply or "No fee"
- Remove italic MVP disclaimer
- Dark card backgrounds (slate-900) with subtle borders
- Emerald for positive earnings, red/rose for fees

---

## Step 5: Clean Up Dead Code

- Delete `components/UploadSection.tsx` (dead code)
- Delete `components/InsightsSection.tsx` (replaced by spending summary in ResultsView)
- Delete `components/TabsSection.tsx` (replaced by ResultsView)
- Delete `components/RecommendationsTab.tsx` (logic moved to ResultsView)
- Keep `components/TransactionsTab.tsx` (used as collapsible detail)
- Keep `components/AnimatedNumber.tsx` (used in hero)

---

## Step 6: Update Page Entry Point

**File: `app/page.tsx`**
- Conditional render: `!hasData` → PlaidLinkSection (full-screen onboarding), `hasData` → ResultsView
- Remove `uploadOpen` state (no longer toggling sections)
- Pass `onReset` to ResultsView for the "Start Over" action
- Keep all business logic (processTransactions, handleLoadSample, handleCategoryOverride) unchanged

---

## File Change Summary

| File | Action |
|------|--------|
| `app/globals.css` | Edit — dark theme, accent colors |
| `app/layout.tsx` | Edit — force dark, update metadata |
| `app/page.tsx` | Edit — two-state layout, remove tab logic |
| `components/PlaidLinkSection.tsx` | Rewrite — full-screen onboarding |
| `components/ResultsView.tsx` | **New** — hero + ranked list + spending chart + txn link |
| `components/TransactionsTab.tsx` | Edit — restyle for dark theme |
| `components/AnimatedNumber.tsx` | Keep as-is |
| `components/UploadSection.tsx` | Delete |
| `components/InsightsSection.tsx` | Delete |
| `components/TabsSection.tsx` | Delete |
| `components/RecommendationsTab.tsx` | Delete |
