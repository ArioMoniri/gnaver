/**
 * Choose places — refine the candidate pool before optimising. Toggle rows, add
 * a custom stop, then commit to the optimiser. Handles empty / loading / error.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Place } from '@/core';
import { useTheme } from '@/theme';
import { useTrip } from '@/store/tripStore';
import {
  Button,
  DayOptionsSheet,
  EmptyState,
  GlassSurface,
  IconSymbol,
  LoadingOverlay,
  PlaceSelectRow,
  Screen,
  Text,
  hapticImpact,
  hapticSelection,
  ImpactFeedbackStyle,
} from '@/components';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SelectScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const candidates = useTrip((s) => s.candidates);
  const importedSample = useTrip((s) => s.importedSample);
  const selectedIds = useTrip((s) => s.selectedIds);
  const currency = useTrip((s) => s.currency);
  const center = useTrip((s) => s.center);
  const status = useTrip((s) => s.status);
  const error = useTrip((s) => s.error);
  const dayCount = useTrip((s) => s.dayCount);
  const toggleSelect = useTrip((s) => s.toggleSelect);
  const setAllSelected = useTrip((s) => s.setAllSelected);
  const setMustSee = useTrip((s) => s.setMustSee);
  const addCustomPlace = useTrip((s) => s.addCustomPlace);
  const removeCandidate = useTrip((s) => s.removeCandidate);
  const generate = useTrip((s) => s.generate);

  const selectedCount = useMemo(
    () => candidates.filter((p) => selectedIds[p.id]).length,
    [candidates, selectedIds],
  );
  const allSelected = selectedCount === candidates.length && candidates.length > 0;

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [showDayOptions, setShowDayOptions] = useState(false);
  const [barHeight, setBarHeight] = useState(96);

  const onBarLayout = useCallback((e: LayoutChangeEvent) => {
    setBarHeight(e.nativeEvent.layout.height);
  }, []);

  const generating = status === 'generating';

  const toggleAll = useCallback(() => {
    hapticSelection();
    setAllSelected(!allSelected);
  }, [allSelected, setAllSelected]);

  const openAdd = useCallback(() => {
    hapticSelection();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAdding((v) => !v);
  }, []);

  const submitAdd = useCallback(() => {
    const name = newName.trim();
    if (!name || !center) return;
    const place: Place = {
      id: `custom-${Date.now()}`,
      name,
      location: center,
      category: 'other',
      interests: [],
      dwellMinutes: 60,
      weatherSensitivity: 'mixed',
    };
    addCustomPlace(place);
    hapticImpact(ImpactFeedbackStyle.Light);
    setNewName('');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAdding(false);
  }, [addCustomPlace, center, newName]);

  const onOptimize = useCallback(async () => {
    if (selectedCount === 0) return;
    hapticImpact(ImpactFeedbackStyle.Medium);
    await generate();
    // Read the freshest status after the async action settles.
    if (useTrip.getState().status === 'ready') {
      router.push('/plan');
    }
  }, [generate, router, selectedCount]);

  const subtitle = candidates.length > 0 ? `${selectedCount} of ${candidates.length} selected` : undefined;

  return (
    <Screen
      title="Choose places"
      subtitle={subtitle}
      onBack={() => router.back()}
      edgeToEdgeBottom
      rightAction={
        candidates.length > 0
          ? {
              icon: allSelected ? 'circle' : 'checkmark.circle.fill',
              iconFallback: allSelected ? '○' : '✓',
              onPress: toggleAll,
              accessibilityLabel: allSelected ? 'Deselect all' : 'Select all',
            }
          : undefined
      }
    >
      {candidates.length === 0 ? (
        <EmptyState
          title="No places yet"
          message="Go back and pick a city or load a Google Maps list to get started."
          action={<Button title="Back to start" variant="secondary" onPress={() => router.back()} />}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.sm,
            paddingBottom: barHeight + theme.spacing.md,
            gap: theme.spacing.sm,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Honest disclosure when the pasted list fell back to sample data. */}
          {importedSample ? (
            <View
              style={[
                styles.sampleBanner,
                { backgroundColor: `${theme.colors.warning}1A`, borderColor: `${theme.colors.warning}33`, borderRadius: theme.radius.md },
              ]}
            >
              <IconSymbol name="info.circle.fill" size={15} color={theme.colors.warning} fallbackGlyph="ⓘ" style={styles.sampleIcon} />
              <Text variant="footnote" tone="secondary" style={{ flex: 1, flexShrink: 1 }}>
                We couldn&apos;t read that list directly — here&apos;s a sample you can edit.
              </Text>
            </View>
          ) : null}

          {/* Day options entry */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit day start and end points"
            onPress={() => {
              hapticSelection();
              setShowDayOptions(true);
            }}
            style={({ pressed }) => [
              styles.dayOptRow,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg },
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={[styles.dayOptIcon, { backgroundColor: theme.colors.accentSoft, borderRadius: theme.radius.md }]}>
              <IconSymbol name="point.topleft.down.curvedto.point.bottomright.up.fill" size={18} color={theme.colors.accent} fallbackGlyph="🧭" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="subhead" weight="600">
                Day options
              </Text>
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                Start &amp; end for {dayCount} {dayCount === 1 ? 'day' : 'days'} — hotel, your location, or city center
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={14} color={theme.colors.textTertiary} fallbackGlyph="›" />
          </Pressable>

          <Text variant="footnote" tone="tertiary" style={{ marginTop: theme.spacing.xs }}>
            Tap ☆ to mark a must-see — we&apos;ll prioritise it.
          </Text>

          {candidates.map((place) => (
            <PlaceSelectRow
              key={place.id}
              place={place}
              selected={!!selectedIds[place.id]}
              currency={currency}
              onToggle={toggleSelect}
              onToggleMustSee={setMustSee}
              onRemove={place.id.startsWith('custom-') ? removeCandidate : undefined}
            />
          ))}

          {/* Add a place */}
          {adding ? (
            <View
              style={[
                styles.addForm,
                { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderColor: theme.colors.border },
              ]}
            >
              <Text variant="subhead" weight="600">
                Add a place
              </Text>
              <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                Dropped at the trip centre — the optimiser will slot it in.
              </Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                onSubmitEditing={submitAdd}
                placeholder="e.g. Friend's rooftop bar"
                placeholderTextColor={theme.colors.textTertiary}
                autoFocus
                returnKeyType="done"
                style={[
                  styles.addInput,
                  { backgroundColor: theme.colors.background, borderColor: theme.colors.border, borderRadius: theme.radius.md, color: theme.colors.text },
                ]}
              />
              <View style={styles.addActions}>
                <Button title="Cancel" variant="ghost" size="sm" onPress={openAdd} />
                <Button title="Add place" variant="secondary" size="sm" onPress={submitAdd} disabled={!newName.trim() || !center} />
              </View>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={openAdd}
              style={[styles.addRow, { borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}
            >
              <IconSymbol name="plus" size={16} color={theme.colors.accent} weight="semibold" />
              <Text variant="subhead" weight="600" tone="accent">
                Add a place
              </Text>
            </Pressable>
          )}

          {error && status === 'error' ? (
            <Text variant="footnote" tone="danger" align="center" style={{ marginTop: theme.spacing.sm }}>
              {error}
            </Text>
          ) : null}
        </ScrollView>
      )}

      {/* Pinned edge-to-edge optimise bar. The overflow wrapper rounds only the
          top corners; the glass fills full-width to the screen edges. */}
      {candidates.length > 0 ? (
        <View
          style={[styles.barWrap, { borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl }]}
          onLayout={onBarLayout}
        >
          <GlassSurface variant="bar" radius="xl" padding="none" sheen={false} floating style={styles.barFill}>
            <View
              style={[
                styles.barInner,
                { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: Math.max(insets.bottom, theme.spacing.sm) },
              ]}
            >
              <View style={styles.barRow}>
                <Text variant="footnote" tone="onGlassSecondary" style={{ flexShrink: 1 }} numberOfLines={1}>
                  {selectedCount} {selectedCount === 1 ? 'place' : 'places'} selected
                </Text>
              </View>
              <Button
                title="Optimize my trip"
                icon="arrow.right"
                iconFallback="→"
                trailingIcon
                fullWidth
                size="lg"
                disabled={selectedCount === 0 || generating}
                loading={generating}
                onPress={onOptimize}
              />
            </View>
          </GlassSurface>
        </View>
      ) : null}

      <DayOptionsSheet visible={showDayOptions} onClose={() => setShowDayOptions(false)} />

      <LoadingOverlay visible={generating} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sampleBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  sampleIcon: {
    marginTop: 1,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addForm: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  addInput: {
    height: 46,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    marginTop: 12,
  },
  addActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  barWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  barFill: {
    borderRadius: 0,
  },
  barInner: {
    gap: 10,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayOptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayOptIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
