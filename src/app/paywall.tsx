/**
 * Paywall — "Gnaver Credits" pay-as-you-go screen.
 *
 * Two ways to run the AI:
 *   • Bring your own API keys  → free, unlimited (you pay your own provider).
 *   • Buy credits             → we run the hosted AI for you (1 credit / plan).
 *
 * In-app purchases are scaffolded only: tapping "Buy" shows an honest alert.
 * It never fake-adds credits — real fulfilment needs App Store Connect
 * consumables plus a hosted backend (see docs/MONETIZATION.md).
 *
 * Layout: hero glyph + live balance → model explainer → credit-pack cards →
 * primary buy CTA → "continue free" → legal footnotes.
 */
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ColorValue,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CREDIT_PACKS, CREDITS_PER_PLAN, useCredits, type CreditPack } from '@/store';
import { useTheme } from '@/theme';
import {
  Button,
  GlassCard,
  IconSymbol,
  Screen,
  Tag,
  Text,
  hapticImpact,
  hapticSelection,
  hapticNotify,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from '@/components';

const REPO_URL = 'https://github.com/ArioMoniri/gnaver';

/** Per-credit unit price, e.g. "$0.30 / credit", parsed from the pack's display price. */
function perCreditLabel(pack: CreditPack): string {
  const amount = Number(pack.price.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(amount) || pack.credits <= 0) return '';
  return `$${(amount / pack.credits).toFixed(2)} / credit`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PaywallScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const balance = useCredits((c) => c.balance);

  const [selectedId, setSelectedId] = useState<string>(
    CREDIT_PACKS.find((p) => p.tag === 'Popular')?.id ?? CREDIT_PACKS[0]?.id ?? '',
  );
  const selectedPack = CREDIT_PACKS.find((p) => p.id === selectedId) ?? CREDIT_PACKS[0];

  const close = useCallback(() => {
    hapticSelection();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const handleSelect = useCallback((id: string) => {
    hapticSelection();
    setSelectedId(id);
  }, []);

  const handleBuy = useCallback(() => {
    hapticImpact(ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Launching soon',
      'In-app purchases are launching soon — for now, Gnaver is free with your own API keys (Settings).',
      [
        { text: 'Use my keys', style: 'default', onPress: () => { close(); router.push('/settings'); } },
        { text: 'OK', style: 'cancel' },
      ],
    );
  }, [close, router]);

  const handleContinueFree = useCallback(() => {
    hapticSelection();
    close();
    router.push('/settings');
  }, [close, router]);

  const handleRestore = useCallback(() => {
    hapticNotify(NotificationFeedbackType.Success);
    Alert.alert('Restore purchases', 'No previous purchases found. Credit purchases are launching soon.');
  }, []);

  return (
    <Screen onBack={close} backVariant="close" edgeToEdgeBottom background={theme.colors.background}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.xl,
          paddingBottom: insets.bottom + theme.spacing.xxl,
          gap: theme.spacing.xl,
          alignItems: 'stretch',
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero + live balance ───────────────────────────────────────────── */}
        <HeroSection theme={theme} balance={balance} />

        {/* ── Model explainer ───────────────────────────────────────────────── */}
        <GlassCard padding="lg" radius="xl">
          <Text variant="subhead" tone="secondary" align="center">
            Bring your own API keys — free, unlimited. Or buy credits and we run the AI for you
            {` (${CREDITS_PER_PLAN} credit = 1 optimized plan).`}
          </Text>
        </GlassCard>

        {/* ── Credit packs ──────────────────────────────────────────────────── */}
        <View style={{ gap: theme.spacing.md }}>
          {CREDIT_PACKS.map((pack) => (
            <CreditPackCard
              key={pack.id}
              pack={pack}
              selected={pack.id === selectedId}
              onPress={() => handleSelect(pack.id)}
              theme={theme}
            />
          ))}
        </View>

        {/* ── Primary CTA ───────────────────────────────────────────────────── */}
        <Button
          title={selectedPack ? `Buy ${selectedPack.credits} credits — ${selectedPack.price}` : 'Buy credits'}
          variant="primary"
          size="lg"
          fullWidth
          icon="sparkles"
          iconFallback="✨"
          haptic="impact"
          onPress={handleBuy}
        />

        {/* ── Secondary CTA ─────────────────────────────────────────────────── */}
        <Button
          title="Continue free with my keys"
          variant="ghost"
          fullWidth
          onPress={handleContinueFree}
        />

        {/* ── Legal footnotes ───────────────────────────────────────────────── */}
        <FootnoteLinks onRestore={handleRestore} />
      </ScrollView>
    </Screen>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection({ theme, balance }: { theme: ReturnType<typeof useTheme>; balance: number }) {
  const pulse = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(pulse, { toValue: 0.94, useNativeDriver: true, damping: 12, stiffness: 200, mass: 0.9 }).start();
  }, [pulse]);
  const onPressOut = useCallback(() => {
    Animated.spring(pulse, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 200, mass: 0.9 }).start();
  }, [pulse]);

  return (
    <View style={styles.heroWrap}>
      {/* Ambient accent glow */}
      <View style={[styles.glowRing, { backgroundColor: theme.colors.accentSoft }]} />

      <Animated.View style={[{ transform: [{ scale: pulse }] }]}>
        <Pressable
          accessibilityLabel="Gnaver Credits"
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={styles.heroGlyphWrap}
        >
          <LinearGradient
            colors={theme.gradients.brand as unknown as readonly [ColorValue, ColorValue, ColorValue]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroGlyph, theme.elevation.glass]}
          >
            {/* Specular highlight */}
            <View pointerEvents="none" style={[styles.heroSpecular, { backgroundColor: theme.colors.glassStroke }]} />
            <IconSymbol name="sparkles" size={44} color={theme.colors.onAccent} fallbackGlyph="✨" />
          </LinearGradient>
        </Pressable>
      </Animated.View>

      <View style={styles.heroText}>
        <Text variant="title" weight="800" align="center">
          Gnaver Credits
        </Text>

        {/* Live balance pill */}
        <View
          style={[
            styles.balancePill,
            {
              backgroundColor: theme.colors.accentSoft,
              borderColor: theme.colors.accent + '55',
              borderRadius: theme.radius.pill,
              marginTop: theme.spacing.md,
            },
          ]}
        >
          <View style={[styles.balanceDot, { backgroundColor: theme.colors.accent }]} />
          <Text variant="subhead" weight="700" tone="accent">
            {balance} {balance === 1 ? 'credit' : 'credits'}
          </Text>
        </View>

        <Text variant="callout" tone="secondary" align="center" style={{ marginTop: theme.spacing.md, maxWidth: 280 }}>
          Pay only for the plans you generate. No recurring charges, no commitment.
        </Text>
      </View>
    </View>
  );
}

// ─── Credit pack card ─────────────────────────────────────────────────────────

function CreditPackCard({
  pack,
  selected,
  onPress,
  theme,
}: {
  pack: CreditPack;
  selected: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const unit = perCreditLabel(pack);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}>
      <View
        style={[
          styles.packGlow,
          {
            borderRadius: theme.radius.xl + 2,
            borderColor: selected ? theme.colors.accent : 'transparent',
          },
        ]}
      >
        <GlassCard padding="lg" radius="xl" floating={selected}>
          {selected ? (
            <LinearGradient
              pointerEvents="none"
              colors={[theme.colors.accentSoft, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.xl }]}
            />
          ) : null}

          <View style={styles.packRow}>
            {/* Selection check + credits */}
            <View style={styles.packLeft}>
              <View
                style={[
                  styles.radio,
                  {
                    borderColor: selected ? theme.colors.accent : theme.colors.border,
                    backgroundColor: selected ? theme.colors.accent : 'transparent',
                  },
                ]}
              >
                {selected ? (
                  <IconSymbol name="checkmark" size={12} color={theme.colors.onAccent} fallbackGlyph="✓" weight="bold" />
                ) : null}
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <Text variant="title2" weight="800">{pack.credits}</Text>
                  <Text variant="subhead" tone="secondary" weight="600">credits</Text>
                  {pack.tag ? <Tag label={pack.tag} tone="accent" /> : null}
                </View>
                {unit ? (
                  <Text variant="footnote" tone="tertiary" style={{ marginTop: 2 }}>{unit}</Text>
                ) : null}
              </View>
            </View>

            {/* Price */}
            <Text variant="headline" weight="800" tone={selected ? 'accent' : 'primary'}>
              {pack.price}
            </Text>
          </View>
        </GlassCard>
      </View>
    </Pressable>
  );
}

// ─── Footnotes ────────────────────────────────────────────────────────────────

function FootnoteLinks({ onRestore }: { onRestore: () => void }) {
  return (
    <View style={styles.footnote}>
      <Pressable onPress={onRestore} accessibilityRole="button">
        <Text variant="footnote" tone="accent">Restore purchases</Text>
      </Pressable>
      <Text variant="footnote" tone="tertiary">·</Text>
      <Pressable onPress={() => void Linking.openURL(REPO_URL)} accessibilityRole="link">
        <Text variant="footnote" tone="tertiary">Terms</Text>
      </Pressable>
      <Text variant="footnote" tone="tertiary">·</Text>
      <Pressable onPress={() => void Linking.openURL(REPO_URL)} accessibilityRole="link">
        <Text variant="footnote" tone="tertiary">Privacy</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  heroWrap: {
    alignItems: 'center',
    gap: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  glowRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -20,
    opacity: 0.55,
  },
  heroGlyphWrap: {
    borderRadius: 32,
  },
  heroGlyph: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroSpecular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
    opacity: 0.7,
  },
  heroText: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  balanceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  packGlow: {
    borderWidth: 1.5,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footnote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
  },
});
