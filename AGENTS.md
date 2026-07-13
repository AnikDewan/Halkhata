# HalKhata

## What this project is

Offline-first digital khata (ledger) app for small business owners. Tracks which
customers owe money (credit given) and which payments were received, sends
payment reminders, and generates itemized bills. "KhataBook clone." Expo SDK 57,
React Native 0.86, React 19.

## Brand

- Primary color `#ee161f` (red) — headers, primary CTAs, active tab, FABs. No blue
  as a primary accent.
- Received money = green; pending/credit = brand red.
- Card-based, rounded, gray-50 background, minimal chrome.

## Commands

- Dev server: `npm start` (or `npx expo start`); platforms: `npm run android|ios|web`.
- Lint: `npm run lint` (= `expo lint`).
- Typecheck: `npx tsc --noEmit` (no npm script — strict mode is on).
- DB migrations: `npx drizzle-kit generate` — reads `src/db/schema.ts`, writes to
  `./drizzle` (driver `expo`, emits `migrations.js`). There is no migrate script and
  migrations are not yet applied at app startup — wire `migrate(db, migrations)` from
  `drizzle-orm/expo-sqlite/migrator` before relying on schema changes.
- No test runner is configured — do not assume Jest exists.

## Project structure & gotchas

- Routes live in `src/app/`, NOT `app/`. (The README's "edit files inside the `app/`
  directory" is stale — the real entry is `src/app/`.)
- Path alias `@/*` → `src/*` (tsconfig). Use it for all imports.
- Money is stored as an INTEGER in **whole rupees** (`amount` column: ₹10 = 10). No
  paise/fractional amounts. Parse with `parseRupees()`, format with `formatMoney()`
  in `src/lib/format.ts`.
- React Compiler is enabled (`app.json` `experiments.reactCompiler`). Skip manual
  `useMemo`/`useCallback`/`React.memo` — the compiler handles it.
- `typedRoutes` is enabled (`app.json`). Use typed hrefs in `router.push`/links.
- `useLiveQuery` reactivity requires `enableChangeListener: true` on the SQLite
  connection (already set in `src/db/db.ts`). Keep it.

## Tech stack (do not deviate without discussion)

- Expo Router (file-based routing, `src/app/`), Expo SQLite + Drizzle ORM.
- No external/global state (Redux/Zustand/Context) for ledger data — reactivity comes
  from Drizzle live queries only.
- Styling: Uniwind (Tailwind v4 for RN) via `withUniwindConfig` in `metro.config.js`
  with `global.css` as entry. Never use NativeWind.
- Lists: `@shopify/flash-list` only for repeating data (customers, transactions, bills,
  reminders). Plain `ScrollView` only for a single static, non-repeating page.
- Derive types from the Drizzle schema (`$inferSelect`/`$inferInsert`), not hand-written
  interfaces.

## Data & money handling

- A customer's balance is always derived from (sum credit − sum payment) transactions.
  Never let balance drift; writes must be atomic/transactional.
- Positive balance = business will receive money; negative = business owes customer.
- Money formatted for India: ₹, `en-IN` grouping, whole rupees only (no decimals).
- Dates formatted `DD MMM YYYY` (`en-IN`).
- Deleting a transaction must reverse its effect on the balance. Deleting a customer
  cascades to their transactions (`onDelete: 'cascade'`) and must be behind a
  confirmation dialog.

## Feature checklist (source of truth)

- [ ] Customers: add (manual + phone contacts), search, view, delete (cascade + confirm)
- [ ] Transactions: add credit/payment per customer, delete (reverse + confirm), global feed
- [ ] Home dashboard: receivable/payable/net, recent transactions
- [ ] Payment reminders: customers with positive balance, SMS/WhatsApp prefilled message
- [ ] Bill generation: itemized line items, running total, add-to-ledger, export/share
- [ ] Settings: data export/import, theme, destructive clear-all-data (confirmed), version

## Expo version note

Expo changes fast between SDKs. Before writing framework code, read the versioned docs
at https://docs.expo.dev/versions/v57.0.0/.
