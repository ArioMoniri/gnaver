# 🔐 Where to put your credentials

One page, every secret. **Nothing here is committed** — `.env` is git-ignored and
Apple/Expo secrets live in EAS, not the repo. Gnaver runs fully on sample data
with **none** of these; each one just upgrades a feature to live data.

> ⚠️ **Golden rule:** real keys go in **`.env`** (git-ignored).
> **Never** put a real key in `.env.example` — that file is committed, and GitHub
> push-protection will block the push (it already caught one dummy key).

---

## 1. App runtime keys → `.env`

Create it once from the template, then fill in what you have:

```bash
cp .env.example .env
```

Then edit `.env`:

| Variable | What it unlocks | Where to get it |
|---|---|---|
| `EXPO_PUBLIC_GOOGLE_API_KEY` | Live place search, photos, opening hours, routing, and resolving your shared Google Maps lists | [Google Cloud Console](https://console.cloud.google.com/) → enable **Places API (New)**, **Directions API**, **Geocoding API**. Restrict the key to iOS bundle `com.ariomoniri.gnaver`. |
| `EXPO_PUBLIC_LLM_PROVIDER` | `anthropic` (default) or `openai` | — |
| `EXPO_PUBLIC_LLM_API_KEY` | Conversational taste / food recommendations | [Anthropic Console](https://console.anthropic.com/) or [OpenAI](https://platform.openai.com/api-keys) |
| `EXPO_PUBLIC_LLM_MODEL` | Model id (default `claude-haiku-4-5-20251001`) | — |
| `EXPO_PUBLIC_WEATHER_API_KEY` | *Optional.* Gnaver uses free **Open-Meteo** by default (no key) | [OpenWeather](https://openweathermap.org/api) only if you prefer it |
| `GOOGLE_MAPS_ANDROID_KEY` | *Optional.* Android map rendering only (iOS uses Apple Maps) | Google Cloud Console → **Maps SDK for Android** |

`EXPO_PUBLIC_*` vars are read at runtime in [`src/services/config.ts`](../src/services/config.ts).
When a key is absent, that provider falls back to its mock — the app always runs.

---

## 2. Expo / EAS login → your machine or CI

For builds you authenticate to Expo (I can't enter your password/2FA):

```bash
npx eas-cli login          # interactive — run this in your terminal
```

For **CI / GitHub Actions** (the `eas-build.yml` workflow), add a token instead of a password:

1. Create one at **expo.dev → Account → Access tokens**.
2. GitHub repo → **Settings → Secrets and variables → Actions → New secret**
   - Name: `EXPO_TOKEN`
   - Value: *(the token)*

After login, link the project once:

```bash
npx eas-cli init          # writes the EAS projectId (picked up by app.config.ts → extra.eas.projectId)
```

---

## 3. Apple App Store submit → `eas.json` + EAS credentials

Most of this is already done / auto-resolved — you should not have to hunt for ids:

| Field | Status | Notes |
|---|---|---|
| `appleTeamId` | ✅ **already set to `FF68N39FU5`** in [`eas.json`](../eas.json) | Read automatically from your Mac's Apple Developer cert. Team IDs aren't secret. |
| `ascAppId` | 🤖 **auto-created** — leave it out | It doesn't exist until the App Store Connect app record exists. `eas submit` finds-or-**creates** the app (by bundle `com.ariomoniri.gnaver`) on first run and resolves this for you. |
| `appleId` (your Apple ID email) | 🔒 **provide via env, not the repo** | `export EXPO_APPLE_ID="you@example.com"` before submitting (keeps your email out of the public repo), or just type it at the interactive prompt. |

For **non-interactive** signing/submit (CI), create an **App Store Connect API key** (`.p8`)
in App Store Connect → Users and Access → Integrations → keys, then let EAS manage it
(this also removes any need for `appleId`/`EXPO_APPLE_ID`):

```bash
npx eas-cli credentials        # store the .p8, key id, and issuer id in EAS (never in the repo)
```

Then build & submit:

```bash
npx eas-cli build  --platform ios --profile production
npx eas-cli submit --platform ios --latest
```

Requires an active **Apple Developer Program** membership ($99/yr).

---

## Quick checklist

- [ ] `cp .env.example .env` and add your Google + LLM keys (optional — sample data works without)
- [ ] `npx eas-cli login` (and `EXPO_TOKEN` GitHub secret for CI)
- [ ] `npx eas-cli init`
- [x] `appleTeamId` set (`FF68N39FU5`) — done
- [ ] `export EXPO_APPLE_ID="you@example.com"` (or type it at the prompt)
- [ ] `npx eas-cli build --platform ios --profile production` → `eas-cli submit` (creates the App Store Connect app + resolves `ascAppId` automatically)
