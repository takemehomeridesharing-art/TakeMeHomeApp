import * as Haptics from 'expo-haptics';
import { Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Pill segmented control (e.g. Passenger / Driver mode, Today / Tomorrow). Active segment = indigo pill. */
export function SegmentedControl<T extends string>({ options, value, onChange, style, testID }: SegmentedControlProps<T>) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[s.wrap, style]} accessibilityRole="tablist" testID={testID}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            testID={testID ? `${testID}-${o.value}` : undefined}
            onPress={() => {
              if (active) return;
              if (Platform.OS !== 'web') void Haptics.selectionAsync();
              onChange(o.value);
            }}
            style={[s.segment, active ? s.active : null]}
          >
            {o.icon ? <Icon name={o.icon} size={16} color={active ? colors.onPrimary : colors.ink2} /> : null}
            <Text variant="bodyStrong" style={[s.label, { color: active ? colors.onPrimary : colors.ink2 }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: t.radius.pill, backgroundColor: t.colors.bg, borderWidth: 1, borderColor: t.colors.line },
  segment: { flex: 1, height: 42, borderRadius: t.radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  active: { backgroundColor: t.colors.primary, ...t.shadows.primary },
  label: { fontSize: 14 },
}));
