<div align="center">

<img src="public/icon.svg" width="88" alt="RetroFin icon" />

# RetroFin

**English** · [Português](README.pt-BR.md)

A personal finance tracker that logs spending on its own: it imports bank statements, reads the bank notifications on your phone and categorizes everything with AI.

![React](https://img.shields.io/badge/React_19-292524?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-292524?logo=typescript&logoColor=3178C6)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_4-292524?logo=tailwindcss&logoColor=38BDF8)
![Firebase](https://img.shields.io/badge/Firebase-292524?logo=firebase&logoColor=FFCA28)
![Gemini](https://img.shields.io/badge/Gemini_API-292524?logo=googlegemini&logoColor=8E75B2)
![PWA](https://img.shields.io/badge/PWA-292524?logo=pwa&logoColor=white)

</div>

> The app interface is in Brazilian Portuguese and targets Brazilian banks (Nubank, Inter and others).

## Features

- **Automatic entries from notifications**: the Android app reads purchase and Pix notifications from bank apps (Nubank, Inter, Itaú, C6 and others) with a native service, extracts amount, merchant and time, and creates the transaction in the right account, with no third-party automation app
- **Android app (APK)** built by GitHub Actions on every push, alongside the web/PWA version
- **CL4P-RZ link**: sends a summary to the personal hub [CL4P-RZ](https://github.com/Riizzi/CL4P-RZ), which cross-references spending with places, pantry and wishlist
- **Statement import** from OFX, CSV or text copied from the bank app
- **Layered categorization**: your manual choices are never overwritten; a correction applies to every transaction from the same merchant; known merchants go through rules; only the rest goes to Gemini, with your categories and examples, a schema-restricted answer and no personal names
- **AI insights** on the month's spending
- **Category budgets** with monthly goals
- **Charts** of spending by category and by month
- **Multiple bank accounts**, each with its own purpose
- **App lock** with PIN and biometrics (WebAuthn), plus auto-lock after inactivity
- **Cloud sync** with Google sign-in (Firebase), or fully local use with no account
- **Installable PWA** with offline support

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS 4, Motion, Lucide |
| Server | Express (`/api` routes) with Firebase Admin |
| Data | Cloud Firestore (sync) or `localStorage` (local mode) |
| Auth | Firebase Authentication (Google or anonymous) |
| AI | `@google/genai` with structured JSON output |
| PWA | `vite-plugin-pwa` (Workbox) |
| Android | Capacitor 8 + Java `NotificationListenerService` |

## Architecture

```
Android (Java)                                      App (React + Capacitor)
 BankNotificationListener ── bank apps only, ──────┐
                             texts with R$          ├─► NotifStore (queue) ──► bridge ──► bankNotifications.ts ──► transactions
 RetroFinNativePlugin ────── status, queue, ack ───┘
App
   ├── localStorage + Firestore ... accounts, transactions, budgets (writes only what changed)
   ├── POST /api/categorize ....... batch categorization with Gemini (optional)
   ├── POST /api/ai-insights ...... monthly spending analysis (optional)
   └── CL4P-RZ link ............... summary for the personal hub
```

Notification parsing runs on the device. The service queues notifications while the app is closed; when it opens, the app parses, records and acknowledges them. The parsing logic is pure and tested (`tests/bankNotifications.test.ts`).

## Getting started

Requirements: Node.js 22+ (or Bun) and, optionally, a [Gemini API key](https://aistudio.google.com/apikey).

```bash
bun install                 # or npm install
cp .env.example .env        # then fill in GEMINI_API_KEY
bun run dev                 # http://localhost:3000
```

To use your own Firebase project, replace the values in `firebase-applet-config.json` with your Web app's config and deploy `firestore.rules` from the Firebase console.

| Script | What it does |
| --- | --- |
| `dev` | Express server + Vite with hot reload |
| `build` | builds the app into `dist/` and the server into `server.js` |
| `start` | serves the production build |
| `lint` | type check with `tsc` |

## Android app and notification reading

1. In the **Actions** tab, the **Build APK** workflow runs on every push to `main`.
2. On the phone, open **Releases**, download **RetroFin.apk** and install it.
3. In the app: **Análises → Importar & Celular → Notificações → Liberar acesso**, then enable RetroFin.
4. If Android shows *Restricted setting* (default for sideloaded apps on Android 13+): **Settings → Apps → RetroFin → ⋮ → Allow restricted settings**, then repeat step 3.
5. Set battery usage to **Unrestricted**.

> **APK signing:** the key lives only in GitHub Secrets (`ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD`), never in the repository. Without them, the workflow builds with a throwaway key and skips the release.

## Privacy and server

- The MacroDroid webhook routes were removed: they wrote into any user's database given just the id in the URL.
- On a public server, set `RETROFIN_API_KEY` and paste the same value in **Backup e vínculos → Categorização**.
- Only merchant description, amount, date and channel are sent to the AI. Pix to people is sent as `Pix para [pessoa]`.

## License

[MIT](LICENSE)
