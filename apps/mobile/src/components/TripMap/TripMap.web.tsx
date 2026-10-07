import { formatRwf, KIGALI_PLACES, ROAD_LINKS } from '@tmh/shared';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Pattern, Polyline, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { fonts, makeStyles, useTheme } from '@/theme';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { type MapPlace, type TripMapComponent, type TripMapProps } from './types';

const PAD_X = 36;
const PAD_TOP = 64; // room for pin tags
const PAD_BOTTOM = 28;
const PIN_W = 150;

interface Projected {
  x: number;
  y: number;
}

/**
 * Web schematic of Kigali (no map tiles, no react-native-maps): projects lat/lng into the box and
 * draws roads, places, the corridor and tappable car pins.
 */
export const TripMap: TripMapComponent = function TripMap({
  places,
  routeStops = [],
  pins = [],
  onPinPress,
  boardPlaceId,
  alightPlaceId,
  height = 240,
  style,
}: TripMapProps) {
  const s = useStyles();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const allPlaces: readonly MapPlace[] = places ?? KIGALI_PLACES;

  const project = useMemo(() => {
    const focus = routeStops.length ? [...routeStops, ...pins] : [...allPlaces, ...pins];
    const lats = focus.map((p) => p.lat);
    const lngs = focus.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const spanX = Math.max((maxLng - minLng) * k, 0.01);
    const spanY = Math.max(maxLat - minLat, 0.01);
    const innerW = Math.max(width - PAD_X * 2, 1);
    const innerH = Math.max(height - PAD_TOP - PAD_BOTTOM, 1);
    const scale = Math.min(innerW / spanX, innerH / spanY);
    const offX = PAD_X + (innerW - spanX * scale) / 2;
    const offY = PAD_TOP + (innerH - spanY * scale) / 2;
    return (p: { lat: number; lng: number }): Projected => ({
      x: offX + (p.lng - minLng) * k * scale,
      y: offY + (maxLat - p.lat) * scale,
    });
  }, [routeStops, pins, allPlaces, width, height]);

  const byId = useMemo(() => new Map(allPlaces.map((p) => [p.id, p])), [allPlaces]);
  const routeIds = new Set(routeStops.map((p) => p.id));
  const bi = routeStops.findIndex((p) => p.id === boardPlaceId);
  const ai = routeStops.findIndex((p) => p.id === alightPlaceId);
  const ridden = bi >= 0 && ai > bi ? routeStops.slice(bi, ai + 1) : [];
  const pts = (list: readonly MapPlace[]) =>
    list
      .map(project)
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
  const labelled = routeStops.length ? routeStops : allPlaces;

  return (
    <View style={[s.wrap, { height }, style]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <>
          <Svg width={width} height={height}>
            <Defs>
              <Pattern id="tmh-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                <Line x1="0" y1="0" x2="28" y2="0" stroke={colors.line} strokeWidth={0.6} />
                <Line x1="0" y1="0" x2="0" y2="28" stroke={colors.line} strokeWidth={0.6} />
              </Pattern>
              <RadialGradient id="tmh-blob-a" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={colors.mint} stopOpacity={1} />
                <Stop offset="1" stopColor={colors.mint} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="tmh-blob-b" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={colors.tint} stopOpacity={1} />
                <Stop offset="1" stopColor={colors.tint} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="tmh-blob-c" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={colors.accent2} stopOpacity={0.9} />
                <Stop offset="1" stopColor={colors.accent2} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width={width} height={height} fill="#F1F3FA" />
            <Rect x="0" y="0" width={width} height={height} fill="url(#tmh-grid)" opacity={0.7} />
            {/* soft "hills and parks" */}
            <Circle cx={width * 0.18} cy={height * 0.3} r={height * 0.45} fill="url(#tmh-blob-a)" />
            <Circle cx={width * 0.82} cy={height * 0.75} r={height * 0.55} fill="url(#tmh-blob-b)" />
            <Circle cx={width * 0.62} cy={height * 0.15} r={height * 0.3} fill="url(#tmh-blob-c)" />

            {/* roads */}
            <G>
              {ROAD_LINKS.map(([a, b]) => {
                const pa = byId.get(a);
                const pb = byId.get(b);
                if (!pa || !pb) return null;
                const A = project(pa);
                const B = project(pb);
                return <Line key={`${a}-${b}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" />;
              })}
              {ROAD_LINKS.map(([a, b]) => {
                const pa = byId.get(a);
                const pb = byId.get(b);
                if (!pa || !pb) return null;
                const A = project(pa);
                const B = project(pb);
                return <Line key={`c-${a}-${b}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#DCE1EE" strokeWidth={1.2} strokeLinecap="round" />;
              })}
            </G>

            {/* corridor */}
            {routeStops.length > 1 ? (
              <>
                <Polyline points={pts(routeStops)} fill="none" stroke="#FFFFFF" strokeWidth={10} strokeLinejoin="round" strokeLinecap="round" />
                <Polyline
                  points={pts(routeStops)}
                  fill="none"
                  stroke={colors.primary}
                  strokeOpacity={ridden.length ? 0.3 : 1}
                  strokeWidth={5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {ridden.length > 1 ? (
                  <Polyline points={pts(ridden)} fill="none" stroke={colors.primary} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
                ) : null}
              </>
            ) : null}

            {/* places */}
            {allPlaces
              .filter((p) => !routeIds.has(p.id))
              .map((p) => {
                const P = project(p);
                return <Circle key={p.id} cx={P.x} cy={P.y} r={3.5} fill="#FFFFFF" stroke={colors.ink3} strokeWidth={1.5} />;
              })}
            {routeStops.map((p) => {
              const P = project(p);
              if (p.id === boardPlaceId) return <Circle key={p.id} cx={P.x} cy={P.y} r={8} fill={colors.primary} stroke="#FFFFFF" strokeWidth={3} />;
              if (p.id === alightPlaceId) return <Circle key={p.id} cx={P.x} cy={P.y} r={8} fill={colors.accent} stroke="#FFFFFF" strokeWidth={3} />;
              return <Circle key={p.id} cx={P.x} cy={P.y} r={5} fill="#FFFFFF" stroke={colors.primary} strokeWidth={2.5} />;
            })}

            {/* labels (halo + fill) */}
            {labelled.map((p) => {
              const P = project(p);
              const strong = p.id === boardPlaceId || p.id === alightPlaceId || routeIds.has(p.id);
              const common = {
                x: P.x + 9,
                y: P.y + 4,
                fontSize: strong ? 11 : 10,
                fontFamily: strong ? fonts.bodyBold : fonts.bodySemiBold,
              };
              return (
                <G key={`l-${p.id}`}>
                  <SvgText {...common} stroke="#FFFFFF" strokeWidth={3} strokeLinejoin="round" fill="#FFFFFF">
                    {p.name}
                  </SvgText>
                  <SvgText {...common} fill={strong ? colors.ink : colors.ink2}>
                    {p.name}
                  </SvgText>
                </G>
              );
            })}
          </Svg>

          {pins.map((pin) => {
            const P = project(pin);
            return (
              <Pressable
                key={pin.id}
                accessibilityRole="button"
                accessibilityLabel={`Trip to ${pin.title}${pin.fromAmount !== undefined ? `, from ${formatRwf(pin.fromAmount)}` : ''}`}
                onPress={() => onPinPress?.(pin.id)}
                style={({ pressed }) => [s.pin, { left: P.x - PIN_W / 2, top: P.y - 46 }, pressed ? s.pressed : null]}
              >
                <View style={s.tag}>
                  <View style={s.car}>
                    <Icon name="car-sport" size={13} color="onPrimary" />
                  </View>
                  <View style={s.tagTexts}>
                    <Text style={s.tagTitle} numberOfLines={1}>
                      {pin.title}
                    </Text>
                    {pin.fromAmount !== undefined ? (
                      <Text style={s.tagAmount} numberOfLines={1}>
                        from {formatRwf(pin.fromAmount)}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={s.pointer} />
                <View style={s.anchorDot} />
              </Pressable>
            );
          })}
        </>
      ) : null}
    </View>
  );
};

const useStyles = makeStyles((t) => ({
  wrap: { overflow: 'hidden', backgroundColor: '#F1F3FA' },
  pin: { position: 'absolute', width: PIN_W, alignItems: 'center' },
  pressed: { transform: [{ scale: 0.96 }] },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: t.colors.surface,
    maxWidth: PIN_W,
    ...t.shadows.md,
  },
  car: { width: 26, height: 26, borderRadius: 13, backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center' },
  tagTexts: { flexShrink: 1 },
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
  },
  anchorDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.primary, borderWidth: 2, borderColor: t.colors.surface, marginTop: 1 },
}));
