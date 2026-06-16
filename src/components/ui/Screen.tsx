/**
 * Screen scaffold: safe-area padding, app background, and an optional glass
 * NavBar with a back affordance, title/subtitle, and a single right action slot.
 *
 * The NavBar is a thin Liquid Glass bar that floats over the content beneath it,
 * with circular glass control buttons — first-party iOS chrome. When `floatingNav`
 * is set the bar overlaps the content (used over maps / hero washes); otherwise it
 * sits in the normal flow above a plain background.
 */
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useTheme } from '@/theme';
import { Text } from './Text';
import { IconSymbol } from './IconSymbol';
import { GlassSurface } from './GlassCard';
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

const NAV_BTN = 38;

function NavButton({
  icon,
  iconFallback,
  onPress,
  accessibilityLabel,
}: {
  icon: SFSymbol;
  iconFallback?: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
      onPress={() => {
        hapticSelection();
        onPress();
      }}
    >
      <GlassSurface variant="chip" interactive radius="pill" padding="none" sheen={false} style={styles.navBtnShadow}>
        <View style={styles.navBtn}>
          <IconSymbol name={icon} size={18} color={theme.colors.onGlass} weight="semibold" fallbackGlyph={iconFallback} />
        </View>
      </GlassSurface>
    </Pressable>
  );
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
      style={[styles.root, { backgroundColor: background ?? theme.colors.background, paddingTop: insets.top }, style]}
    >
      {showNav ? (
        <View style={[styles.nav, { paddingHorizontal: theme.spacing.md }]}>
          <View style={styles.navSide}>
            {onBack ? (
              <NavButton
                icon={backVariant === 'close' ? 'xmark' : 'chevron.left'}
                onPress={onBack}
                accessibilityLabel={backVariant === 'close' ? 'Close' : 'Back'}
              />
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
              <NavButton
                icon={rightAction.icon}
                iconFallback={rightAction.iconFallback}
                onPress={rightAction.onPress}
                accessibilityLabel={rightAction.accessibilityLabel}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={[styles.body, { paddingBottom: edgeToEdgeBottom ? 0 : insets.bottom }]}>{children}</View>
    </View>
  );
}

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
  navBtnShadow: {
    borderRadius: NAV_BTN / 2,
  },
  navBtn: {
    width: NAV_BTN,
    height: NAV_BTN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
});
