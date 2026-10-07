// Type declaration for the platform-split implementation (TripMap.native.tsx / TripMap.web.tsx).
// Metro picks the right file per platform; TypeScript resolves `./TripMap` to this declaration.
import { type TripMapComponent } from './types';

/** Trip map. Native: react-native-maps + OpenStreetMap tiles. Web: an SVG schematic of Kigali. */
export declare const TripMap: TripMapComponent;
