import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button, Icon, Text, type IconName } from '@/components';
import { ApiError, errorMessage } from '@/lib/api';
import { makeStyles } from '@/theme';

const TITLES: Record<string, { title: string; icon: IconName }> = {
  ACCOUNT_SUSPENDED: { title: 'Your account is suspended', icon: 'lock-closed' },
  WOMEN_ONLY: { title: 'This is a women-only trip', icon: 'female' },
  NO_SEATS: { title: 'No seats left on your part of the route', icon: 'people' },
  ALREADY_REQUESTED: { title: 'You already asked to join this trip', icon: 'hourglass' },
  BLOCKED: { title: "You can't ride with this person", icon: 'ban' },
  NETWORK_ERROR: { title: "Can't reach Take Me Home", icon: 'cloud-offline' },
  INVALID_TRANSITION: { title: 'This trip has moved on', icon: 'alert-circle' },
};

/** The error code of a thrown value (`ACCOUNT_SUSPENDED`, …) or null. */
export function errorCode(e: unknown): string | null {
  return e instanceof ApiError ? e.code : null;
}

/** A friendly title for an API error code. */
export function errorTitle(e: unknown, fallback = "That didn't work"): string {
  const code = errorCode(e);
  return (code && TITLES[code]?.title) || fallback;
}

export interface ErrorCardProps {
  error: unknown;
  fallbackTitle?: string;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Prominent coral card explaining an API error (title by code + the server's message). */
export function ErrorCard({ error, fallbackTitle, action, style, testID }: ErrorCardProps) {
  const s = useStyles();
  const code = errorCode(error);
  const meta = (code && TITLES[code]) || { title: fallbackTitle ?? "That didn't work", icon: 'alert-circle' as IconName };
  return (
    <Animated.View entering={FadeInDown.duration(220)} style={[s.card, style]} testID={testID} accessibilityRole="alert">
      <View style={s.icon}>
        <Icon name={meta.icon} size={20} color="coral" />
      </View>
      <View style={s.texts}>
        <Text variant="bodyStrong">{meta.title}</Text>
        <Text variant="caption" color="ink2">
          {errorMessage(error)}
        </Text>
        {action ? <Button label={action.label} variant="ghost" size="sm" onPress={action.onPress} style={s.action} /> : null}
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.coralWash,
    borderWidth: 1,
    borderColor: t.colors.coral,
  },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.colors.surface, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2 },
  action: { marginTop: 4, marginLeft: -14 },
}));
