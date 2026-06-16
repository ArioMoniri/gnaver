# 💳 Monetization — bring-your-own-key + pay-as-you-go credits

Gnaver is open-source and AI-powered, so the model lets users **cover their own
costs** fairly (validated by 3 user-persona reviews):

## Free — bring your own keys (shipping)

- Add your **Google Maps Platform** key and an **Anthropic/OpenAI** key in
  **Settings → Your API keys**.
- Keys are stored **on-device only** (`runtimeKeys`, AsyncStorage) — never in the
  JS bundle, never in git, never uploaded.
- Unlimited and free — you use your own API quota.

## Pay-as-you-go — Gnaver Credits (scaffold)

For users who don't want to manage keys, the `/paywall` screen sells **credits**.
Packs are consumable IAPs (`src/store/creditsStore.ts → CREDIT_PACKS`): 10 / 50 / 200.
The on-device ledger is built; **purchase + fulfilment are stubbed.** To make it
live you (the owner) need:

1. **A billing library** for consumables — [RevenueCat](https://www.revenuecat.com/)
   (`react-native-purchases` + Expo plugin) or StoreKit 2. `npx expo install
   react-native-purchases`, add the plugin to `app.config.ts`, rebuild (EAS).
2. **App Store Connect products** — create **consumable** credit products whose
   ids match `CREDIT_PACKS` (`gnaver.credits.10/50/200`); sign the Paid Apps
   agreement.
3. **A hosted AI proxy** — a small backend holding the server keys + metering, so
   credit users don't supply keys. Charge a small markup on metered token cost.
4. Wire the paywall "Buy" button to `Purchases.purchaseProduct(...)` →
   `useCredits.add(pack.credits)` on success. Spending is already wired:
   `tripStore.generate()` charges `creditsForPlan(trip)` on the managed tier.

## 💵 Is a credit "correct" for the API spend? — the cost model

Earlier the app charged a flat **1 credit per plan** and, in fact, spent **0
credits** (`generate()` never called `spend`). Both are now fixed:

- **Cost is metered, not flat.** `src/core/cost.ts → estimatePlanCost(trip)`
  estimates the real Google + LLM list cost of one generation, and
  `creditsForPlan(trip)` converts it to whole credits
  (`ceil(totalUsd / USD_PER_CREDIT)`, min 1, capped at `MAX_CREDITS_PER_PLAN`).
- **`generate()` charges it** — but only on the *managed* tier
  (`features.managedBilling = livePlaces && !byoKeys`). Bring-your-own-key users
  pay their provider directly and are **never** charged; the no-key offline path
  spends nothing because it makes no paid calls.

**What a plan actually costs (Google Maps Platform list prices, USD):**

| Plan | Matrix | Directions | Food | LLM | Total | Credits |
|------|-------:|-----------:|-----:|----:|------:|--------:|
| 1-day · 4 places · walk | $0.18 | — | — | — | **$0.18** | 1 |
| 3-day · 12 places · transit + food | $1.62 | $0.15 | $0.10 | $0.01 | **$1.88** | 4 |
| 5-day · 20 places · transit + food | $3.13 | $0.25 | $0.16 | $0.02 | **$3.56** | 8 (cap) |

**Finding:** the **Distance Matrix dominates** — it is `O(n²)` in routed points
(`$5 / 1000` elements). That is why a flat 1 credit was badly under-priced.

**Two truths to hold together:**
1. *List price* per plan is ~$0.2–$3.6 (above what a credit retails for: $0.15–$0.30).
2. *Marginal cash cost* at low volume is ~**$0.02** (the LLM) — Google's
   **$200/month free tier** absorbs ~40k matrix elements (~120 big plans/month).

So credits priced at `USD_PER_CREDIT = $0.50` of list cost are profitable while
you're inside the free tier, and break-even-ish past it. **To keep margin at
scale, cut the matrix cost** (the single biggest lever):
- route the optimizer on haversine estimates and call **Directions only for the
  final chosen legs** (`n‑1` calls instead of `n²` matrix elements), or
- use the **Routes API `computeRouteMatrix`** (cheaper per element) with field
  masks, and **cache** the matrix per (city, mode) across regenerations.

## 🚀 Shipping a fully-live build (no sample/offline data shown)

The curated dataset is only a silent offline fallback. For a production build that
uses **live data everywhere**, give it keys at build time so every user gets live
results without entering anything:

```bash
# Store your keys as EAS environment variables (NOT committed to git):
eas env:create --name EXPO_PUBLIC_GOOGLE_API_KEY --value "AIza..." --visibility sensitive
eas env:create --name EXPO_PUBLIC_LLM_API_KEY    --value "sk-ant-..." --visibility sensitive
eas env:create --name EXPO_PUBLIC_LLM_PROVIDER   --value "anthropic"
# then build — the bundle reads them via src/services/config.ts
eas build --platform ios --profile production
```

Restrict the Google key to the iOS bundle id `com.ariomoniri.gnaver`. With these
set, `features.livePlaces`/`liveTaste` are true and the UI shows **Live**
everywhere — the offline fallback is never reached.
