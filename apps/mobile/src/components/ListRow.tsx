import { type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles, type ColorTokens } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Leading icon in a tinted circle. */
  icon?: IconName;
  /** Icon colour token (default `primary`); background follows (`coral` → coralWash, `accentInk` → accent2). */
  iconColor?: keyof ColorTokens;
  /** Trailing node; defaults to a chevron when `onPress` is set. */
  right?: ReactNode;
  onPress?: () => void;
  /** Draw a hairline under the row (for grouped lists). */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Settings/list row: icon circle · title + subtitle · chevron (or custom right slot). */
export function ListRow({ title, subtitle, icon, iconColor = 'primary', right, onPress, divider, style }: ListRowProps) {
  const s = useStyles();
  const iconBg = iconColor === 'coral' ? s.bgCoral : iconColor === 'accentInk' || iconColor === 'accent' ? s.bgAccent : iconColor === 'success' ? s.bgMint : s.bgTint;
  const body = (
    <View style={[s.row, divider ? s.divider : null]}>
      {icon ? (
        <View style={[s.iconCircle, iconBg]}>
          <Icon name={icon} size={18} color={iconColor} />
        </View>
      ) : null}
      <View style={s.texts}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-forward" size={18} color="ink3" /> : null)}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [style, pressed ? s.pressed : null]}>
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: t.colors.line },
  iconCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  bgTint: { backgroundColor: t.colors.tint },
  bgCoral: { backgroundColor: t.colors.coralWash },
  bgAccent: { backgroundColor: t.colors.accent2 },
  bgMint: { backgroundColor: t.colors.mint },
  texts: { flex: 1, gap: 1 },
  pressed: { opacity: 0.6 },
}));
