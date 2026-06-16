/**
 * Place detail sheet — tap a stop to see its photos and Google reviews in-app,
 * with a link out to Google Maps. Photos + reviews come from
 * `placesProvider.placeDetails` (live Google Place Details when a key is set;
 * the Place's own photo + a Maps search link when offline).
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { formatEntry, type CurrencyCode, type Place, type PlaceDetails } from '@/core';
import { placesProvider } from '@/services';
import { useTheme } from '@/theme';
import {
  Button,
  GlassSurface,
  IconSymbol,
  RatingStars,
  Tag,
  Text,
  hapticImpact,
  ImpactFeedbackStyle,
} from '@/components/ui';
import { categoryMeta } from './placeMeta';

export interface PlaceDetailSheetProps {
  /** The tapped place, or null when the sheet is closed. */
  place: Place | null;
  currency: CurrencyCode;
  onClose: () => void;
}

export function PlaceDetailSheet({ place, currency, onClose }: PlaceDetailSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!place) {
      setDetails(null);
      return;
    }
    setLoading(true);
    setDetails(null);
    placesProvider
      .placeDetails(place)
      .then((d) => alive && setDetails(d))
      .catch(() => alive && setDetails(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [place]);

  if (!place) return null;

  const meta = categoryMeta(place.category);
  const photos = details?.photos ?? (place.photoUrl ? [place.photoUrl] : []);
  const rating = details?.rating ?? place.rating;
  const count = details?.userRatingsTotal ?? place.userRatingsTotal;
  const reviews = details?.reviews ?? [];
  const address = details?.address ?? place.address;
  const mapsUrl = details?.googleMapsUrl;

  const openMaps = async () => {
    if (!mapsUrl) return;
    hapticImpact(ImpactFeedbackStyle.Light);
    const ok = await Linking.canOpenURL(mapsUrl).catch(() => false);
    if (ok) await Linking.openURL(mapsUrl).catch(() => {});
  };

  return (
    <Modal visible={!!place} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close" onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              paddingBottom: insets.bottom + theme.spacing.md,
              maxHeight: '88%',
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />

          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text variant="title2" numberOfLines={2}>
                {place.name}
              </Text>
              <View style={styles.metaRow}>
                <Tag label={meta.label} tone={place.isFood ? 'food' : 'neutral'} emoji={meta.emoji} />
                {rating != null ? <RatingStars rating={rating} count={count} /> : null}
              </View>
            </View>
            <Button title="Done" variant="ghost" size="sm" onPress={onClose} />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl, gap: theme.spacing.md }}
            showsVerticalScrollIndicator={false}
          >
            {/* Photo carousel */}
            {photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {photos.map((uri, i) => (
                  <Image
                    key={`${uri}-${i}`}
                    source={{ uri }}
                    style={[styles.photo, { borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceElevated }]}
                    contentFit="cover"
                    transition={180}
                  />
                ))}
              </ScrollView>
            ) : (
              <LinearGradient
                colors={theme.gradients.accentWash as unknown as readonly [string, string]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={[styles.photo, styles.photoPlaceholder, { borderRadius: theme.radius.lg }]}
              >
                <Text variant="title">{meta.emoji}</Text>
              </LinearGradient>
            )}

            {/* Quick facts */}
            <View style={styles.facts}>
              <Fact icon="eurosign.circle" glyph="€" text={formatEntry(place.price, currency)} theme={theme} />
              {details?.openNow != null ? (
                <Fact
                  icon="clock"
                  glyph="🕐"
                  text={details.openNow ? 'Open now' : 'Closed now'}
                  theme={theme}
                />
              ) : null}
            </View>
            {address ? (
              <Text variant="footnote" tone="secondary">
                {address}
              </Text>
            ) : null}

            {/* Reviews */}
            {loading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={theme.colors.accent} />
                <Text variant="footnote" tone="tertiary" style={{ marginTop: 8 }}>
                  Loading photos & reviews…
                </Text>
              </View>
            ) : reviews.length > 0 ? (
              <View style={{ gap: 10 }}>
                <Text variant="headline" tone="onGlass">
                  Reviews
                </Text>
                {reviews.map((r, i) => (
                  <GlassSurface key={i} variant="panel" radius="lg" padding="md" floating>
                    <View style={styles.reviewHead}>
                      <Text variant="subhead" weight="700" tone="onGlass" numberOfLines={1} style={{ flex: 1 }}>
                        {r.author}
                      </Text>
                      {r.rating > 0 ? <RatingStars rating={r.rating} /> : null}
                    </View>
                    {r.relativeTime ? (
                      <Text variant="caption" tone="tertiary" style={{ marginTop: 2 }}>
                        {r.relativeTime}
                      </Text>
                    ) : null}
                    {r.text ? (
                      <Text variant="footnote" tone="secondary" style={{ marginTop: 6 }} numberOfLines={6}>
                        {r.text}
                      </Text>
                    ) : null}
                  </GlassSurface>
                ))}
              </View>
            ) : details?.fromPlace ? (
              <Text variant="footnote" tone="tertiary">
                Connect a Google key in Settings for live photos & reviews.
              </Text>
            ) : null}
          </ScrollView>

          {mapsUrl ? (
            <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
              <Button title="Open in Google Maps" icon="map.fill" iconFallback="🗺" onPress={openMaps} />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Fact({
  icon,
  glyph,
  text,
  theme,
}: {
  icon: Parameters<typeof IconSymbol>[0]['name'];
  glyph: string;
  text: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.fact}>
      <IconSymbol name={icon} size={14} color={theme.colors.onGlassSecondary} fallbackGlyph={glyph} />
      <Text variant="footnote" tone="secondary">
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: 8,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  photo: {
    width: 260,
    height: 170,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  facts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  loading: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
