/**
 * Per-day start/end point editor. A bottom sheet (Modal) listing every day of
 * the trip; for each day the traveller sets a START and an END point via one of:
 *   • Type a hotel/address (geocoded via placesProvider.geocodeAddress)
 *   • Use my current location (expo-location, with permission)
 *   • Pick from my places (any selected candidate)
 *   • City center (the default — clears the override)
 *
 * Writes through `setDayOverride(i, { startLocation, startName } | { endLocation, endName })`.
 * Pure presentation over the trip store; data flow is unchanged.
 */
import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { dateRange, formatDateLabel, type LatLng, type Place } from '@/core';
import { placesProvider } from '@/services';
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
  // Fall back to all candidates if nothing is selected yet, so the picker/search
  // is never inertly empty.
  const pickablePlaces = useMemo(
    () => (selectedPlaces.length > 0 ? selectedPlaces : candidates),
    [selectedPlaces, candidates],
  );

  // Inline "pick from my places" target: which (day, edge) is choosing.
  const [picking, setPicking] = useState<{ index: number; edge: Edge } | null>(null);
  const [locating, setLocating] = useState(false);

  // Address input state: keyed by "i-edge" string
  const [addressDrafts, setAddressDrafts] = useState<Record<string, string>>({});
  const [geocoding, setGeocoding] = useState<Record<string, boolean>>({});
  const [geocodeHints, setGeocodeHints] = useState<Record<string, string>>({});

  const draftKey = (index: number, edge: Edge) => `${index}-${edge}`;

  const setDraft = useCallback((index: number, edge: Edge, text: string) => {
    setAddressDrafts((prev) => ({ ...prev, [draftKey(index, edge)]: text }));
    // Clear any prior hint when user types
    setGeocodeHints((prev) => {
      const next = { ...prev };
      delete next[draftKey(index, edge)];
      return next;
    });
  }, []);

  const submitAddress = useCallback(
    async (index: number, edge: Edge) => {
      const key = draftKey(index, edge);
      const text = (addressDrafts[key] ?? '').trim();
      if (!text) return;
      setGeocoding((prev) => ({ ...prev, [key]: true }));
      setGeocodeHints((prev) => { const n = { ...prev }; delete n[key]; return n; });
      try {
        const result = await placesProvider.geocodeAddress(text);
        if (result) {
          const patch: DayOverride =
            edge === 'start'
              ? { startLocation: result.location, startName: result.label }
              : { endLocation: result.location, endName: result.label };
          setDayOverride(index, patch);
          hapticImpact(ImpactFeedbackStyle.Light);
          // Clear the draft after success
          setAddressDrafts((prev) => { const n = { ...prev }; delete n[key]; return n; });
        } else {
          setGeocodeHints((prev) => ({
            ...prev,
            [key]: "Couldn't find that address — add the city name.",
          }));
          hapticNotify(NotificationFeedbackType.Warning);
        }
      } catch {
        setGeocodeHints((prev) => ({ ...prev, [key]: 'Address search failed' }));
        hapticNotify(NotificationFeedbackType.Error);
      } finally {
        setGeocoding((prev) => ({ ...prev, [key]: false }));
      }
    },
    [addressDrafts, setDayOverride],
  );

  const applyCurrentLocation = useCallback(
    async (index: number, edge: Edge) => {
      const key = draftKey(index, edge);
      setLocating(true);
      setGeocodeHints((prev) => { const n = { ...prev }; delete n[key]; return n; });
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          setGeocodeHints((prev) => ({ ...prev, [key]: 'Location permission denied — allow it in Settings.' }));
          hapticNotify(NotificationFeedbackType.Warning);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const loc: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const patch: DayOverride =
          edge === 'start'
            ? { startLocation: loc, startName: 'My location' }
            : { endLocation: loc, endName: 'My location' };
        setDayOverride(index, patch);
        hapticImpact(ImpactFeedbackStyle.Light);
      } catch {
        setGeocodeHints((prev) => ({
          ...prev,
          [key]: "Couldn't get your location. On the simulator set one in Features ▸ Location.",
        }));
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
      // Clear the address draft for this slot too
      setAddressDrafts((prev) => {
        const n = { ...prev };
        delete n[draftKey(index, edge)];
        return n;
      });
      setGeocodeHints((prev) => {
        const n = { ...prev };
        delete n[draftKey(index, edge)];
        return n;
      });
      hapticSelection();
    },
    [setDayOverride],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.scrim }]}>
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
                    index={i}
                    label="Start"
                    name={o.startName ?? 'City center'}
                    isDefault={!o.startLocation}
                    busy={locating}
                    picking={isPickingStart}
                    canPick={pickablePlaces.length > 0}
                    onCurrent={() => void applyCurrentLocation(i, 'start')}
                    onPickToggle={() => setPicking(isPickingStart ? null : { index: i, edge: 'start' })}
                    onDefault={() => applyCityCenter(i, 'start')}
                    places={pickablePlaces}
                    onSelectPlace={(p) => applyPlace(i, 'start', p)}
                    theme={theme}
                    hasCenter={!!center}
                    addressDraft={addressDrafts[draftKey(i, 'start')] ?? ''}
                    onAddressDraftChange={(t) => setDraft(i, 'start', t)}
                    onAddressSubmit={() => void submitAddress(i, 'start')}
                    geocoding={geocoding[draftKey(i, 'start')] ?? false}
                    geocodeHint={geocodeHints[draftKey(i, 'start')]}
                  />

                  <View style={[styles.divider, { backgroundColor: theme.colors.glassBorder }]} />

                  <EdgeRow
                    index={i}
                    label="End"
                    name={o.endName ?? (o.startName ?? 'City center')}
                    isDefault={!o.endLocation}
                    busy={locating}
                    picking={isPickingEnd}
                    canPick={pickablePlaces.length > 0}
                    onCurrent={() => void applyCurrentLocation(i, 'end')}
                    onPickToggle={() => setPicking(isPickingEnd ? null : { index: i, edge: 'end' })}
                    onDefault={() => applyCityCenter(i, 'end')}
                    places={pickablePlaces}
                    onSelectPlace={(p) => applyPlace(i, 'end', p)}
                    theme={theme}
                    hasCenter={!!center}
                    addressDraft={addressDrafts[draftKey(i, 'end')] ?? ''}
                    onAddressDraftChange={(t) => setDraft(i, 'end', t)}
                    onAddressSubmit={() => void submitAddress(i, 'end')}
                    geocoding={geocoding[draftKey(i, 'end')] ?? false}
                    geocodeHint={geocodeHints[draftKey(i, 'end')]}
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
  index: _index,
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
  addressDraft,
  onAddressDraftChange,
  onAddressSubmit,
  geocoding,
  geocodeHint,
}: {
  index: number;
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
  addressDraft: string;
  onAddressDraftChange: (t: string) => void;
  onAddressSubmit: () => void;
  geocoding: boolean;
  geocodeHint?: string;
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

      {/* Address / hotel input */}
      <View
        style={[
          styles.addressRow,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.sm,
          },
        ]}
      >
        <IconSymbol name="building.2" size={13} color={theme.colors.textTertiary} fallbackGlyph="🏨" />
        <TextInput
          value={addressDraft}
          onChangeText={onAddressDraftChange}
          onSubmitEditing={onAddressSubmit}
          placeholder="Hotel or address…"
          placeholderTextColor={theme.colors.textTertiary}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.addressInput, { color: theme.colors.text }]}
        />
        {geocoding ? (
          <Text variant="caption" tone="accent">
            …
          </Text>
        ) : addressDraft.trim() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Search ${label.toLowerCase()} address`}
            hitSlop={8}
            onPress={onAddressSubmit}
          >
            <Text variant="caption" weight="600" tone="accent">
              Go
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Live matches from the loaded places (works offline) — tap to use as the point. */}
      {addressDraft.trim().length > 0
        ? (() => {
            const q = addressDraft.trim().toLowerCase();
            const matches = places.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5);
            return matches.length > 0 ? (
              <View style={styles.pickList}>
                {matches.map((p) => (
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
            ) : null;
          })()
        : null}

      {geocodeHint ? (
        <Text variant="caption" tone="onGlassSecondary" style={{ marginTop: 4, marginLeft: 4 }}>
          {geocodeHint}
        </Text>
      ) : null}

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
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    height: 38,
    borderWidth: StyleSheet.hairlineWidth,
  },
  addressInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
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
