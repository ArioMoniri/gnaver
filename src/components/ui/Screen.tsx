/**
 * Screen scaffold: safe-area padding, app background, and an optional NavBar with
 * a back affordance, title/subtitle, and a single right action slot.
 */
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useTheme } from '@/theme';
import { Text } from './Text';
import { IconSymbol } from './IconSymbol';
import { hapticSelection } from './haptics';

export interface NavBarAction {
  icon: SFSymbol;
  iconFallback?: string;
  onPress: () => void;
  accessibilityLabel: string;
}

export interface ScreenProps {
  children: ReactNode;
  /** Render a navigation bar at the top. */
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  /** Use an X (modal dismiss) instead of a chevron for the back control. */
  backVariant?: 'chevron' | 'close';
  rightAction?: NavBarAction;
  /** Skip the bottom safe-area inset (e.g. when a sticky bar handles it). */
  edgeToEdgeBottom?: boolean;
  /** Background override — pass 'transparent' for map screens. */
  background?: string;
  style?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  title,
  subtitle,
  onBack,
  backVariant = 'chevron',
  rightAction,
  edgeToEdgeBottom = false,
  background,
  style,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const showNav = !!(title || onBack || rightAction);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: background ?? theme.colors.background, paddingTop: insets.top },
        style,
      ]}
    >
      {showNav ? (
        <View style={[styles.nav, { paddingHorizontal: theme.spacing.md }]}>
          <View style={styles.navSide}>
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={backVariant === 'close' ? 'Close' : 'Back'}
                hitSlop={10}
                onPress={() => {
                  hapticSelection();
                  onBack();
                }}
                style={[styles.navBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              >
                <IconSymbol
                  name={backVariant === 'close' ? 'xmark' : 'chevron.left'}
                  size={18}
                  color={theme.colors.text}
                  weight="semibold"
                />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.navCenter}>
            {title ? (
              <Text variant="headline" align="center" numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text variant="caption" tone="secondary" align="center" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          <View style={[styles.navSide, styles.navSideEnd]}>
            {rightAction ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={rightAction.accessibilityLabel}
                hitSlop={10}
                onPress={() => {
                  hapticSelection();
                  rightAction.onPress();
                }}
                style={[styles.navBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
              >
                <IconSymbol
                  name={rightAction.icon}
                  size={18}
                  color={theme.colors.text}
                  weight="semibold"
                  fallbackGlyph={rightAction.iconFallback}
                />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={[styles.body, { paddingBottom: edgeToEdgeBottom ? 0 : insets.bottom }]}>{children}</View>
    </View>
  );
}

const NAV_BTN = 38;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  nav: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
  },
  navSide: {
    width: NAV_BTN + 8,
    justifyContent: 'center',
  },
  navSideEnd: {
    alignItems: 'flex-end',
  },
  navCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtn: {
    width: NAV_BTN,
    height: NAV_BTN,
    borderRadius: NAV_BTN / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
  },
});
