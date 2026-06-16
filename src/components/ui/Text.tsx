/**
 * Themed text primitive. Maps the design-system type scale to a single prop so
 * every label in the app shares one source of truth for size, weight and colour.
 */
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme';

type Variant =
  | 'hero'
  | 'display'
  | 'title'
  | 'title2'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption';

type Tone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'accent'
  | 'onAccent'
  | 'onGlass'
  | 'onGlassSecondary'
  | 'danger'
  | 'success';

export interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
  /** Tighten or loosen the default letter-spacing for the variant. */
  tracking?: number;
}

export function Text({
  variant = 'body',
  tone = 'primary',
  weight,
  align,
  tracking,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const scale = theme.typography[variant];

  const color =
    tone === 'secondary'
      ? theme.colors.textSecondary
      : tone === 'tertiary'
        ? theme.colors.textTertiary
        : tone === 'accent'
          ? theme.colors.accent
          : tone === 'onAccent'
            ? theme.colors.onAccent
            : tone === 'onGlass'
              ? theme.colors.onGlass
              : tone === 'onGlassSecondary'
                ? theme.colors.onGlassSecondary
                : tone === 'danger'
              ? theme.colors.danger
              : tone === 'success'
                ? theme.colors.success
                : theme.colors.text;

  return (
    <RNText
      style={[
        {
          color,
          fontFamily: theme.typography.family,
          fontSize: scale.fontSize,
          lineHeight: scale.lineHeight,
          fontWeight: weight ?? scale.fontWeight,
          letterSpacing: tracking ?? ('letterSpacing' in scale ? scale.letterSpacing : 0),
          textAlign: align,
        },
        style,
      ]}
      {...rest}
    />
  );
}
