/**
 * Presentation metadata for place categories, interests, and transport modes.
 * Pure UI mapping — keeps emoji/label/symbol choices out of the screens.
 */
import type { SFSymbol } from 'sf-symbols-typescript';

import type { Interest, PlaceCategory, TransportMode } from '@/core';

export interface CategoryMeta {
  label: string;
  emoji: string;
  symbol: SFSymbol;
}

const CATEGORY: Record<PlaceCategory, CategoryMeta> = {
  landmark: { label: 'Landmark', emoji: '🏛', symbol: 'building.columns.fill' },
  museum: { label: 'Museum', emoji: '🖼', symbol: 'building.columns.fill' },
  gallery: { label: 'Gallery', emoji: '🎨', symbol: 'paintpalette.fill' },
  park: { label: 'Park', emoji: '🌳', symbol: 'tree.fill' },
  beach: { label: 'Beach', emoji: '🏖', symbol: 'beach.umbrella.fill' },
  viewpoint: { label: 'Viewpoint', emoji: '🌄', symbol: 'mountain.2.fill' },
  religious: { label: 'Religious site', emoji: '⛪️', symbol: 'building.2.fill' },
  historic: { label: 'Historic', emoji: '🏰', symbol: 'building.2.fill' },
  market: { label: 'Market', emoji: '🧺', symbol: 'basket.fill' },
  shopping: { label: 'Shopping', emoji: '🛍', symbol: 'bag.fill' },
  nightlife: { label: 'Nightlife', emoji: '🌃', symbol: 'moon.stars.fill' },
  restaurant: { label: 'Restaurant', emoji: '🍽', symbol: 'fork.knife' },
  cafe: { label: 'Café', emoji: '☕️', symbol: 'cup.and.saucer.fill' },
  bar: { label: 'Bar', emoji: '🍸', symbol: 'wineglass.fill' },
  'street-food': { label: 'Street food', emoji: '🥡', symbol: 'takeoutbag.and.cup.and.straw.fill' },
  nature: { label: 'Nature', emoji: '🍃', symbol: 'leaf.fill' },
  experience: { label: 'Experience', emoji: '✨', symbol: 'sparkles' },
  other: { label: 'Place', emoji: '📍', symbol: 'mappin' },
};

export function categoryMeta(category: PlaceCategory): CategoryMeta {
  return CATEGORY[category] ?? CATEGORY.other;
}

const INTEREST_LABEL: Record<Interest, { label: string; emoji: string }> = {
  culture: { label: 'Culture', emoji: '🎭' },
  history: { label: 'History', emoji: '📜' },
  art: { label: 'Art', emoji: '🎨' },
  food: { label: 'Food', emoji: '🍜' },
  nature: { label: 'Nature', emoji: '🌿' },
  beach: { label: 'Beach', emoji: '🏖' },
  nightlife: { label: 'Nightlife', emoji: '🍸' },
  shopping: { label: 'Shopping', emoji: '🛍' },
  architecture: { label: 'Architecture', emoji: '🏛' },
  religion: { label: 'Religion', emoji: '🛐' },
  photography: { label: 'Photography', emoji: '📸' },
  relaxation: { label: 'Relax', emoji: '🧖' },
  adventure: { label: 'Adventure', emoji: '🧗' },
};

export const ALL_INTERESTS: Interest[] = [
  'culture',
  'history',
  'art',
  'food',
  'architecture',
  'nature',
  'beach',
  'nightlife',
  'shopping',
  'religion',
  'photography',
  'relaxation',
  'adventure',
];

export function interestMeta(interest: Interest): { label: string; emoji: string } {
  return INTEREST_LABEL[interest] ?? { label: interest, emoji: '•' };
}

export interface TransportMeta {
  label: string;
  emoji: string;
  symbol: SFSymbol;
}

const TRANSPORT: Record<TransportMode, TransportMeta> = {
  walk: { label: 'Walk', emoji: '🚶', symbol: 'figure.walk' },
  transit: { label: 'Transit', emoji: '🚊', symbol: 'tram.fill' },
  drive: { label: 'Drive', emoji: '🚗', symbol: 'car.fill' },
  bike: { label: 'Bike', emoji: '🚲', symbol: 'bicycle' },
  mixed: { label: 'Mixed', emoji: '🧭', symbol: 'arrow.triangle.swap' },
};

export function transportMeta(mode: TransportMode): TransportMeta {
  return TRANSPORT[mode] ?? TRANSPORT.mixed;
}
