/**
 * Currency formatting and price aggregation. Entry prices in Gnaver are always
 * expressed in the trip's destination currency.
 */

import type { CurrencyCode, PaymentMethod, Place, PriceInfo } from './types';

const SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  KRW: '₩',
  THB: '฿',
  INR: '₹',
  TRY: '₺',
  CHF: 'CHF ',
  AUD: 'A$',
  CAD: 'C$',
  BRL: 'R$',
  MXN: 'MX$',
  AED: 'د.إ ',
  SGD: 'S$',
  HKD: 'HK$',
  SEK: 'kr ',
  NOK: 'kr ',
  DKK: 'kr ',
  PLN: 'zł ',
  CZK: 'Kč ',
  HUF: 'Ft ',
  ZAR: 'R',
  IDR: 'Rp ',
  MYR: 'RM ',
  PHP: '₱',
  VND: '₫',
};

/** Currencies conventionally written without decimals. */
const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'IDR', 'HUF', 'CLP', 'ISK']);

export function currencySymbol(code: CurrencyCode): string {
  return SYMBOLS[code] ?? `${code} `;
}

/** 12 + "EUR" → "€12". 1500 + "JPY" → "¥1,500". */
export function formatPrice(amount: number, code: CurrencyCode): string {
  const decimals = ZERO_DECIMAL.has(code) ? 0 : amount % 1 === 0 ? 0 : 2;
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${currencySymbol(code)}${formatted}`;
}

/** Render a place's entry price for display: "Free", "€15", or "—" if unknown. */
export function formatEntry(price: PriceInfo | undefined, fallbackCurrency: CurrencyCode): string {
  if (!price) return '—';
  if (price.free || price.amount === 0) return 'Free';
  if (price.amount == null) return '—';
  return formatPrice(price.amount, price.currency || fallbackCurrency);
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  contactless: 'Contactless',
  mobile: 'Apple/Google Pay',
  amex: 'Amex',
  unknown: 'Unknown',
};

export function formatPayments(methods: PaymentMethod[] | undefined): string {
  if (!methods || methods.length === 0) return 'Unknown';
  return methods.map((m) => PAYMENT_LABELS[m] ?? m).join(' · ');
}

export interface CostSummary {
  amount: number;
  currency: CurrencyCode;
  /** True if any included place had an unknown price (so the total is a floor). */
  hasUnknown: boolean;
}

/** Sum entry prices across places, flagging when some prices are unknown. */
export function sumEntryCost(places: Place[], currency: CurrencyCode): CostSummary {
  let amount = 0;
  let hasUnknown = false;
  for (const p of places) {
    const price = p.price;
    if (!price || (price.amount == null && !price.free)) {
      hasUnknown = true;
      continue;
    }
    if (price.free) continue;
    amount += price.amount ?? 0;
  }
  return { amount: Math.round(amount * 100) / 100, currency, hasUnknown };
}

/** "€42" or "€42+" when some prices were unknown. */
export function formatCostSummary(cost: CostSummary): string {
  const base = formatPrice(cost.amount, cost.currency);
  return cost.hasUnknown ? `${base}+` : base;
}
