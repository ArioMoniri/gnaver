/**
 * Crash-safe LottieView wrapper. If the animation source is missing, invalid, or
 * the native module throws, we degrade to a plain ActivityIndicator instead of
 * taking the screen down. Sources are bundled JSON imported by the caller.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import LottieView, { type LottieViewProps } from 'lottie-react-native';

import { useTheme } from '@/theme';

type LottieSource = LottieViewProps['source'];

export interface LottieProps {
  source: LottieSource;
  size?: number;
  loop?: boolean;
  autoPlay?: boolean;
  speed?: number;
  style?: StyleProp<ViewStyle>;
  /** Custom fallback; defaults to a themed spinner. */
  fallback?: ReactNode;
}

interface BoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

class LottieBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Swallow — the fallback covers the user-facing case.
  }

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export function Lottie({
  source,
  size = 96,
  loop = true,
  autoPlay = true,
  speed = 1,
  style,
  fallback,
}: LottieProps) {
  const theme = useTheme();

  const spinner = fallback ?? (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={theme.colors.accent} />
    </View>
  );

  if (!source) return <>{spinner}</>;

  return (
    <LottieBoundary fallback={spinner}>
      <LottieView
        source={source}
        autoPlay={autoPlay}
        loop={loop}
        speed={speed}
        style={[{ width: size, height: size }, style]}
      />
    </LottieBoundary>
  );
}
