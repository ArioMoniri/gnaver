/**
 * Hairline divider, horizontal or vertical.
 */
import { View, type StyleProp, type ViewStyle, StyleSheet } from 'react-native';

import { useTheme } from '@/theme';

export interface DividerProps {
  vertical?: boolean;
  /** Inset from the leading/top edge. */
  inset?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function Divider({ vertical = false, inset = 0, color, style }: DividerProps) {
  const theme = useTheme();
  const line = color ?? theme.colors.border;

  if (vertical) {
    return (
      <View
        style={[
          { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: line, marginVertical: inset },
          style,
        ]}
      />
    );
  }
  return (
    <View
      style={[
        { height: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: line, marginLeft: inset },
        style,
      ]}
    />
  );
}
