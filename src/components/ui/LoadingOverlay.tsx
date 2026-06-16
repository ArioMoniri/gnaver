/**
 * Full-screen blocking overlay shown while the optimizer crunches a plan.
 * A glass card with a clean native spinner + status line — crisp at any size,
 * no scaled-up imagery.
 */
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Modal, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from './Text';
import { GlassCard } from './GlassCard';

/** A small, crisp inline activity spinner in the brand accent. */
export function PulsingLogo({ size = 28 }: { size?: number }) {
  const theme = useTheme();
  return <ActivityIndicator size={size > 36 ? 'large' : 'small'} color={theme.colors.accent} />;
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
            <ActivityIndicator size="large" color={theme.colors.accent} />
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
