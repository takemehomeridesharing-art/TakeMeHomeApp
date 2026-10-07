import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks presses. */
  loading?: boolean;
  disabled?: boolean;
  /** Leading icon. */
  icon?: IconName;
  /** Trailing icon. */
  iconRight?: IconName;
  /** Stretch to the container width. */
  block?: boolean;
  /** Light haptic tap on native (default true). */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 36, md: 48, lg: 56 };
const PAD: Record<ButtonSize, number> = { sm: 14, md: 20, lg: 24 };

/** Pill button: primary (indigo), secondary (tint), ghost (text only), danger (coral — SOS/report only). */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  block = false,
  haptic = true,
  style,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const { colors, shadows } = useTheme();
  const palette = {
    primary: { bg: colors.primary, bgPressed: colors.primary2, fg: colors.onPrimary },
    secondary: { bg: colors.tint, bgPressed: '#DCE0FF', fg: colors.primary },
    ghost: { bg: 'transparent', bgPressed: colors.tint, fg: colors.primary },
    danger: { bg: colors.coral, bgPressed: '#E8462F', fg: '#FFFFFF' },
  }[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => {
        if (haptic && Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHT[size], paddingHorizontal: PAD[size], backgroundColor: pressed ? palette.bgPressed : palette.bg },
        variant === 'primary' && !inactive ? shadows.primary : null,
        block ? styles.block : styles.inline,
        disabled && !loading ? styles.disabled : null,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} color={palette.fg} /> : null}
          <Text variant="bodyStrong" style={[{ color: palette.fg }, size === 'sm' ? styles.smallLabel : null]} numberOfLines={1}>
            {label}
          </Text>
          {iconRight ? <Icon name={iconRight} size={size === 'sm' ? 16 : 20} color={palette.fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  block: { alignSelf: 'stretch' },
  inline: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.98 }] },
  smallLabel: { fontSize: 14 },
});
