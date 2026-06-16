# 💳 Monetization — bring-your-own-key + Gnaver Pro

Gnaver is open-source and AI-powered, so the model is built to let users **cover
their own costs** fairly (validated by 3 user-persona reviews):

## Free — bring your own keys (shipping)

- Add your **Google Maps Platform** key and an **Anthropic/OpenAI** key in
  **Settings → Your API keys**.
- Keys are stored **on-device only** (`runtimeKeys`, AsyncStorage) — never in the
  JS bundle, never in git, never uploaded. This also fixes the build-time
  `EXPO_PUBLIC_*` key-in-bundle exposure for privacy-conscious users.
- With no keys, the app runs fully on **realistic sample data**.
- This is "pay your own expenses": you use your own API quota.

## Gnaver Pro — we run the AI (scaffold)

The `/paywall` screen presents an optional subscription (Monthly / Yearly) where
Gnaver hosts the AI so users don't manage keys. **The UI is built; the purchase
is stubbed.** To make it live you (the owner) need:

1. **A billing library** — recommended [RevenueCat](https://www.revenuecat.com/)
   (`react-native-purchases` + its Expo config plugin) or StoreKit 2 directly.
   `npx expo install react-native-purchases` then add the plugin to
   `app.config.ts` and rebuild (EAS).
2. **App Store Connect products** — create auto-renewable subscriptions
   (e.g. `gnaver.pro.monthly`, `gnaver.pro.yearly`) under the app, sign the Paid
   Apps agreement.
3. **A hosted AI proxy** (only for the "we run the AI" tier) — a small backend
   that holds the server keys and meters usage, so Pro users don't supply keys.
   Pay-as-you-go = charge a small markup on metered token cost.
4. Wire the `/paywall` "Start Pro" button to `Purchases.purchasePackage(...)` and
   gate the hosted-AI path on entitlement.

Until then, **everything works free with your own keys** — no paywall blocks core
features.
