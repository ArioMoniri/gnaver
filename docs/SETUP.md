# Setup Guide

A complete walkthrough from a fresh machine to a running Gnaver development build.

---

## Prerequisites

### Node.js

Gnaver requires **Node.js 20 LTS** or later. Check your version:

```bash
node --version   # must be >= 20
```

Install via [nvm](https://github.com/nvm-sh/nvm) or the [official installer](https://nodejs.org).

### Xcode (iOS only)

- **Xcode 16 or later** from the Mac App Store
- Open Xcode once to accept the license agreement
- Install Command Line Tools: `xcode-select --install`
- Install an iOS 18 simulator: Xcode → Settings → Platforms → iOS

### EAS CLI

EAS (Expo Application Services) is required for production and device builds:

```bash
npm install -g eas-cli
eas login
```

### Watchman (recommended)

Speeds up Metro's file watching on macOS:

```bash
brew install watchman
```

---

## Install Dependencies

```bash
git clone https://github.com/ArioMoniri/gnaver.git
cd gnaver
npm install
```

---

## Environment Setup

Gnaver reads all secrets from environment variables prefixed `EXPO_PUBLIC_*`. These are inlined at build time by Expo and are never committed to the repository.

```bash
cp .env.example .env
```

Open `.env` in your editor. All variables are optional — the app runs fully on realistic mock data without any keys. Keys upgrade specific providers from sample data to live data:

```
# Places, Directions, Geocoding (Google Cloud Console)
EXPO_PUBLIC_GOOGLE_API_KEY=

# LLM provider for taste-based food ranking
EXPO_PUBLIC_LLM_PROVIDER=anthropic
EXPO_PUBLIC_LLM_API_KEY=
EXPO_PUBLIC_LLM_MODEL=claude-haiku-4-5-20251001

# Android native Maps SDK key (build-time only — NOT EXPO_PUBLIC_)
GOOGLE_MAPS_ANDROID_KEY=

# EAS project id (set automatically by eas init)
EAS_PROJECT_ID=
```

### Why EXPO_PUBLIC_ matters

Expo's bundler only inlines environment variables with the `EXPO_PUBLIC_` prefix into the client bundle. Variables without this prefix (like `GOOGLE_MAPS_ANDROID_KEY`) are only available during the native build step in `app.config.ts` and are not shipped to the device.

---

## Why a Development Build is Required

**Expo Go cannot run Gnaver.** The app uses `expo-maps` (`~56.0.7`), which embeds the native Apple Maps framework. Expo Go does not bundle native modules that aren't in its pre-built binary. A **development build** compiles the full native layer with all custom modules included.

You have two options:

### Option A — iOS Simulator (no Apple account required)

```bash
npx expo run:ios
```

This compiles a debug build and boots it in the simulator. Xcode 16 and an iOS 18 simulator must be installed. The first build takes 3–5 minutes; incremental rebuilds are fast.

### Option B — Physical Device via EAS

```bash
eas build -p ios --profile development
```

EAS builds in the cloud (no local Xcode needed for the build itself). After it completes, install the `.ipa` on your device via the EAS dashboard or the link in your terminal. This requires an EAS account (free tier is sufficient for development builds).

---

## Getting a Google Maps Platform Key

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or select an existing one)
3. Navigate to **APIs & Services → Library** and enable:
   - **Places API (New)** — for place search and details
   - **Directions API** — for real routing legs and travel times
   - **Geocoding API** — for city resolution and reverse geocoding
4. Go to **APIs & Services → Credentials → Create Credentials → API key**
5. (Recommended) Restrict the key to the three APIs above and to your app's bundle ID (`com.ariomoniri.gnaver`)
6. Copy the key into `EXPO_PUBLIC_GOOGLE_API_KEY` in your `.env`

For the Android native maps key (`GOOGLE_MAPS_ANDROID_KEY`), create a separate key restricted to the **Maps SDK for Android** and your Android package name.

---

## Getting an Anthropic / OpenAI Key

**Anthropic (default):**

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Go to **API Keys → Create Key**
3. Set `EXPO_PUBLIC_LLM_PROVIDER=anthropic` and `EXPO_PUBLIC_LLM_API_KEY=sk-ant-...`
4. The default model is `claude-haiku-4-5-20251001` (fast, cheap, excellent for food ranking)

**OpenAI:**

1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Go to **API Keys → Create new secret key**
3. Set `EXPO_PUBLIC_LLM_PROVIDER=openai`, `EXPO_PUBLIC_LLM_API_KEY=sk-...`, and `EXPO_PUBLIC_LLM_MODEL=gpt-4o-mini`

**Without a key**, the heuristic food ranker in [`src/core/recommender.ts`](../src/core/recommender.ts) runs instead. It scores food candidates by rating, cuisine match, dietary keywords, and budget alignment — no LLM call needed.

---

## Running Without API Keys

Everything works on mock data:

```bash
npm install
npx expo run:ios
```

- Places provider: returns a curated sample dataset of real-world locations
- Routing: haversine distance + per-mode speed model (walk 80 m/min, transit 300 m/min, etc.)
- Weather: Open-Meteo free tier — this is **always live** (no key required)
- Food ranking: heuristic scorer

This is useful for development, UI work, and running the test suite.

---

## Running Tests

The core engine is pure TypeScript and runs in Node — no simulator or native build required:

```bash
npm test              # 44 tests, ~7 s
npm run test:watch    # re-runs on file change
npm run test:coverage # line/branch coverage report
npm run typecheck     # tsc --noEmit, no emitted output
npm run lint          # expo lint
```

---

## Troubleshooting

**Metro bundler port conflict:** `npx expo start --port 8082`

**iOS build fails with "No provisioning profile":** Use `--device` flag or configure a simulator target. Alternatively use `eas build` which handles signing automatically.

**`expo-maps` crash on simulator:** Ensure you are using an **iOS 18** simulator. Earlier simulators may not support all Apple Maps APIs used by `expo-maps` 56.

**env vars not picked up:** Expo only reads `.env` at Metro start. Restart Metro after editing `.env`.
