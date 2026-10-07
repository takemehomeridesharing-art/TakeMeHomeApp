import { View, type StyleProp, type ViewStyle } from 'react-native';
import { errorMessage } from '@/lib/api';
import { makeStyles } from '@/theme';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

export interface ErrorStateProps {
  /** The thrown error (its message is shown) or a message string. */
  error?: unknown;
  title?: string;
  onRetry?: () => void;
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Friendly error block with the error's message and an optional Retry. */
export function ErrorState({ error, title = "Couldn't load this", onRetry, fill = true, style }: ErrorStateProps) {
  const s = useStyles();
  const message = typeof error === 'string' ? error : error ? errorMessage(error) : 'Something went wrong. Please try again.';
  return (
    <View style={[s.wrap, fill ? s.fill : null, style]}>
      <View style={s.circle}>
        <Icon name="cloud-offline-outline" size={28} color="coral" />
      </View>
      <Text variant="h3" align="center">
        {title}
      </Text>
      <Text variant="caption" align="center" style={s.msg}>
        {message}
      </Text>
      {onRetry ? <Button label="Try again" variant="secondary" size="sm" icon="refresh" onPress={onRetry} style={s.btn} /> : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
  fill: { flex: 1 },
  circle: { width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.coralWash, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  msg: { maxWidth: 300 },
  btn: { marginTop: 10, alignSelf: 'center' },
}));
