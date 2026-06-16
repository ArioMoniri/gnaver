/**
 * Full-screen blocking overlay with the Gnaver pin logo and a status line —
 * shown while the optimizer crunches a plan. The card fades/scales in gently;
 * the logo breathes with a soft, looping pulse (scale + fade) so the screen
 * feels alive without a spinner. Honours theme motion tokens.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { useTheme } from '@/theme';
import { Text } from './Text';
import { GlassCard } from './GlassCard';

const logo = require('../../../assets/images/splash-icon.png');

export interface LoadingOverlayProps {
  visible: boolean;
  title?: string;
  status?: string;
  /** Logo footprint — defaults to a large hero mark on the blocking overlay. */
  size?: number;
}

/**
 * The breathing Gnaver pin mark — a soft, looping scale + opacity pulse driven by
 * `Animated`. Reused on the blocking overlay and inline (small) where an
 * ActivityIndicator would otherwise read as generic.
 */
export function PulsingLogo({ size = 96 }: { size?: number }) {
  const theme = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: theme.motion.durationSlow + 200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: theme.motion.durationSlow + 200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, theme.motion.durationSlow]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0] });

  return (
    <View style={[styles.logoWrap, { width: size, height: size }]}>
      {/* Soft accent halo that expands and fades as the mark breathes. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.colors.accentSoft,
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          },
        ]}
      />
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <Image
          source={logo}
          style={{ width: size, height: size }}
          contentFit="contain"
          accessibilityLabel="Gnaver"
        />
      </Animated.View>
    </View>
  );
}

export function LoadingOverlay({ visible, title = 'Optimising your trip', status, size = 104 }: LoadingOverlayProps) {
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
            <PulsingLogo size={size} />
            <Text variant="headline" align="center" style={{ marginTop: theme.spacing.md }}>
              {title}
            </Text>
            <Text variant="footnote" tone="secondary" align="center" style={{ marginTop: 2 }}>
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
    minWidth: 260,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
});
