import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components';
import { makeStyles } from '@/theme';

/** Section heading with an optional right slot (count, link). */
export function SectionTitle({ title, right, style }: { title: string; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useStyles();
  return (
    <View style={[s.row, style]}>
      <Text variant="h3">{title}</Text>
      {right}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
}));
