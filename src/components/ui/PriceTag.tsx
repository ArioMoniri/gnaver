/**
 * Entry-price tag. Reuses the core `formatEntry` formatter so "Free", "€15" and
 * "—" render identically everywhere. Free reads as a success-toned badge.
 */
import { type StyleProp, type ViewStyle } from 'react-native';

import { formatEntry, type CurrencyCode, type PriceInfo } from '@/core';
import { Tag } from './Tag';

export interface PriceTagProps {
  price: PriceInfo | undefined;
  currency: CurrencyCode;
  style?: StyleProp<ViewStyle>;
}

export function PriceTag({ price, currency, style }: PriceTagProps) {
  const label = formatEntry(price, currency);
  const free = label === 'Free';
  return <Tag label={label} tone={free ? 'success' : 'neutral'} style={style} />;
}
