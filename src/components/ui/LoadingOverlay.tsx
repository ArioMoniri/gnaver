/**
 * Full-screen blocking overlay with the spinning-compass Lottie and a status
 * line — shown while the optimizer crunches a plan. Fades/scales in gently.
 */
import { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from './Text';
import { GlassCard } from './GlassCard';
import { Lottie } from './Lottie';

const compass = require('../../../assets/lottie/loading-compass.json');

export interface LoadingOverlayProps {
  visible: boolean;
  title?: string;
  status?: string;
}

export function LoadingOverlay({ visible, title = 'Optimising your trip', status }: LoadingOverlayProps) {
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
      <View style={[styles.scrim, { backgroundColor: theme.scheme === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(11,16,20,0.34)' }]}>
        <Animated.View
          style={{
            opacity: anim,
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
          }}
        >
          <GlassCard padding="lg" radius="xl" floating style={styles.card}>
            <Lottie source={compass} size={108} loop />
            <Text variant="headline" align="center" style={{ marginTop: theme.spacing.sm }}>
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
});
