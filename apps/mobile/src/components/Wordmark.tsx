import { View, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles } from '@/theme';
import { Text } from './Text';

export interface WordmarkProps {
  /** Font size of the wordmark text (default 22). */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** "Take Me Home" wordmark with the pin mark (indigo pin, amber dot). */
export function Wordmark({ size = 22, style }: WordmarkProps) {
  const s = useStyles();
  const mark = size * 1.45;
  return (
    <View style={[s.row, style]} accessibilityRole="header" accessibilityLabel="Take Me Home">
      <View style={[s.mark, { width: mark, height: mark, borderRadius: mark * 0.32 }]}>
        <View style={[s.pinHead, { width: mark * 0.5, height: mark * 0.5, borderRadius: mark * 0.25 }]}>
          <View style={[s.dot, { width: mark * 0.2, height: mark * 0.2, borderRadius: mark * 0.1 }]} />
        </View>
      </View>
      <Text style={[s.text, { fontSize: size, lineHeight: size * 1.2 }]}>
        Take Me <Text style={[s.text, s.home, { fontSize: size, lineHeight: size * 1.2 }]}>Home</Text>
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center', ...t.shadows.primary },
  pinHead: { backgroundColor: t.colors.surface, alignItems: 'center', justifyContent: 'center' },
  dot: { backgroundColor: t.colors.accent },
  text: { fontFamily: t.fonts.headingHeavy, color: t.colors.ink, letterSpacing: -0.4 },
  home: { color: t.colors.primary },
}));
