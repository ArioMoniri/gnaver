/**
 * Per-day start/end point editor. A bottom sheet (Modal) listing every day of
 * the trip; for each day the traveller sets a START and an END point via one of:
 *   • Use my current location (expo-location, with permission)
 *   • Pick from my places (any selected candidate)
 *   • City center (the default — clears the override)
 *
 * Writes through `setDayOverride(i, { startLocation, startName } | { endLocation, endName })`.
 * Pure presentation over the trip store; data flow is unchanged.
 */
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { dateRange, formatDateLabel, type LatLng, type Place } from '@/core';
import { useTheme } from '@/theme';
import { useTrip, type DayOverride } from '@/store/tripStore';
import {
  Button,
  GlassSurface,
  IconSymbol,
  Text,
  hapticImpact,
  hapticNotify,
  hapticSelection,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from '@/components/ui';

export interface DayOptionsSheetProps {
  visible: boolean;
  onClose: () => void;
}

type Edge = 'start' | 'end';

export function DayOptionsSheet({ visible, onClose }: DayOptionsSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const startDate = useTrip((s) => s.startDate);
  const dayCount = useTrip((s) => s.dayCount);
  const perDay = useTrip((s) => s.perDay);
  const center = useTrip((s) => s.center);
  const candidates = useTrip((s) => s.candidates);
  const selectedIds = useTrip((s) => s.selectedIds);
  const setDayOverride = useTrip((s) => s.setDayOverride);

  const dates = useMemo(() => dateRange(startDate, dayCount), [startDate, dayCount]);
  const selectedPlaces = useMemo(
    () => candidates.filter((p) => selectedIds[p.id]),
    [candidates, selectedIds],
  );

  // Inline "pick from my places" target: which (day, edge) is choosing.
  const [picking, setPicking] = useState<{ index: number; edge: Edge } | null>(null);
  const [locating, setLocating] = useState(false);

  const applyCurrentLocation = useCallback(
    async (index: number, edge: Edge) => {
      setLocating(true);
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          hapticNotify(NotificationFeedbackType.Warning);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        const loc: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const patch: DayOverride =
          edge === 'start'
            ? { startLocation: loc, startName: 'My location' }
            : { endLocation: loc, endName: 'My location' };
        setDayOverride(index, patch);
        hapticImpact(ImpactFeedbackStyle.Light);
      } catch {
        hapticNotify(NotificationFeedbackType.Error);
      } finally {
        setLocating(false);
      }
    },
    [setDayOverride],
  );

  const applyPlace = useCallback(
    (index: number, edge: Edge, place: Place) => {
      const patch: DayOverride =
        edge === 'start'
          ? { startLocation: place.location, startName: place.name }
          : { endLocation: place.location, endName: place.name };
      setDayOverride(index, patch);
      hapticSelection();
      setPicking(null);
    },
    [setDayOverride],
  );

  const applyCityCenter = useCallback(
    (index: number, edge: Edge) => {
      const patch: DayOverride =
        edge === 'start'
          ? { startLocation: undefined, startName: undefined }
          : { endLocation: undefined, endName: undefined };
      setDayOverride(index, patch);
      hapticSelection();
    },
    [setDayOverride],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close" onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              paddingBottom: insets.bottom + theme.spacing.lg,
              maxHeight: '86%',
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text variant="title2">Day options</Text>
              <Text variant="footnote" tone="secondary" style={{ marginTop: 2 }}>
                Set where each day starts and ends. Default is the city center.
              </Text>
            </View>
            <Button title="Done" variant="ghost" size="sm" onPress={onClose} />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl, gap: theme.spacing.md }}
            showsVerticalScrollIndicator={false}
          >
            {dates.map((date, i) => {
              const o = perDay[i] ?? {};
              const isPickingStart = picking?.index === i && picking.edge === 'start';
              const isPickingEnd = picking?.index === i && picking.edge === 'end';
              return (
                <GlassSurface key={date} variant="panel" radius="lg" padding="md" floating>
                  <View style={styles.dayHead}>
                    <Text variant="footnote" weight="700" tone="accent">
                      Day {i + 1}
                    </Text>
                    <Text variant="caption" tone="onGlassSecondary">
                      {formatDateLabel(date)}
                    </Text>
                  </View>

                  <EdgeRow
                    label="Start"
                    name={o.startName ?? 'City center'}
                    isDefault={!o.startLocation}
                    busy={locating}
                    picking={isPickingStart}
                    canPick={selectedPlaces.length > 0}
                    onCurrent={() => void applyCurrentLocation(i, 'start')}
                    onPickToggle={() => setPicking(isPickingStart ? null : { index: i, edge: 'start' })}
                    onDefault={() => applyCityCenter(i, 'start')}
                    places={selectedPlaces}
                    onSelectPlace={(p) => applyPlace(i, 'start', p)}
                    theme={theme}
                    hasCenter={!!center}
                  />

                  <View style={[styles.divider, { backgroundColor: theme.colors.glassBorder }]} />

                  <EdgeRow
                    label="End"
                    name={o.endName ?? (o.startName ?? 'City center')}
                    isDefault={!o.endLocation}
                    busy={locating}
                    picking={isPickingEnd}
                    canPick={selectedPlaces.length > 0}
                    onCurrent={() => void applyCurrentLocation(i, 'end')}
                    onPickToggle={() => setPicking(isPickingEnd ? null : { index: i, edge: 'end' })}
                    onDefault={() => applyCityCenter(i, 'end')}
                    places={selectedPlaces}
                    onSelectPlace={(p) => applyPlace(i, 'end', p)}
                    theme={theme}
                    hasCenter={!!center}
                  />
                </GlassSurface>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function EdgeRow({
  label,
  name,
  isDefault,
  busy,
  picking,
  canPick,
  onCurrent,
  onPickToggle,
  onDefault,
  places,
  onSelectPlace,
  theme,
  hasCenter,
}: {
  label: string;
  name: string;
  isDefault: boolean;
  busy: boolean;
  picking: boolean;
  canPick: boolean;
  onCurrent: () => void;
  onPickToggle: () => void;
  onDefault: () => void;
  places: Place[];
  onSelectPlace: (p: Place) => void;
  theme: ReturnType<typeof useTheme>;
  hasCenter: boolean;
}) {
  return (
    <View style={styles.edge}>
      <View style={styles.edgeHead}>
        <View style={[styles.edgeDot, { backgroundColor: label === 'Start' ? theme.colors.accent : theme.colors.pinFood }]} />
        <Text variant="footnote" weight="600" tone="onGlassSecondary" style={{ width: 38 }}>
          {label}
        </Text>
        <Text variant="subhead" weight="600" tone="onGlass" numberOfLines={1} style={{ flex: 1 }}>
          {name}
        </Text>
        {isDefault ? (
          <Text variant="caption" tone="onGlassSecondary">
            default
          </Text>
        ) : null}
      </View>

      <View style={styles.edgeActions}>
        <MiniAction icon="location.fill" glyph="📍" label="My location" onPress={onCurrent} disabled={busy} theme={theme} />
        <MiniAction
          icon="mappin.and.ellipse"
          glyph="📌"
          label="My places"
          onPress={onPickToggle}
          disabled={!canPick}
          active={picking}
          theme={theme}
        />
        <MiniAction icon="building.2.fill" glyph="🏙" label="City center" onPress={onDefault} disabled={!hasCenter} theme={theme} />
      </View>

      {picking ? (
        <View style={styles.pickList}>
          {places.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`Use ${p.name}`}
              onPress={() => onSelectPlace(p)}
              style={[styles.pickRow, { borderColor: theme.colors.glassBorder, borderRadius: theme.radius.sm }]}
            >
              <IconSymbol name="mappin" size={13} color={theme.colors.accent} fallbackGlyph="📍" />
              <Text variant="footnote" tone="onGlass" numberOfLines={1} style={{ flex: 1 }}>
                {p.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function MiniAction({
  icon,
  glyph,
  label,
  onPress,
  disabled = false,
  active = false,
  theme,
}: {
  icon: Parameters<typeof IconSymbol>[0]['name'];
  glyph: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.mini,
        {
          backgroundColor: active ? theme.colors.accentSoft : theme.colors.surfaceElevated,
          borderColor: active ? theme.colors.accent : theme.colors.border,
          borderRadius: theme.radius.sm,
        },
        disabled && { opacity: 0.4 },
      ]}
    >
      <IconSymbol
        name={icon}
        size={13}
        color={active ? theme.colors.accent : theme.colors.onGlassSecondary}
        fallbackGlyph={glyph}
      />
      <Text variant="caption" weight="600" style={{ color: active ? theme.colors.accent : theme.colors.onGlassSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    paddingTop: 10,
  },
  grabber: {
    width: 38,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  edge: {
    gap: 8,
  },
  edgeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  edgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  edgeActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  mini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickList: {
    gap: 6,
    marginTop: 2,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
