import { type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components';
import { makeStyles } from '@/theme';

export interface SectionProps {
  title: string;
  /** Count pill next to the title. */
  count?: number;
  /** Highlight the count pill in amber (e.g. requests waiting). */
  countTone?: 'primary' | 'accent';
  action?: { label: string; onPress: () => void };
  subtitle?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** A titled block on driver screens: title · count pill · optional link, then content. */
export function Section({ title, count, countTone = 'primary', action, subtitle, children, style, testID }: SectionProps) {
  const s = useStyles();
  return (
    <View style={[s.section, style]} testID={testID}>
      <View style={s.head}>
        <View style={s.titleRow}>
          <Text variant="h3">{title}</Text>
          {count !== undefined && count > 0 ? (
            <View style={[s.count, countTone === 'accent' ? s.countAccent : null]}>
              <Text style={[s.countText, countTone === 'accent' ? s.countTextAccent : null]}>{count}</Text>
            </View>
          ) : null}
        </View>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button">
            <Text variant="caption" color="primary" style={s.action}>
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {subtitle ? (
        <Text variant="caption" style={s.subtitle}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  section: { gap: 10, marginTop: 24 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: t.colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countAccent: { backgroundColor: t.colors.accent },
  countText: {
    fontFamily: t.fonts.heading,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.primary,
  },
  countTextAccent: { color: t.colors.ink },
  action: { fontFamily: t.fonts.bodySemiBold },
  subtitle: { marginTop: -4 },
}));
