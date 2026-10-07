import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

export interface LoadingStateProps {
  label?: string;
  /** Fill the available space and centre (default true). */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Centred indigo spinner with an optional caption. */
export function LoadingState({ label, fill = true, style }: LoadingStateProps) {
  const { colors } = useTheme();
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }, fill ? { flex: 1 } : null, style]}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <Text variant="caption">{label}</Text> : null}
    </View>
  );
}
