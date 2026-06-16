/**
 * A selectable candidate row. Shows a category avatar (or photo when available),
 * name, category, rating, entry price and dwell — with a tactile checkbox.
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { formatDuration, formatEntry, type CurrencyCode, type Place } from '@/core';
import { useTheme } from '@/theme';
import { Text, IconSymbol, RatingStars, hapticSelection, hapticImpact, ImpactFeedbackStyle } from '@/components/ui';
import { categoryMeta } from './placeMeta';

export interface PlaceSelectRowProps {
  place: Place;
  selected: boolean;
  currency: CurrencyCode;
  onToggle: (id: string) => void;
  /** Optional remove control (e.g. for custom places). */
  onRemove?: (id: string) => void;
  /** Flag a place as must-see — the optimiser triples its priority. */
  onToggleMustSee?: (id: string, value: boolean) => void;
}

export function PlaceSelectRow({ place, selected, currency, onToggle, onRemove, onToggleMustSee }: PlaceSelectRowProps) {
  const theme = useTheme();
  const meta = categoryMeta(place.category);
  const isFood = place.isFood || ['restaurant', 'cafe', 'bar', 'street-food'].includes(place.category);
  const accent = isFood ? theme.colors.pinFood : theme.colors.accent;

  const toggle = useCallback(() => {
    hapticSelection();
    onToggle(place.id);
  }, [onToggle, place.id]);

  const mustSee = !!place.mustSee;
  const toggleMustSee = useCallback(() => {
    hapticImpact(ImpactFeedbackStyle.Light);
    onToggleMustSee?.(place.id, !mustSee);
  }, [mustSee, onToggleMustSee, place.id]);

  const priceLabel = formatEntry(place.price, currency);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={place.name}
      onPress={toggle}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          borderColor: selected ? accent : theme.colors.border,
          borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
          padding: theme.spacing.md,
        },
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: isFood ? `${theme.colors.pinFood}1A` : theme.colors.accentSoft, borderRadius: theme.radius.md }]}>
        {place.photoUrl ? (
          <Image source={{ uri: place.photoUrl }} style={styles.photo} contentFit="cover" transition={150} />
        ) : (
          <Text variant="title2">{meta.emoji}</Text>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="headline" numberOfLines={1} style={styles.name}>
            {place.name}
          </Text>
          {mustSee ? (
            <View style={[styles.mustBadge, { backgroundColor: `${theme.colors.warning}22`, borderRadius: theme.radius.sm }]}>
              <IconSymbol name="star.fill" size={10} color={theme.colors.warning} fallbackGlyph="★" />
              <Text variant="caption" weight="700" style={{ color: theme.colors.warning }}>
                Must-see
              </Text>
            </View>
          ) : null}
        </View>

        <Text variant="footnote" tone="secondary" numberOfLines={1} style={{ marginTop: 1 }}>
          {meta.label}
          {place.address ? ` · ${place.address.split(',')[0]}` : ''}
        </Text>

        <View style={styles.metaRow}>
          {place.rating != null ? <RatingStars rating={place.rating} count={place.userRatingsTotal} /> : null}
          <Text variant="footnote" tone="tertiary">
            {priceLabel === '—' ? `${formatDuration(place.dwellMinutes)}` : `${priceLabel} · ${formatDuration(place.dwellMinutes)}`}
          </Text>
        </View>
      </View>

      <View style={styles.trailing}>
        {onToggleMustSee ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: mustSee }}
            accessibilityLabel={mustSee ? `Unmark ${place.name} as must-see` : `Mark ${place.name} as must-see`}
            hitSlop={10}
            onPress={toggleMustSee}
            style={styles.starBtn}
          >
            <IconSymbol
              name={mustSee ? 'star.fill' : 'star'}
              size={20}
              color={mustSee ? theme.colors.warning : theme.colors.textTertiary}
              fallbackGlyph={mustSee ? '★' : '☆'}
            />
          </Pressable>
        ) : null}
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${place.name}`}
            hitSlop={10}
            onPress={() => {
              hapticSelection();
              onRemove(place.id);
            }}
            style={styles.removeBtn}
          >
            <IconSymbol name="xmark" size={12} color={theme.colors.textTertiary} />
          </Pressable>
        ) : null}
        <View
          style={[
            styles.checkbox,
            selected
              ? { backgroundColor: accent, borderColor: accent }
              : { borderColor: theme.colors.border, backgroundColor: 'transparent' },
          ]}
        >
          {selected ? <IconSymbol name="checkmark" size={14} color={theme.colors.onAccent} weight="bold" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

const AV = 52;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: AV,
    height: AV,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: {
    width: AV,
    height: AV,
  },
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
  },
  mustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
