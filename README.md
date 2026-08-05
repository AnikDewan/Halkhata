<div align="center">

<img src="assets/images/icon.png" alt="HalKhata" width="96" height="96" />

# HalKhata

**The shopkeeper's digital ledger — 100% offline, 100% open source.**

Track who owes you, log credits and payments, send reminders, and generate
itemized bills. No accounts, no servers, no tracking. Every entry stays on
your phone.

[![Download APK](https://img.shields.io/badge/Download-APK-EB1519?style=for-the-badge&logo=android&logoColor=white)](https://github.com/AnikDewan/Halkhata/releases/latest/download/HalKhata.apk)

[![Platform: Android](https://img.shields.io/badge/Platform-Android-3DDC84?logo=android&logoColor=white)](https://github.com/AnikDewan/Halkhata)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](/LICENSE)

</div>

---

## About

HalKhata (Hindi for “ledger”) is an offline-first khata app for small
business owners. Add customers, record how much credit (`given`) and how much
cash (`received`) each customer owes, and always see the live balance — with a
receivable/payable home dashboard, payment reminders, and itemized bills.

Because everything runs on-device with **zero data collection**, your financial
records never leave your phone. There is no server to phone home to, nothing
to sell, and nothing to leak.

## Features

- **Home dashboard** — receivable, payable, and net balance at a glance, plus
  recent transactions.
- **Customers** — add manually or import from phone contacts, with search and
  forgiving Bengali phonetic (`inglish`) matching.
- **Transactions** — log credits and payments per customer, delete to reverse
  the effect on balance, and browse a global feed.
- **Payment reminders** — every customer with a positive (pending) balance,
  shareable as a pre-filled PDF reminder.
- **Bill generation** — itemized line items with a running total, add the bill
  straight to a customer's ledger, and share/export it as a PDF.
- **Self-hosted data** — export/import your entire ledger as a file, automatic
  daily backups to Documents/Downloads, and restore on reinstall.
- **Tools & settings** — switch themes and a confirmed destructive clear-all.

## Privacy

HalKhata is entirely offline. It does **not** collect, store, transmit, or sell
any personal information, contacts, transactions, or financial data. Everything
is stored in your phone's secure local storage. Uninstalling the app removes
the data. See the [Privacy Policy](https://github.com/AnikDewan/Halkhata/blob/main/LICENSE).

## Download

<div align="center">

[![Download Android APK](https://img.shields.io/badge/Download%20Android%20APK-EB2389?style=for-the-badge&logo=android&logoColor=white)](https://github.com/AnikDewan/Halkhata/releases/latest/download/HalKhata.apk)

Requires **Android 6.0+ (API 23)**. The APK is unsigned for sideloading.

</div>

## Tech Stack

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) · React Native 0.86 · React 19
- [Expo Router](https://docs.expo.dev/router/introduction/) for file-based routing
- [Drizzle ORM](https://orm.drizzle.team/) + [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) for local storage (live queries)
- [Uniwind](https://github.com/SoumyadipSD/Uniwind) (Tailwind v4 for React Native)
- [FlashList](https://shopify.github.io/flash-list/) for high-performance lists
- Monetary values stored as whole rupees (`₹10` = `10`); formatted with `en-IN` grouping

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npx expo start

# Then press
#   a  → open on Android
#   w  → open on the web
```

### Useful scripts

| Command               | Description                          |
| --------------------- | ------------------------------------ |
| `npm start`           | Start the Expo dev server            |
| `npm run android`     | Open the app on Android              |
| `npm run web`         | Open the app on the web              |
| `npm run lint`        | Lint the project (`expo lint`)       |
| `npx tsc --noEmit`    | Typecheck (strict mode)              |
| `npx drizzle-kit generate` | Generate DB migrations          |

> Note: the app entry point and all routes live in **`src/app/`** (not `app/`),
> with a `@/*` path alias pointing to `src/*`.

## Database

The schema in `src/db/schema.ts` drives everything:

- **`customers`** — auto-increment id, name, optional phone. Names are unique
  (case- and whitespace-insensitive).
- **`transactions`** — customer id (cascade-deletes with its customer), type
  `given` / `received`, amount in whole rupees, description, and timestamp.

A customer's balance is **always derived** from the sum of their transactions
(`given − received`). Positive balance = you will receive money; negative =
you owe the customer. No drifting stored balance.

## Contributing

Contributions are welcome! Please open an issue or pull request.

1. Fork the repo and create a feature branch.
2. Make your changes, running `npm run lint` and `npx tsc --noEmit`.
3. Open a PR with a clear description.

## License

Distributed under the [MIT License](LICENSE).

## Support

- GitHub: [AnikDewan/Halkhata](https://github.com/AnikDewan/Halkhata)
- Report issues: [Issues](https://github.com/AnikDewan/Halkhata/issues)