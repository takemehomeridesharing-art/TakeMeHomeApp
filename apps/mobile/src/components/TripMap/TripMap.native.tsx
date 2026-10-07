import { formatRwf } from '@tmh/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { makeStyles, useTheme } from '@/theme';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { KIGALI_REGION, type MapPin, type MapPlace, type TripMapComponent, type TripMapProps } from './types';

const coord = (p: { lat: number; lng: number }) => ({ latitude: p.lat, longitude: p.lng });

/** react-native-maps implementation with OpenStreetMap tiles. The only file that imports react-native-maps. */
export const TripMap: TripMapComponent = function TripMap({
  places = [],
  routeStops = [],
  pins = [],
  onPinPress,
  boardPlaceId,
  alightPlaceId,
  height = 240,
  interactive = true,
  style,
}: TripMapProps) {
  const s = useStyles();
  const { colors } = useTheme();
  const mapRef = useRef<MapView>(null);
  // Custom marker views need a frame to render before snapshotting (Android).
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setTracks(false), 800);
    return () => clearTimeout(id);
  }, [pins, boardPlaceId, alightPlaceId]);

  const bi = routeStops.findIndex((p) => p.id === boardPlaceId);
  const ai = routeStops.findIndex((p) => p.id === alightPlaceId);
  const ridden = bi >= 0 && ai > bi ? routeStops.slice(bi, ai + 1) : [];
  const fitPoints = useMemo(
    () => (routeStops.length ? [...routeStops, ...pins] : pins.length ? pins : places).map(coord),
    [routeStops, pins, places],
  );

  const fit = () => {
    if (fitPoints.length > 1) {
      mapRef.current?.fitToCoordinates(fitPoints, { edgePadding: { top: 70, right: 50, bottom: 40, left: 50 }, animated: false });
    }
  };

  const routeIds = new Set(routeStops.map((p) => p.id));
  const backgroundPlaces = places.filter((p) => !routeIds.has(p.id));

  return (
    <View style={[s.wrap, { height }, style]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={KIGALI_REGION}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        onMapReady={fit}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
        showsCompass={false}
      >
        <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} shouldReplaceMapContent />
        {routeStops.length > 1 ? (
          <Polyline coordinates={routeStops.map(coord)} strokeColor={ridden.length ? 'rgba(67,83,255,0.35)' : colors.primary} strokeWidth={5} lineJoin="round" lineCap="round" />
        ) : null}
        {ridden.length > 1 ? <Polyline coordinates={ridden.map(coord)} strokeColor={colors.primary} strokeWidth={6} lineJoin="round" lineCap="round" /> : null}

        {backgroundPlaces.map((p) => (
          <Marker key={`bg-${p.id}`} coordinate={coord(p)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracks} title={p.name} description={p.landmark}>
            <View style={s.placeDot} />
          </Marker>
        ))}
        {routeStops.map((p) => (
          <StopMarker key={`stop-${p.id}`} place={p} role={p.id === boardPlaceId ? 'board' : p.id === alightPlaceId ? 'alight' : 'stop'} tracks={tracks} />
        ))}
        {pins.map((pin) => (
          <Marker key={`pin-${pin.id}`} coordinate={coord(pin)} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={tracks} onPress={() => onPinPress?.(pin.id)}>
            <PinTag pin={pin} />
          </Marker>
        ))}
      </MapView>
      <View style={[s.attribution, s.noPointer]}>
        <Text style={s.attributionText}>© OpenStreetMap</Text>
      </View>
    </View>
  );
};

function StopMarker({ place, role, tracks }: { place: MapPlace; role: 'board' | 'alight' | 'stop'; tracks: boolean }) {
  const s = useStyles();
  return (
    <Marker coordinate={coord(place)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracks} title={place.name} description={place.landmark}>
      <View style={role === 'board' ? s.boardDot : role === 'alight' ? s.alightDot : s.stopDot} />
    </Marker>
  );
}

function PinTag({ pin }: { pin: MapPin }) {
  const s = useStyles();
  return (
    <View style={s.pin}>
      <View style={s.tag}>
        <View style={s.car}>
          <Icon name="car-sport" size={13} color="onPrimary" />
        </View>
        <View>
          <Text style={s.tagTitle} numberOfLines={1}>
            {pin.title}
          </Text>
          {pin.fromAmount !== undefined ? <Text style={s.tagAmount}>from {formatRwf(pin.fromAmount)}</Text> : null}
        </View>
      </View>
      <View style={s.pointer} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { overflow: 'hidden', backgroundColor: '#E9EDF5' },
  placeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.colors.surface, borderWidth: 2, borderColor: t.colors.ink3 },
  stopDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: t.colors.surface, borderWidth: 3, borderColor: t.colors.primary },
  boardDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: t.colors.primary, borderWidth: 3, borderColor: t.colors.surface },
  alightDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: t.colors.accent, borderWidth: 3, borderColor: t.colors.surface },
  pin: { alignItems: 'center' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.line,
  },
  car: { width: 24, height: 24, borderRadius: 12, backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center' },
  tagTitle: { fontFamily: t.fonts.bodyBold, fontSize: 12, lineHeight: 15, color: t.colors.ink },
  tagAmount: { fontFamily: t.fonts.heading, fontSize: 11, lineHeight: 14, color: t.colors.accentInk },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: t.colors.surface,
    marginTop: -1,
  },
  attribution: { position: 'absolute', right: 6, bottom: 4, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 4, paddingHorizontal: 4 },
  noPointer: { pointerEvents: 'none' },
  attributionText: { fontSize: 9, color: t.colors.ink2 },
}));
