import { View, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles } from '@/theme';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  body?: string;
  /** Optional call to action under the text. */
  action?: { label: string; onPress: () => void; icon?: IconName };
  style?: StyleProp<ViewStyle>;
}

/** Centered empty/zero state: tinted icon circle, title, body, optional action. */
export function EmptyState({ icon, title, body, action, style }: EmptyStateProps) {
  const s = useStyles();
  return (
    <View style={[s.wrap, style]}>
      <View style={s.halo}>
        <View style={s.circle}>
          <Icon name={icon} size={30} color="primary" />
        </View>
      </View>
      <Text variant="h2" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="body" color="ink2" align="center" style={s.body}>
          {body}
        </Text>
      ) : null}
      {action ? <Button label={action.label} icon={action.icon} onPress={action.onPress} style={s.action} /> : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 8 },
  halo: { width: 104, height: 104, borderRadius: 52, backgroundColor: t.colors.tint, opacity: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  circle: { width: 72, height: 72, borderRadius: 36, backgroundColor: t.colors.surface, alignItems: 'center', justifyContent: 'center', ...t.shadows.sm },
  body: { maxWidth: 320 },
  action: { marginTop: 12, alignSelf: 'center' },
}));
