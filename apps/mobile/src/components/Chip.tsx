import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Rounded selectable chip (filters, weekday pickers, tags). Selected = indigo wash + indigo text. */
export function Chip({ label, selected = false, onPress, icon, disabled, style }: ChipProps) {
  const s = useStyles();
  const { colors } = useTheme();
  const fg = selected ? colors.primary : colors.ink2;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [s.chip, selected ? s.selected : null, pressed ? s.pressed : null, disabled ? s.disabled : null, style]}
    >
      {icon ? <Icon name={icon} size={15} color={fg} /> : null}
      <Text variant="caption" style={[s.label, { color: fg }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
    alignSelf: 'flex-start',
  },
  selected: { backgroundColor: t.colors.tint, borderColor: t.colors.primary },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
  label: { fontFamily: t.fonts.bodySemiBold },
}));
