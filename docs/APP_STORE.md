# App Store Publishing Guide

A step-by-step walkthrough for submitting Gnaver to the Apple App Store via EAS.

---

## Prerequisites

Before you start, you need:

1. **Apple Developer Program membership** — $99/year, enrolled at [developer.apple.com](https://developer.apple.com/programs/enroll/). This is required to submit to the App Store. The free Apple ID tier cannot submit apps.

2. **App Store Connect app record** — create the app at [appstoreconnect.apple.com](https://appstoreconnect.apple.com):
   - New App → iOS → Bundle ID: `com.ariomoniri.gnaver` → Name: Gnaver
   - Note the **Apple ID (numeric)** shown at the top of the app record — you'll need it for `eas.json`

3. **EAS CLI authenticated**:
   ```bash
   npm install -g eas-cli
   eas login          # log in with your Expo account
   ```

4. **EAS project linked** (first time only):
   ```bash
   eas init           # links this repo to an EAS project, writes the projectId into eas.json / app.config.ts
   ```

---

## Credentials

EAS handles iOS credentials automatically. On first build it will:

- Generate a **Distribution Certificate** (or use one already in your Apple account)
- Generate a **Provisioning Profile** for `com.ariomoniri.gnaver`

You authorise this one of two ways:

### Option A — Apple ID + app-specific password (interactive)

```bash
eas credentials
```

EAS will prompt for your Apple ID and then ask for a code from your device (2FA). This is the simplest path for solo developers.

### Option B — App Store Connect API Key (.p8) — recommended for CI

1. In App Store Connect → Users and Access → Integrations → App Store Connect API
2. Generate a key with **Developer** role → download the `.p8` file
3. Note the **Issuer ID** and **Key ID**
4. Provide them to EAS:
   ```bash
   eas credentials --platform ios
   # follow prompts to upload the .p8
   ```

The `.p8` file is a secret. Never commit it to the repository.

---

## Filling in `eas.json`

Open [`eas.json`](../eas.json) and fill in the placeholders inside `submit.production.ios`:

```json
"appleId": "your@apple.id",
"ascAppId": "1234567890",       // the numeric App ID from App Store Connect
"appleTeamId": "ABCDE12345"    // your 10-character Team ID (apple.com/account)
```

---

## Build Profiles

### Development build (internal testing, dev client)

```bash
eas build -p ios --profile development
```

Produces a `.ipa` with the Expo Dev Client bundled. Install on registered devices via the EAS dashboard or TestFlight (internal only). No App Store review required.

### Preview build (internal distribution)

```bash
eas build -p ios --profile preview
```

Ad-hoc distribution. Useful for sharing with stakeholders. Devices must be registered in your Apple Developer account.

### Production build

```bash
eas build -p ios --profile production
```

Creates a production-signed `.ipa` with `autoIncrement: true` — EAS automatically bumps the build number on each run. This is the artifact you submit to the App Store.

---

## Submit to the App Store

After a successful production build:

```bash
eas submit -p ios
```

EAS will ask which build to submit (it lists recent builds). Alternatively, target a specific build:

```bash
eas submit -p ios --latest
```

EAS uploads the binary to App Store Connect using your credentials. The app then appears in **TestFlight** for internal testing (no review) or you can promote it directly to App Store review.

---

## App Store Review Checklist

### Metadata (required before submission)

- [ ] App name: Gnaver
- [ ] Subtitle (≤ 30 chars): see [`store/metadata/en-US/subtitle.txt`](../store/metadata/en-US/subtitle.txt)
- [ ] Description (≤ 4 000 chars): [`store/metadata/en-US/description.txt`](../store/metadata/en-US/description.txt)
- [ ] Keywords (≤ 100 chars): [`store/metadata/en-US/keywords.txt`](../store/metadata/en-US/keywords.txt)
- [ ] Promotional text (≤ 170 chars): [`store/metadata/en-US/promotional_text.txt`](../store/metadata/en-US/promotional_text.txt)
- [ ] Release notes: [`store/metadata/en-US/release_notes.txt`](../store/metadata/en-US/release_notes.txt)
- [ ] Support URL: [`store/metadata/en-US/support_url.txt`](../store/metadata/en-US/support_url.txt)
- [ ] Marketing URL: [`store/metadata/en-US/marketing_url.txt`](../store/metadata/en-US/marketing_url.txt)
- [ ] Privacy policy URL: [`store/metadata/en-US/privacy_policy_url.txt`](../store/metadata/en-US/privacy_policy_url.txt)

### Screenshots (required)

Apple requires screenshots for at least two device sizes:

| Size | Dimensions | Label in App Store Connect |
|---|---|---|
| 6.7" Super Retina XDR (iPhone 16 Pro Max) | 1290 × 2796 px | Required |
| 6.5" Super Retina XDR (iPhone 11 Pro Max / 12 Pro Max) | 1284 × 2778 px | Required |

Upload 5 screenshots per size. See [`store/assets/SPEC.md`](../store/assets/SPEC.md) for captions and generation prompts.

### App icon

- 1024 × 1024 px PNG, no transparency, no rounded corners (App Store Connect applies the mask)
- Spec and generation prompt: [`store/assets/SPEC.md`](../store/assets/SPEC.md)

### Privacy & permissions

- [ ] `NSLocationWhenInUseUsageDescription` is set in `app.config.ts` — clearly explains the purpose
- [ ] `ITSAppUsesNonExemptEncryption: false` is set (no export compliance questionnaire needed)
- [ ] Privacy policy URL is live and accessible before submission

### Content & technical

- [ ] App runs without a network connection using mock data (offline mode)
- [ ] All API keys are excluded from the binary (loaded at runtime from environment)
- [ ] No hardcoded secrets in the source tree
- [ ] App does not crash on launch in the iOS simulator and on a physical device
- [ ] Location permission prompt is clear and contextual

---

## TestFlight

After upload, the build is available in TestFlight for internal testers immediately (no review). For external testers (up to 10 000):

1. App Store Connect → TestFlight → External Groups → Add Group
2. Submit the build for Beta App Review (usually < 24 h)
3. Add testers by email or shareable link

---

## Common Issues

**"Missing compliance" on upload:** `ITSAppUsesNonExemptEncryption: false` in `app.config.ts` should suppress the Export Compliance questionnaire. If it appears anyway, answer "No" (Gnaver does not use custom encryption).

**"Invalid bundle ID":** The bundle ID in `eas.json` and in App Store Connect must exactly match `com.ariomoniri.gnaver`.

**2FA prompt during `eas submit`:** Use an App Store Connect API key (Option B above) to avoid interactive 2FA in CI.

**Build number not incrementing:** Confirm `autoIncrement: true` is set under `build.production.ios` in `eas.json`.
