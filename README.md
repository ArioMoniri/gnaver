![Gnaver](docs/assets/banner.svg)

<div align="center">

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2056-000020?logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.85-61DAFB?logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-44%20passing-2FB463?logo=jest)](tests/)

**The travel-itinerary optimizer that actually respects your time.**

*Import a Google Maps list. Pick your pace. Get a day-by-day, hour-by-hour roadmap — weather-adjusted, opening-hour-aware, with meals matched to your taste.*

[Getting Started](#-getting-started) · [Architecture](#-architecture) · [API Keys](#-api-keys) · [Contributing](#-contributing)

</div>

---

## 🗺️ Why Gnaver?

Every other trip-planner gives you a list of tourist attractions in a random order and calls it a "plan". Gnaver gives you a **working schedule**:

- It knows the Louvre is closed on Tuesdays.
- It knows 38 °C is too hot for a midday beach walk and re-routes you indoors.
- It knows you want sushi under €20 and it inserts lunch at 12:30 near wherever you happen to be.
- It minimises the time you spend backtracking with a 2-opt route polish pass.

Zero API keys required to try it — everything runs on realistic sample data the moment you launch.

---

## ✨ Features

- 📥 **Google Maps list import** — paste a shared-list link and Gnaver resolves every saved place automatically
- 🏙️ **City search** — or just pick a city and let Gnaver find the best places for your interests
- 🎯 **Interest matching** — Culture, History, Art, Food, Nature, Beaches, Nightlife, Shopping, Architecture, Religion, Photography, Relaxation, Adventure
- 🚶 **Transport modes** — Walk, Transit, Drive, Bike, or Mixed (auto-switches walk→transit by distance)
- ⏱️ **Custom day windows** — set your own start time, end time, and hotel/start point for each day
- 🔒 **Opening hours with exceptions** — handles holiday closures, ceremony days, and multi-range opening windows
- ☁️ **Live weather re-routing** — rainy day? outdoor stops lose priority; indoor venues get a boost
- 🌡️ **Temperature thresholds** — configurable too-hot / too-cold limits for outdoor places
- 🍜 **Taste-matched meals** — lunch and dinner inserted automatically, ranked by cuisine prefs, dietary needs, and budget (cheap / mid / fine)
- ⭐ **Must-see pinning** — mark non-negotiables; the optimizer triples their value score
- 🗓️ **Re-editable selection** — deselect or add places after generation and re-route instantly
- 🗺️ **Native Apple Maps view** — full-bleed map with the day's route drawn in electric blue
- 📋 **Time-by-time timeline** — entry prices, accepted payment methods, local currency, travel legs
- 🔗 **One-tap Google Maps link** — per-day directions deep-link with all waypoints in order
- 💸 **Day cost summary** — total entry prices with unknown-price flagging (shown as `€42+`)
- 🌓 **Adaptive dark/light theme** — "Map-first Minimal" design system, SF Pro, glass cards

---

## 🧠 How the Optimizer Works

Gnaver's scheduling engine lives in [`src/core/optimizer.ts`](src/core/optimizer.ts) and is pure TypeScript — no React Native imports, fully unit-testable in Node.

**Three-phase algorithm:**

1. **Value scoring** — every place receives a base score from interest overlap (up to 1.5× for perfect match), star rating, review count, and a 3× multiplier for must-see places. Weather multiplies this score down for outdoor places on bad days (rain / heat / cold) and up for indoor venues acting as refuge.

2. **Greedy forward construction** — the scheduler walks forward through the day's time window, greedily picking the place with the highest `adjusted_value ÷ total_minutes_cost` ratio that is feasibly reachable and open. Meal windows (lunch 12:00–14:30, dinner 18:30–21:00) are checked first; if a pre-ranked food candidate is within a 25-minute detour it is inserted, otherwise the closest feasible option is used. Places that can't fit any day are returned as `unscheduled`.

3. **2-opt polishing** — up to 8 rounds of pairwise segment reversal minimise total travel time. Meals are held fixed (they're time-anchored); only attraction ordering is optimised. Every candidate ordering is re-simulated against opening hours and the day window, so no constraint is ever violated.

Travel times use real Google Directions data when a key is present, or a haversine + detour-factor + per-mode speed model offline (see [`src/core/geo.ts`](src/core/geo.ts)).

---

## 🏗️ Architecture

```
src/
├── core/               # Pure engine — no RN imports, 100% testable in Node
│   ├── types.ts        # Domain model (Place, Trip, DayPlan, ItineraryResult…)
│   ├── optimizer.ts    # Value scoring + greedy construction + 2-opt
│   ├── constraints.ts  # Opening hours (incl. exceptions) + weather impact
│   ├── recommender.ts  # Heuristic food ranker (LLM fallback)
│   ├── geo.ts          # Haversine, estimateLeg, centroid, boundsOf
│   ├── googleList.ts   # URL classification + coord/name parsing
│   ├── googleMaps.ts   # Deep-link builder (directions + place URLs)
│   ├── currency.ts     # Price formatting, payment labels, cost summation
│   └── time.ts         # Minute arithmetic, date helpers, formatters
│
├── services/
│   └── config.ts       # EXPO_PUBLIC_* env → ServiceConfig + feature flags
│
├── theme/
│   └── tokens.ts       # Design system: palettes, spacing, radius, typography
│
├── constants/
│   └── theme.ts        # Theme constants
│
├── components/         # Shared UI primitives
├── hooks/              # useTheme, useColorScheme
└── app/                # expo-router file-based screens
    ├── _layout.tsx
    ├── index.tsx
    └── explore.tsx
```

```mermaid
graph TD
    UI["📱 expo-router UI\n(screens + components)"]
    Store["🗂️ Zustand Store\n(trip state)"]
    Services["🔌 Services Layer\nPlaces · Routing · Weather · Taste"]
    Core["⚙️ Pure Core Engine\noptimizer · constraints · recommender"]
    Providers["🌐 Providers\nGoogle Maps · Open-Meteo · Claude/OpenAI"]
    MockProviders["🧪 Mock Providers\nSample data (no keys needed)"]

    UI -->|reads/writes| Store
    Store -->|triggers| Services
    Services -->|calls| Core
    Services -->|live keys present| Providers
    Services -->|no keys / offline| MockProviders
    Core -->|ItineraryResult| Store
    Store -->|DayPlan[]| UI
```

---

## 📱 Screenshots

> Screenshots are generated at 1290×2796 (iPhone 16 Pro Max). Reference files live in [`store/assets/screenshots/`](store/assets/screenshots/).

| Home / Import | Place Selection | Map + Timeline | Food & Prices | Weather Re-route |
|:---:|:---:|:---:|:---:|:---:|
| ![](store/assets/screenshots/01_home_import.png) | ![](store/assets/screenshots/02_place_selection.png) | ![](store/assets/screenshots/03_map_timeline.png) | ![](store/assets/screenshots/04_food_prices.png) | ![](store/assets/screenshots/05_weather_reroute.png) |

*Screenshot generation prompts and exact specs are in [`store/assets/SPEC.md`](store/assets/SPEC.md).*

---

## 🎬 Motion & Delight

Gnaver uses **[lottie-react-native](https://github.com/lottie-react-native/lottie-react-native)** (`~7.3.4`) for animated loading and empty states:

| File | Trigger | Style |
|---|---|---|
| [`assets/animations/loading-compass.json`](assets/animations/loading-compass.json) | Itinerary generation | Spinning compass needle, electric blue `#0A84FF` on dark background |
| [`assets/animations/route-draw.json`](assets/animations/route-draw.json) | Map loads for the first time | Route line drawing across a minimal map, 2 s loop |
| [`assets/animations/empty-state.json`](assets/animations/empty-state.json) | No places selected / no results | Gentle pin-drop with a nudge arrow, graphite palette |

**Rive** (interactive, state-machine-driven animation) is planned as a future enhancement for richer micro-interactions on the timeline scrubber.

Animation specs and generation prompts: [`store/assets/SPEC.md`](store/assets/SPEC.md).

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20 LTS or later
- **Xcode** 16+ with an iOS 18 simulator (for iOS builds)
- **EAS CLI** — `npm install -g eas-cli`

### Install

```bash
git clone https://github.com/ArioMoniri/gnaver.git
cd gnaver
npm install
```

### Configure environment

```bash
cp .env.example .env
# Edit .env — all keys are optional; the app runs on mock data without them
```

### Run (development build — required for expo-maps)

> **Why a dev build?** `expo-maps` uses native Apple Maps APIs and cannot run inside Expo Go. You need a development build on a real device or simulator.

```bash
# iOS simulator
npx expo run:ios

# Or build via EAS and install on device
eas build -p ios --profile development
```

See [docs/SETUP.md](docs/SETUP.md) for the full prerequisites walkthrough.

---

## 🔑 API Keys

All keys go in `.env` (git-ignored). Copy `.env.example` to get started. **Everything works without keys** — keys upgrade from sample data to live data.

| Variable | Service | Without key |
|---|---|---|
| `EXPO_PUBLIC_GOOGLE_API_KEY` | Google Places API (New), Directions, Geocoding | Mock places + haversine routing |
| `EXPO_PUBLIC_WEATHER_API_KEY` | Reserved (currently Open-Meteo, which is keyless) | Open-Meteo free tier (always live) |
| `EXPO_PUBLIC_LLM_PROVIDER` | `anthropic` or `openai` | Heuristic food ranker |
| `EXPO_PUBLIC_LLM_API_KEY` | Claude (`claude-haiku-4-5-20251001` default) or OpenAI | Heuristic food ranker |
| `EXPO_PUBLIC_LLM_MODEL` | Override the default model | `claude-haiku-4-5-20251001` |
| `GOOGLE_MAPS_ANDROID_KEY` | Android native Maps SDK (build-time only) | Android maps disabled |

Enable these Google Cloud APIs: **Places API (New)**, **Directions API**, **Geocoding API**.

See [docs/SETUP.md](docs/SETUP.md) for step-by-step instructions.

---

## 🧪 Testing

The core engine is fully covered by pure Node tests — no emulator needed.

```bash
npm test                  # 44 tests across 7 suites
npm run test:watch        # watch mode
npm run test:coverage     # coverage report
```

| Suite | What it covers |
|---|---|
| `constraints.test.ts` | Opening hours, exceptions, weather impact multipliers |
| `optimizer.test.ts` | End-to-end scheduling, 2-opt, must-see priority, weather re-routing |
| `recommender.test.ts` | Food scoring: cuisine, dietary, budget alignment |
| `geo.test.ts` | Haversine, estimateLeg per mode, centroid, boundsOf |
| `currency.test.ts` | formatPrice, formatEntry, sumEntryCost across ISO 4217 codes |
| `time.test.ts` | formatMinutes, parseMinutes, dateRange, formatDateLabel |
| `googleList.test.ts` | URL classification, coord parsing, place-name extraction |

---

## 🗺️ Roadmap

- [ ] Zustand store + full UI screens (in progress)
- [ ] Google Places live provider
- [ ] Offline caching of itineraries (AsyncStorage)
- [ ] Share itinerary as PDF / link
- [ ] Rive micro-animations on timeline scrubber
- [ ] Android support (Google Maps native)
- [ ] Multi-city / connecting-flight trips
- [ ] Collaborative planning (shared trip link)
- [ ] Watch companion (glanceable next stop)

---

## 🤝 Contributing

1. Fork the repo and create a feature branch
2. Write tests for new core logic (`tests/`)
3. Ensure `npm test` and `npm run typecheck` pass
4. Open a PR — describe what the optimizer change does and why

Please keep core modules (`src/core/`) free of React Native imports. The separation between pure engine and RN services is intentional and load-bearing for testability.

---

## 📄 License

MIT © [Ario Moniri](https://github.com/ArioMoniri) — see [LICENSE](LICENSE).

---

<div align="center">
<sub>Built with Expo SDK 56 · React Native 0.85 · React 19 · TypeScript 6</sub>
</div>
