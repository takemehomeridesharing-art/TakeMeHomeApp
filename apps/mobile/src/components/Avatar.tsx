import { Image } from 'expo-image';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { assetUrl } from '@/lib/api';
import { initials } from '@/lib/format';
import { useTheme } from '@/theme';
import { Text } from './Text';

export interface AvatarProps {
  name: string;
  /** Stored photo path or URL (resolved with `assetUrl`). Falls back to initials. */
  photoUrl?: string | null;
  size?: number;
  /** White ring, for avatars overlapping maps/cards. */
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Round user photo, or initials on an indigo wash. */
export function Avatar({ name, photoUrl, size = 40, ring = false, style }: AvatarProps) {
  const { colors, fonts } = useTheme();
  const uri = assetUrl(photoUrl);
  const box: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: ring ? 2 : 0,
    borderColor: colors.surface,
  };
  return (
    <View style={[box, style]} accessibilityLabel={name}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" transition={150} />
      ) : (
        <Text style={{ fontFamily: fonts.heading, fontSize: size * 0.38, lineHeight: size * 0.46, color: colors.primary }}>{initials(name)}</Text>
      )}
    </View>
  );
}
