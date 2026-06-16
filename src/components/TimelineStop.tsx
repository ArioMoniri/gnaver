/**
 * One scheduled stop on the day timeline. A numbered time rail on the left, a
 * connector to the next stop, and a glass detail card on the right showing the
 * arrival–departure window, entry price, payments, dwell, and any warnings.
 * The incoming travel leg renders as a small chip above the card.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import {
  formatDistance,
  formatDuration,
  formatEntry,
  formatMinutes,
  formatPayments,
  type CurrencyCode,
  type ScheduledStop,
} from '@/core';
import { useTheme } from '@/theme';
import { Text, GlassCard, IconSymbol, RatingStars, Tag, hapticSelection } from '@/components/ui';
import { categoryMeta, transportMeta } from './placeMeta';

export interface TimelineStopProps {
  stop: ScheduledStop;
  index: number;
  currency: CurrencyCode;
  /** Hide the connector below the last stop. */
  isLast?: boolean;
  /** Move this stop one position earlier in the day. */
  onMoveUp?: () => void;
  /** Move this stop one position later in the day. */
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function TimelineStop({
  stop,
  index,
  currency,
  isLast = false,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: TimelineStopProps) {
  const theme = useTheme();
  const reorderable = !!(onMoveUp || onMoveDown);
  const { place } = stop;
  const isFood = stop.isFood || place.isFood;
  const accent = isFood ? theme.colors.pinFood : theme.colors.accent;
  const meta = categoryMeta(place.category);

  const leg = stop.legToHere;
  const priceLabel = formatEntry(place.price, currency);
  const payments = place.price ? formatPayments(place.price.acceptedPayments) : null;
  const warnings = stop.warnings ?? [];

  return (
    <View style={styles.row}>
      {/* Time rail */}
      <View style={styles.rail}>
        <View style={[styles.node, { backgroundColor: accent, borderColor: theme.colors.surface }]}>
          <Text variant="footnote" weight="700" style={{ color: theme.colors.onAccent }}>
            {index + 1}
          </Text>
        </View>
        {!isLast ? <View style={[styles.connector, { backgroundColor: theme.colors.border }]} /> : null}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {leg ? (
          <View style={[styles.legChip, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, borderRadius: theme.radius.pill }]}>
            <Text variant="caption" tone="secondary">
              {transportMeta(leg.mode).emoji} {formatDuration(leg.durationMinutes)} · {formatDistance(leg.distanceMeters)}
            </Text>
          </View>
        ) : null}

        <GlassCard padding="md" radius="lg">
          {isFood ? (
            <View pointerEvents="none" style={[styles.foodRail, { backgroundColor: theme.colors.pinFood }]} />
          ) : null}
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <View style={styles.timeRow}>
                <IconSymbol name="clock" size={13} color={accent} fallbackGlyph="🕐" />
                <Text variant="footnote" weight="600" style={{ color: accent }}>
                  {formatMinutes(stop.arrivalMinutes)} - {formatMinutes(stop.departureMinutes)}
                </Text>
                {stop.waitMinutes && stop.waitMinutes > 0 ? (
                  <Text variant="caption" tone="tertiary">
                    · waits {formatDuration(stop.waitMinutes)}
                  </Text>
                ) : null}
              </View>

              <Text variant="headline" tone="onGlass" style={{ marginTop: 4 }} numberOfLines={2}>
                {place.name}
              </Text>
            </View>

            <View style={[styles.thumb, { backgroundColor: isFood ? `${theme.colors.pinFood}1A` : theme.colors.accentSoft, borderRadius: theme.radius.md }]}>
              {place.photoUrl ? (
                <Image source={{ uri: place.photoUrl }} style={styles.thumbImg} contentFit="cover" transition={150} />
              ) : (
                <LinearGradient
                  colors={theme.gradients.accentWash as unknown as readonly [string, string]}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={styles.thumbPlaceholder}
                >
                  <Text variant="title2">{meta.emoji}</Text>
                </LinearGradient>
              )}
            </View>

            {reorderable ? (
              <View style={styles.reorder}>
                <ReorderButton
                  icon="chevron.up"
                  glyph="⌃"
                  label={`Move ${place.name} earlier`}
                  disabled={!canMoveUp}
                  onPress={onMoveUp}
                  theme={theme}
                />
                <ReorderButton
                  icon="chevron.down"
                  glyph="⌄"
                  label={`Move ${place.name} later`}
                  disabled={!canMoveDown}
                  onPress={onMoveDown}
                  theme={theme}
                />
              </View>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            <Tag label={meta.label} tone={isFood ? 'food' : 'neutral'} emoji={meta.emoji} />
            {place.rating != null ? <RatingStars rating={place.rating} count={place.userRatingsTotal} /> : null}
          </View>

          <View style={styles.factsRow}>
            <Fact icon="eurosign.circle" glyph="€" color={theme.colors.onGlassSecondary} text={priceLabel} theme={theme} />
            <Fact icon="hourglass" glyph="⏳" color={theme.colors.onGlassSecondary} text={formatDuration(place.dwellMinutes)} theme={theme} />
          </View>

          {payments && payments !== 'Unknown' ? (
            <Text variant="caption" tone="tertiary" style={{ marginTop: 6 }} numberOfLines={1}>
              Pays: {payments}
            </Text>
          ) : null}

          {place.price?.notes ? (
            <Text variant="caption" tone="tertiary" style={{ marginTop: 2 }} numberOfLines={2}>
              {place.price.notes}
            </Text>
          ) : null}

          {warnings.length > 0 ? (
            <View style={styles.warnings}>
              {warnings.map((w, i) => (
                <View key={i} style={styles.warnRow}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={12} color={theme.colors.warning} fallbackGlyph="⚠" />
                  <Text variant="caption" style={{ color: theme.colors.warning, flex: 1 }}>
                    {w}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </GlassCard>
      </View>
    </View>
  );
}

function ReorderButton({
  icon,
  glyph,
  label,
  disabled,
  onPress,
  theme,
}: {
  icon: Parameters<typeof IconSymbol>[0]['name'];
  glyph: string;
  label: string;
  disabled: boolean;
  onPress?: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        hapticSelection();
        onPress?.();
      }}
      style={[
        styles.reorderBtn,
        { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border, borderRadius: theme.radius.sm },
        disabled && { opacity: 0.32 },
      ]}
    >
      <IconSymbol name={icon} size={13} color={theme.colors.onGlass} weight="semibold" fallbackGlyph={glyph} />
    </Pressable>
  );
}

function Fact({
  icon,
  glyph,
  text,
  color,
  theme,
}: {
  icon: Parameters<typeof IconSymbol>[0]['name'];
  glyph: string;
  text: string;
  color: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.fact}>
      <IconSymbol name={icon} size={13} color={color} fallbackGlyph={glyph} />
      <Text variant="footnote" tone="secondary">
        {text}
      </Text>
    </View>
  );
}

const NODE = 28;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rail: {
    width: NODE,
    alignItems: 'center',
  },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginTop: 2,
  },
  connector: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: 4,
    borderRadius: 1,
  },
  content: {
    flex: 1,
    paddingBottom: 16,
  },
  legChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  foodRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    opacity: 0.85,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  thumb: {
    width: 54,
    height: 54,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: {
    width: 54,
    height: 54,
  },
  thumbPlaceholder: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorder: {
    gap: 6,
  },
  reorderBtn: {
    width: 30,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  factsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  warnings: {
    marginTop: 10,
    gap: 4,
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
