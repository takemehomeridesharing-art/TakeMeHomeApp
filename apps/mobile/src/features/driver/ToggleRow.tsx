import { type ReactNode } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { Icon, Text, type IconName } from '@/components';
import { makeStyles, useTheme } from '@/theme';
import { hapticTap } from './haptics';

export interface ToggleRowProps {
  title: string;
  subtitle?: ReactNode;
  icon?: IconName;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

/** Icon · title + explanation · switch. The whole row is tappable. */
export function ToggleRow({ title, subtitle, icon, value, onChange, disabled, testID }: ToggleRowProps) {
  const s = useStyles();
  const { colors } = useTheme();
  const toggle = () => {
    if (disabled) return;
    hapticTap();
    onChange(!value);
  };
  return (
    <Pressable
      onPress={toggle}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={[s.row, disabled ? s.disabled : null]}
      testID={testID}
    >
      {icon ? (
        <View style={[s.icon, value ? s.iconOn : null]}>
          <Icon name={icon} size={18} color={value ? 'onPrimary' : 'primary'} />
        </View>
      ) : null}
      <View style={s.texts}>
        <Text variant="bodyStrong">{title}</Text>
        {typeof subtitle === 'string' ? <Text variant="caption">{subtitle}</Text> : subtitle}
      </View>
      <Switch
        value={value}
        onValueChange={() => toggle()}
        disabled={disabled}
        trackColor={{ false: colors.line, true: colors.primary }}
        thumbColor={colors.surface}
        {...({ activeThumbColor: colors.surface } as object)}
      />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  disabled: { opacity: 0.55 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: t.colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOn: { backgroundColor: t.colors.primary },
  texts: { flex: 1, gap: 2 },
}));
