import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

/** Max content width on wide screens (web/tablet) so cards don't stretch edge to edge. */
export const COLUMN_MAX_WIDTH = 640;

/** Centres screen content in a readable column on wide screens; no-op on phones. */
export function Column({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: '100%', maxWidth: COLUMN_MAX_WIDTH, alignSelf: 'center' }, style]}>{children}</View>;
}
