import { type Vehicle } from '@tmh/shared';
import { Image } from 'expo-image';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { CarIllustration } from '@/components';
import { assetUrl } from '@/lib/api';
import { makeStyles } from '@/theme';

export interface CarVisualProps {
  vehicle: Pick<Vehicle, 'color' | 'photos' | 'make' | 'model'>;
  /** Box width; height follows 12:5 for the illustration, 3:2 box for photos when `photoHeight` unset. */
  width: number;
  height?: number;
  /** Prefer the driver's first photo over the illustration (default true). */
  preferPhoto?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The driver's first vehicle photo (if any), else a side-view car tinted with the vehicle colour. */
export function CarVisual({ vehicle, width, height, preferPhoto = true, style }: CarVisualProps) {
  const s = useStyles();
  const uri = preferPhoto ? assetUrl(vehicle.photos[0]) : undefined;
  const h = height ?? Math.round((width * 5) / 12);
  if (uri) {
    return (
      <View style={[s.photoBox, { width, height: h }, style]}>
        <Image source={{ uri }} style={{ width, height: h }} contentFit="cover" transition={200} accessibilityLabel={`${vehicle.make} ${vehicle.model}`} />
      </View>
    );
  }
  return (
    <View style={[{ width, height: h, alignItems: 'center', justifyContent: 'center' }, style]}>
      <CarIllustration color={vehicle.color} width={Math.min(width, (h * 12) / 5)} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  photoBox: { borderRadius: t.radius.sm, overflow: 'hidden', backgroundColor: t.colors.tint },
}));
