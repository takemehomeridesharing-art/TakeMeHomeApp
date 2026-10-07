import { type ReactElement } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';

/** A named point on the map (a `Place` from @tmh/shared fits). `id` is the place id. */
export interface MapPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  landmark?: string;
}

/** A car pin with a tag: destination name + "from RWF x". */
export interface MapPin {
  /** Usually the trip id; passed back to `onPinPress`. */
  id: string;
  lat: number;
  lng: number;
  /** Destination name shown on the tag, e.g. "Remera". */
  title: string;
  /** Lowest contribution, shown as "from RWF 610" in amber. */
  fromAmount?: number;
}

export interface TripMapProps {
  /** Background places to show as small dots (default: none on native, all Kigali places on web). */
  places?: readonly MapPlace[];
  /** The corridor, in driving order — drawn as an indigo polyline. */
  routeStops?: readonly MapPlace[];
  /** Car pins (trips) with tags. */
  pins?: readonly MapPin[];
  onPinPress?: (pinId: string) => void;
  /** Highlights the passenger's board stop (indigo) — a place id. */
  boardPlaceId?: string;
  /** Highlights the passenger's drop-off stop (amber) — a place id. */
  alightPlaceId?: string;
  /** Height in px (default 240). Width fills the parent. */
  height?: number;
  /** Extra space (px) kept clear at the top when fitting, e.g. under a floating header. Default 0. */
  insetTop?: number;
  /** Extra space (px) kept clear at the bottom when fitting, e.g. under an overlapping card. Default 0. */
  insetBottom?: number;
  /** Allow pan/zoom (native). Default true. */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}

export type TripMapComponent = (props: TripMapProps) => ReactElement;

/** Kigali centre and a span that covers the seeded places. */
export const KIGALI_REGION = { latitude: -1.95, longitude: 30.09, latitudeDelta: 0.1, longitudeDelta: 0.12 };
