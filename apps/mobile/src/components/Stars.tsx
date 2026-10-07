import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export interface StarsProps {
  /** 0–5, halves rendered in display mode. */
  value: number;
  /** Makes the stars tappable (input mode). */
  onChange?: (stars: number) => void;
  size?: number;
  /** Show the numeric value (and `count` if given) after the stars, e.g. `4.8 (32)`. */
  showValue?: boolean;
  count?: number;
  style?: StyleProp<ViewStyle>;
}

/** Amber star rating: display (`<Stars value={4.6} showValue count={12} />`) or input (`onChange`). */
export function Stars({ value, onChange, size = 16, showValue = false, count, style }: StarsProps) {
  const { colors } = useTheme();
  const gap = onChange ? size * 0.3 : 2;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]} accessibilityLabel={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const name = value >= n ? 'star' : value >= n - 0.5 ? 'star-half' : 'star-outline';
        const icon = <Icon name={name} size={size} color={value >= n - 0.5 ? colors.accent : colors.line} />;
        return onChange ? (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}>
            {icon}
          </Pressable>
        ) : (
          <View key={n}>{icon}</View>
        );
      })}
      {showValue ? (
        <Text variant="caption" color="ink" style={{ marginLeft: 4, fontVariant: ['tabular-nums'] }}>
          {value > 0 ? value.toFixed(1) : 'New'}
          {count !== undefined && value > 0 ? <Text variant="caption"> ({count})</Text> : null}
        </Text>
      ) : null}
    </View>
  );
}
