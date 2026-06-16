/**
 * Paywall — "Gnaver Pro" premium modal.
 *
 * IAP is scaffolded only: tapping "Start Pro" shows an alert explaining that
 * subscriptions are coming soon. Real StoreKit / expo-iap wiring requires
 * App Store Connect product IDs and is omitted by design.
 *
 * Layout: hero glyph → plan toggle → two plan cards → CTA → footnote links.
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

import { useTheme } from '@/theme';
import {
  Button,
  GlassCard,
  GlassSurface,
  IconSymbol,
  Screen,
  Segmented,
  Tag,
  Text,
  hapticImpact,
  hapticSelection,
  hapticNotify,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from '@/components';

// ─── Plan data ────────────────────────────────────────────────────────────────

type BillingCycle = 'monthly' | 'yearly';

const PLAN_OPTIONS: { value: BillingCycle; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly  −50%' },
];

const PRICES: Record<BillingCycle, { display: string; subline: string }> = {
  monthly: { display: '$4.99', subline: 'per month' },
  yearly:  { display: '$29.99', subline: 'per year — save 50%' },
};

const PRO_BENEFITS = [
  { icon: '✨', text: 'No key setup — we run the AI for you' },
  { icon: '🌐', text: 'Hosted AI with priority routing' },
  { icon: '🗺️', text: 'Unlimited cities and multi-city trips' },
  { icon: '⚡️', text: 'Faster responses, latest models' },
  { icon: '🔒', text: 'Privacy-first — zero data retention' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PaywallScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cycle, setCycle] = useState<BillingCycle>('yearly');

  const close = useCallback(() => {
    hapticSelection();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const handleStartPro = useCallback(() => {
    hapticImpact(ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Coming Soon',
      'Subscriptions are coming soon! For now, Gnaver is completely free — add your own API keys in Settings to unlock live data.',
      [
        { text: 'Add my keys', style: 'default', onPress: () => { close(); router.push('/settings'); } },
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
    Alert.alert('Restore Purchases', 'No active subscription found. Subscriptions will be available soon.');
  }, []);

  const price = PRICES[cycle];

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
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <HeroSection theme={theme} />

        {/* ── Billing toggle ────────────────────────────────────────────────── */}
        <Segmented<BillingCycle>
          options={PLAN_OPTIONS}
          value={cycle}
          onChange={(v) => { hapticSelection(); setCycle(v); }}
        />

        {/* ── Plan cards ────────────────────────────────────────────────────── */}
        <View style={{ gap: theme.spacing.md }}>
          {/* Free card (current) */}
          <FreePlanCard theme={theme} onPress={handleContinueFree} />

          {/* Pro card */}
          <ProPlanCard theme={theme} cycle={cycle} price={price} onPress={handleStartPro} />
        </View>

        {/* ── Primary CTA ───────────────────────────────────────────────────── */}
        <Button
          title={`Start Pro — ${price.display}/${cycle === 'monthly' ? 'mo' : 'yr'}`}
          variant="primary"
          size="lg"
          fullWidth
          icon="sparkles"
          iconFallback="✨"
          haptic="impact"
          onPress={handleStartPro}
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

function HeroSection({ theme }: { theme: ReturnType<typeof useTheme> }) {
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
          accessibilityLabel="Gnaver Pro"
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
            <IconSymbol name="map.fill" size={44} color={theme.colors.onAccent} fallbackGlyph="🗺" />
          </LinearGradient>
        </Pressable>
      </Animated.View>

      <View style={styles.heroText}>
        <Text variant="title" weight="800" align="center">
          Gnaver Pro
        </Text>
        <Text variant="callout" tone="secondary" align="center" style={{ marginTop: 6, maxWidth: 260 }}>
          Travel smarter. No API key setup — we handle the AI so you can focus on the trip.
        </Text>
      </View>
    </View>
  );
}

// ─── Free plan card ───────────────────────────────────────────────────────────

function FreePlanCard({
  theme,
  onPress,
}: {
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <GlassCard padding="lg" radius="xl">
        <View style={styles.planHeader}>
          <View>
            <Text variant="headline" weight="700">Free</Text>
            <Text variant="footnote" tone="secondary">Your own keys</Text>
          </View>
          <Tag label="Current" tone="neutral" />
        </View>
        <View style={[styles.divider, { backgroundColor: theme.colors.border, marginVertical: theme.spacing.md }]} />
        <View style={{ gap: theme.spacing.sm }}>
          <BenefitRow icon="🔑" text="Bring your own API keys" theme={theme} />
          <BenefitRow icon="📊" text="Realistic sample data without keys" theme={theme} />
          <BenefitRow icon="🏙️" text="All supported cities" theme={theme} />
        </View>
      </GlassCard>
    </Pressable>
  );
}

// ─── Pro plan card ────────────────────────────────────────────────────────────

function ProPlanCard({
  theme,
  cycle,
  price,
  onPress,
}: {
  theme: ReturnType<typeof useTheme>;
  cycle: BillingCycle;
  price: { display: string; subline: string };
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {/* Outer glow border — accent soft ring */}
      <View
        style={[
          styles.proCardGlow,
          { borderRadius: theme.radius.xl + 2, borderColor: theme.colors.accent + '55' },
        ]}
      >
        <GlassCard padding="lg" radius="xl" floating>
          <LinearGradient
            pointerEvents="none"
            colors={[theme.colors.accentSoft, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: theme.radius.xl }]}
          />
          <View style={styles.planHeader}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <Text variant="headline" weight="700">Pro</Text>
                <Tag label="✨ Recommended" tone="accent" />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
                <Text variant="title2" weight="800" tone="accent">{price.display}</Text>
                <Text variant="footnote" tone="secondary">{price.subline}</Text>
              </View>
            </View>
          </View>

          {cycle === 'yearly' ? (
            <View
              style={[
                styles.savingsBadge,
                { backgroundColor: theme.colors.success + '22', borderRadius: theme.radius.sm, marginTop: theme.spacing.sm },
              ]}
            >
              <Text variant="footnote" tone="success" weight="600">
                Save ~$30/year vs monthly
              </Text>
            </View>
          ) : null}

          <View style={[styles.divider, { backgroundColor: theme.colors.border, marginVertical: theme.spacing.md }]} />

          <View style={{ gap: theme.spacing.sm }}>
            {PRO_BENEFITS.map((b) => (
              <BenefitRow key={b.text} icon={b.icon} text={b.text} theme={theme} accent />
            ))}
          </View>
        </GlassCard>
      </View>
    </Pressable>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function BenefitRow({
  icon,
  text,
  theme,
  accent = false,
}: {
  icon: string;
  text: string;
  theme: ReturnType<typeof useTheme>;
  accent?: boolean;
}) {
  return (
    <View style={styles.benefitRow}>
      <Text variant="subhead">{icon}</Text>
      <Text variant="subhead" tone={accent ? 'primary' : 'secondary'} style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

function FootnoteLinks({ onRestore }: { onRestore: () => void }) {
  return (
    <View style={styles.footnote}>
      <Pressable onPress={onRestore} accessibilityRole="button">
        <Text variant="footnote" tone="accent">Restore purchases</Text>
      </Pressable>
      <Text variant="footnote" tone="tertiary">·</Text>
      <Pressable onPress={() => void Linking.openURL('https://github.com/ruvnet/claude-flow')} accessibilityRole="link">
        <Text variant="footnote" tone="tertiary">Terms</Text>
      </Pressable>
      <Text variant="footnote" tone="tertiary">·</Text>
      <Pressable onPress={() => void Linking.openURL('https://github.com/ruvnet/claude-flow')} accessibilityRole="link">
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
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  proCardGlow: {
    borderWidth: 1.5,
  },
  savingsBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  footnote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
  },
});
