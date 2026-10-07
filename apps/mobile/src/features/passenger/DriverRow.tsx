import { type PublicUser } from '@tmh/shared';
import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Avatar, Icon, Stars, Text } from '@/components';
import { makeStyles } from '@/theme';
import { isVerifiedDriver } from './labels';

export interface DriverRowProps {
  user: PublicUser;
  /** Caption under the name (default: rating). */
  caption?: string;
  size?: number;
  /** Name + rating only (e.g. next to a car thumbnail). */
  hideAvatar?: boolean;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Avatar · name + verified tick · stars. Used for drivers and passengers alike. */
export function DriverRow({ user, caption, size = 44, hideAvatar, right, style }: DriverRowProps) {
  const s = useStyles();
  return (
    <View style={[s.row, style]}>
      {hideAvatar ? null : <Avatar name={user.name} photoUrl={user.photoUrl} size={size} />}
      <View style={s.texts}>
        <View style={s.nameRow}>
          <Text variant="bodyStrong" numberOfLines={1} style={s.name}>
            {user.name}
          </Text>
          {isVerifiedDriver(user.verification) ? <Icon name="checkmark-circle" size={16} color="primary" /> : null}
        </View>
        {caption ? <Text variant="caption">{caption}</Text> : <Stars value={user.ratingAvg} count={user.ratingCount} showValue size={13} />}
      </View>
      {right}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  texts: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { flexShrink: 1 },
}));
