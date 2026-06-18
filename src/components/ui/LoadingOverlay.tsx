/**
 * Full-screen blocking overlay shown while the optimizer crunches a plan.
 * A glass card with the Gnaver mark gently breathing + a status line — the same
 * modern logo used on the app icon and home screen, crisp at any size.
 */
import { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from './Text';
import { GlassCard } from './GlassCard';
import { BrandGlyph } from './BrandGlyph';

/** The Gnaver mark with a gentle, infinite breathing pulse — the brand loader. */
export function PulsingLogo({ size = 56 }: { size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.08, duration: 720, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 720, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <BrandGlyph size={size} />
    </Animated.View>
  );
}

export interface LoadingOverlayProps {
  visible: boolean;
  title?: string;
  status?: string;
}

export function LoadingOverlay({
  visible,
  title = 'Optimising your trip',
  status,
}: LoadingOverlayProps) {
  const theme = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      damping: theme.motion.springSoft.damping,
      stiffness: theme.motion.springSoft.stiffness,
      mass: theme.motion.springSoft.mass,
    }).start();
  }, [anim, theme.motion.springSoft, visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}>
        <Animated.View
          style={{
            opacity: anim,
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
          }}
        >
          <GlassCard padding="lg" radius="xl" floating style={styles.card}>
            <PulsingLogo size={56} />
            <Text variant="headline" align="center" style={{ marginTop: theme.spacing.lg }}>
              {title}
            </Text>
            <Text variant="footnote" tone="secondary" align="center" style={{ marginTop: 4 }}>
              {status ?? 'Routing stops, checking hours & weather…'}
            </Text>
          </GlassCard>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    minWidth: 240,
  },
});
