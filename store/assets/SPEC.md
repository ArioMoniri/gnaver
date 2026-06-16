# Store Asset Specifications

Production specs and generation prompts for all App Store assets.

---

## App Icon

### Specifications

| Property | Value |
|---|---|
| Dimensions | 1024 × 1024 px |
| Format | PNG, no transparency |
| Corners | Square (App Store Connect applies the rounded mask) |
| Text | None — Apple guidelines prohibit text in icons |
| File path | `assets/images/icon.png` |

### Design Brief

**Concept:** A minimalist map pin / compass hybrid mark on an electric-blue background.

**Visual elements:**
- Background: solid electric blue `#0A84FF`, slightly vignette-darkened toward the edges
- Foreground: a clean, geometric pin shape with a compass-needle motif inside the pin body — four cardinal points rendered as thin white strokes, one pointing north in solid white, the others in 40% opacity white
- The pin drop-shadow: a soft dark ellipse at the base, `rgba(0,0,0,0.3)`
- No text, no wordmark, no globe motif

**Style:** Flat vector with subtle depth via a single soft radial gradient on the pin body (pin body `#FFFFFF`, gradient center highlight `rgba(255,255,255,0.9)`)

### Generation Prompt (Midjourney / DALL-E / Stable Diffusion)

```
Minimalist iOS app icon, 1024x1024, solid electric blue background #0A84FF,
centered white geometric map pin with a compass rose inside, four cardinal
direction marks in thin white lines, north arm solid white, other three arms
semi-transparent, soft white radial highlight on the pin body, subtle dark
ellipse drop shadow at pin base, flat vector style, no text, no border radius
applied, clean app store icon
```

---

## App Store Feature Graphic (Optional)

### Specifications

| Property | Value |
|---|---|
| Dimensions | 1024 × 1024 px (or 1920 × 1080 px for promotional artwork) |
| Format | PNG or JPEG |
| Use | App Store product page header / editorial feature |

### Design Brief

A dark (`#0A0C0F`) wide-format composition showing an Apple Maps screenshot blurred behind glass-card overlays. The left third shows a vertical timeline of stops (white text, electric-blue time labels). The right two-thirds show the route line in `#3D9BFF` drawn across a desaturated map. The Gnaver wordmark sits top-left in SF Pro Display Bold, white.

---

## Screenshots

### Specifications

| Size | Dimensions | Device |
|---|---|---|
| 6.7" (required) | 1290 × 2796 px | iPhone 16 Pro Max |
| 6.5" (required) | 1284 × 2778 px | iPhone 11 Pro Max |

Format: PNG. Portrait orientation. No device frame required — App Store Connect can apply frames.

Use a dark status bar simulation (iOS dark mode) to match the app's adaptive dark theme.

---

### Screenshot 01 — Home / Import

**File:** `store/assets/screenshots/01_home_import.png`

**Caption:** "Import any Google Maps list or search a city"

**UI shown:**
- The home/landing screen
- A large text field or sheet showing a Google Maps URL pasted in (`https://maps.app.goo.gl/...`)
- Below it: a "Pick a city" search bar
- The Gnaver wordmark and the electric-blue accent
- Status bar showing iOS time in dark mode

**Generation prompt:**
```
iPhone 16 Pro Max screenshot, 1290x2796, iOS dark mode, travel app UI,
minimalist white and graphite design with electric blue #0A84FF accent,
SF Pro typography, home screen showing a URL import field containing a
Google Maps link, a city search bar below, glass card surfaces,
Gnaver wordmark at top, clean professional mobile UI, no device frame
```

---

### Screenshot 02 — Place Selection

**File:** `store/assets/screenshots/02_place_selection.png`

**Caption:** "Choose your places — deselect, add, mark must-sees"

**UI shown:**
- A scrollable list of place cards with photos (thumbnail left, name/category/rating right)
- Some cards checked (blue checkmark), some unchecked
- One card has a gold star badge indicating "Must-see"
- A floating "Generate Itinerary" button at the bottom in electric blue
- Day/interest/pace filter chips at the top

**Generation prompt:**
```
iPhone 16 Pro Max screenshot, 1290x2796, iOS dark mode, travel app place
selection screen, list of location cards each with a photo thumbnail,
place name in white SF Pro, category label in grey, star rating,
some items checked with a blue checkbox #0A84FF, one item with a gold
must-see star badge, blue floating action button at bottom reading
"Generate Itinerary", glass card style, dark graphite background
```

---

### Screenshot 03 — Map + Timeline

**File:** `store/assets/screenshots/03_map_timeline.png`

**Caption:** "Your route on Apple Maps, with a time-by-time timeline"

**UI shown:**
- Full-bleed Apple Maps in the top 55% of the screen (satellite/standard hybrid)
- A blue route polyline connecting numbered pins (1, 2, 3…)
- A bottom sheet (glass card) showing the day's timeline:
  - Day header: "Day 1 — Tue, Jun 16"
  - Three stop rows: time in electric blue, place name in white, travel leg in grey ("12 min walk")
- A "Open in Google Maps" button with the Google Maps icon

**Generation prompt:**
```
iPhone 16 Pro Max screenshot, 1290x2796, Apple Maps full bleed top half,
electric blue route polyline connecting numbered circular pins, bottom half
shows a glass card timeline panel with dark background, stop rows showing
times in #0A84FF, place names in white SF Pro, travel legs in grey,
day header "Day 1 - Tue Jun 16", Google Maps button at bottom,
realistic iOS travel itinerary app
```

---

### Screenshot 04 — Food & Prices

**File:** `store/assets/screenshots/04_food_prices.png`

**Caption:** "Entry prices, payment methods, and taste-matched meals"

**UI shown:**
- An expanded stop detail card showing:
  - A restaurant / food venue (orange pin icon)
  - Arrival/departure times
  - Entry price: "Free" or "€12" in electric blue
  - Payment methods: chip labels ("Contactless", "Apple Pay", "Card") in light grey pill badges
  - A "Closes soon after your visit" warning in amber (`#E8920C`)
- Day cost summary at the bottom: "Day total: €47+"

**Generation prompt:**
```
iPhone 16 Pro Max screenshot, 1290x2796, iOS dark mode, travel app stop
detail card, expanded view showing restaurant name with orange food pin icon,
arrival time 13:15 departure 14:15 in #0A84FF, entry price "€12", payment
method pills "Contactless" "Apple Pay" "Card" in grey rounded badges,
amber warning text "Closes soon after your visit", day total "€47+" at bottom,
clean minimalist UI, SF Pro typography, glass card surfaces
```

---

### Screenshot 05 — Weather Re-route

**File:** `store/assets/screenshots/05_weather_reroute.png`

**Caption:** "Rain forecast? Gnaver shifts you indoors automatically"

**UI shown:**
- A day card with a rain/cloud icon and temperature reading
- A blue info banner at the top of the timeline: "Rain expected — indoor stops favoured"
- The timeline shows a sequence of indoor venues (museum, gallery) prioritised over outdoor options
- One place shows a grey "Skipped — outdoor, rain" label

**Generation prompt:**
```
iPhone 16 Pro Max screenshot, 1290x2796, iOS dark mode, travel app itinerary
day view, blue information banner at top reading "Rain expected - indoor stops
favoured" with a rain cloud icon, day header showing weather info 18°C rainy,
timeline below listing museum and gallery stops, one greyed-out outdoor stop
with label "Skipped - outdoor, rain forecast", electric blue #0A84FF accents,
dark graphite background, glass card UI, SF Pro typography
```

---

## Lottie Animation Specs

Place Lottie JSON files in `assets/animations/`. The app imports them with `lottie-react-native ~7.3.4`.

### `loading-compass.json`

**Trigger:** Shown while the optimizer is generating an itinerary (typically 0.5–3 s)

**Duration:** 1.8 s loop

**Style:**
- Dark background (`#0A0C0F`)
- A compass rose in the center: outer ring in `rgba(255,255,255,0.12)`, needle in electric blue `#0A84FF`
- The needle rotates a full 360°, eases in/out with a slight overshoot at north
- Cardinal labels (N, E, S, W) in `rgba(255,255,255,0.4)`, 12 pt SF Pro
- Subtle pulsing glow ring behind the compass: `rgba(10,132,255,0.15)` expanding to 1.4× and fading

**Composition:** 200 × 200 dp, transparent background, looped

---

### `route-draw.json`

**Trigger:** Shown when the Apple Maps view first loads or a new itinerary is displayed

**Duration:** 2.0 s, plays once (not looped)

**Style:**
- The camera starts zoomed out on a simplified map grid (graphite lines on near-black)
- A blue route line draws itself from pin 1 to pin 2 to pin 3 over 1.4 s using a path-trim animation
- Each pin pops in with a spring scale (0 → 1.15 → 1.0) as the route reaches it
- Pins are circular, white fill, `#0A84FF` border stroke

**Composition:** Full screen (screen-width × screen-height), transparent, plays once on appearance

---

### `empty-state.json`

**Trigger:** Shown when no places have been selected, or search returns no results

**Duration:** 2.4 s loop (gentle idle)

**Style:**
- Centered composition on a transparent background
- A minimal map pin (outline style, `rgba(255,255,255,0.3)`) drops in from above with a soft bounce
- At rest, the pin pulses gently (scale 1.0 → 1.05 → 1.0, 2 s period)
- A small dotted circle animates outward from the pin base and fades (location pulse)
- Below: a nudge arrow pointing down, semi-transparent, gentle bob

**Composition:** 260 × 320 dp, transparent background, looped
