import type { Interest } from '@/core';

export interface CityMeta {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  center: { lat: number; lng: number };
  currency: string;
  timezone: string;
  emoji: string;
  blurb: string;
  interests: Interest[];
}

export const CITIES: CityMeta[] = [
  {
    id: 'lisbon',
    name: 'Lisbon',
    country: 'Portugal',
    countryCode: 'PT',
    center: { lat: 38.7223, lng: -9.1393 },
    currency: 'EUR',
    timezone: 'Europe/Lisbon',
    emoji: '🇵🇹',
    blurb: 'Sun-drenched trams, Moorish hilltop castles, pastel de nata, and fado drifting through Alfama alleyways.',
    interests: ['history', 'architecture', 'food', 'culture', 'photography'],
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    countryCode: 'FR',
    center: { lat: 48.8566, lng: 2.3522 },
    currency: 'EUR',
    timezone: 'Europe/Paris',
    emoji: '🇫🇷',
    blurb: 'Iron towers, Impressionist masterpieces, flaky croissants, and boulevards built for flaneurs.',
    interests: ['art', 'culture', 'food', 'architecture', 'history'],
  },
  {
    id: 'rome',
    name: 'Rome',
    country: 'Italy',
    countryCode: 'IT',
    center: { lat: 41.9028, lng: 12.4964 },
    currency: 'EUR',
    timezone: 'Europe/Rome',
    emoji: '🇮🇹',
    blurb: '2,000 years of empire: gladiators, gelato, Bernini fountains, and the best cacio e pepe on the planet.',
    interests: ['history', 'architecture', 'food', 'religion', 'art'],
  },
  {
    id: 'barcelona',
    name: 'Barcelona',
    country: 'Spain',
    countryCode: 'ES',
    center: { lat: 41.3851, lng: 2.1734 },
    currency: 'EUR',
    timezone: 'Europe/Madrid',
    emoji: '🇪🇸',
    blurb: 'Gaudí\'s surreal cathedrals, tapas at midnight, golden beaches, and a city that never sleeps before 2 am.',
    interests: ['architecture', 'food', 'beach', 'nightlife', 'art'],
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    countryCode: 'JP',
    center: { lat: 35.6762, lng: 139.6503 },
    currency: 'JPY',
    timezone: 'Asia/Tokyo',
    emoji: '🇯🇵',
    blurb: 'Ancient shrines next to neon towers, bullet-train sushi, cherry blossoms, and the world\'s most seamless city.',
    interests: ['food', 'culture', 'architecture', 'shopping', 'history'],
  },
  {
    id: 'amsterdam',
    name: 'Amsterdam',
    country: 'Netherlands',
    countryCode: 'NL',
    center: { lat: 52.3676, lng: 4.9041 },
    currency: 'EUR',
    timezone: 'Europe/Amsterdam',
    emoji: '🇳🇱',
    blurb: 'Rembrandt and Van Gogh, a thousand canal bridges, raw herring with onion, and the world\'s most cycling-friendly city.',
    interests: ['art', 'history', 'culture', 'food', 'architecture'],
  },
];
