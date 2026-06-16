/**
 * Compact rating row: a single accent star, the numeric rating, and an optional
 * review count. Half-stars are rounded to one decimal in the number.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from './Text';
import { IconSymbol } from './IconSymbol';

export interface RatingStarsProps {
  rating?: number;
  count?: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function RatingStars({ rating, count, size = 13, style }: RatingStarsProps) {
  const theme = useTheme();
  if (rating == null) return null;

  return (
    <View style={[styles.row, style]}>
      <IconSymbol name="star.fill" size={size} color={theme.colors.warning} fallbackGlyph="★" />
      <Text variant="footnote" weight="600">
        {rating.toFixed(1)}
      </Text>
      {count != null && count > 0 ? (
        <Text variant="footnote" tone="tertiary">
          ({count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count})
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
});
