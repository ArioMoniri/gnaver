/**
 * Choose places — refine the candidate pool before optimising. Toggle rows, add
 * a custom stop, then commit to the optimiser. Handles empty / loading / error.
 */
import { useCallback, useMemo, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, TextInput, UIManager, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Place } from '@/core';
import { useTheme } from '@/theme';
import { useTrip } from '@/store/tripStore';
import {
  Button,
  EmptyState,
  GlassCard,
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
  const selectedIds = useTrip((s) => s.selectedIds);
  const currency = useTrip((s) => s.currency);
  const center = useTrip((s) => s.center);
  const status = useTrip((s) => s.status);
  const error = useTrip((s) => s.error);
  const toggleSelect = useTrip((s) => s.toggleSelect);
  const setAllSelected = useTrip((s) => s.setAllSelected);
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
            paddingBottom: insets.bottom + 120,
            gap: theme.spacing.sm,
          }}
          showsVerticalScrollIndicator={false}
        >
          {candidates.map((place) => (
            <PlaceSelectRow
              key={place.id}
              place={place}
              selected={!!selectedIds[place.id]}
              currency={currency}
              onToggle={toggleSelect}
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

      {/* Sticky optimise bar */}
      {candidates.length > 0 ? (
        <View style={[styles.bar, { paddingBottom: insets.bottom + theme.spacing.sm, paddingHorizontal: theme.spacing.lg }]}>
          <GlassCard padding="sm" radius="xl" floating style={styles.barCard}>
            <View style={{ flex: 1 }}>
              <Text variant="footnote" tone="secondary">
                {selectedCount} {selectedCount === 1 ? 'place' : 'places'}
              </Text>
              <Text variant="subhead" weight="600">
                Ready to optimise
              </Text>
            </View>
            <Button
              title="Optimize my trip"
              icon="arrow.right"
              iconFallback="→"
              trailingIcon
              disabled={selectedCount === 0 || generating}
              loading={generating}
              onPress={onOptimize}
            />
          </GlassCard>
        </View>
      ) : null}

      <LoadingOverlay visible={generating} />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
  },
  barCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
