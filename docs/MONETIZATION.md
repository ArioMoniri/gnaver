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

For users who don't want to manage keys, the `/paywall` screen sells **credits**:
**1 credit = 1 hosted-AI optimized plan** (`CREDITS_PER_PLAN`). Packs are
consumable IAPs (`src/store/creditsStore.ts → CREDIT_PACKS`): 10 / 50 / 200.
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
   `useCredits.add(pack.credits)` on success, and `useCredits.spend(1)` per
   hosted plan in `tripStore.generate()`.

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
