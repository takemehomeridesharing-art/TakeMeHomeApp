import { useId } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export interface CarIllustrationProps {
  /** Vehicle colour name as entered by drivers ("Silver", "White", "Dark blue", …) or a hex value. */
  color?: string;
  /** Width in px; height follows the 12:5 aspect ratio. */
  width?: number;
  /** Soft ground shadow (default true). */
  shadow?: boolean;
  style?: StyleProp<ViewStyle>;
}

const NAMED: Record<string, string> = {
  silver: '#C3C8D2',
  white: '#F5F6F9',
  black: '#2A2D37',
  grey: '#878DA0',
  gray: '#878DA0',
  blue: '#3E6AE0',
  navy: '#25336B',
  red: '#E2483B',
  maroon: '#8C2635',
  green: '#2F9E6B',
  yellow: '#F4C430',
  orange: '#F08A2C',
  brown: '#7B5640',
  beige: '#D9C7A6',
  gold: '#CFAE5A',
  purple: '#6E4BC9',
};

/** Resolves a colour name (case-insensitive, first known word wins, e.g. "Dark blue" → blue) or hex. */
export function carColorHex(name: string | undefined): string {
  if (!name) return NAMED.silver!;
  const trimmed = name.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;
  if (NAMED[trimmed]) return NAMED[trimmed]!;
  const word = trimmed.split(/[\s-]+/).reverse().find((w) => NAMED[w]);
  return word ? NAMED[word]! : NAMED.silver!;
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** Side-view car illustration tinted by the vehicle's colour — trip-detail hero and list thumbnails. */
export function CarIllustration({ color, width = 240, shadow = true, style }: CarIllustrationProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const base = carColorHex(color);
  const light = luminance(base) > 0.85;
  const top = shade(base, 0.22);
  const bottom = shade(base, light ? -0.1 : -0.22);
  const outline = light ? '#C9CEDA' : shade(base, -0.35);
  const crease = shade(base, light ? -0.12 : -0.3);
  const shine = shade(base, 0.45);
  const height = (width * 100) / 240;

  return (
    <Svg width={width} height={height} viewBox="0 0 240 100" style={style} accessibilityLabel={`${color ?? 'Silver'} car`}>
      <Defs>
        <LinearGradient id={`body${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="0.55" stopColor={base} />
          <Stop offset="1" stopColor={bottom} />
        </LinearGradient>
        <LinearGradient id={`glass${id}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#3B4766" />
          <Stop offset="1" stopColor="#1F2638" />
        </LinearGradient>
        <LinearGradient id={`rim${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#EEF0F4" />
          <Stop offset="1" stopColor="#A9AFBD" />
        </LinearGradient>
      </Defs>

      {shadow ? <Ellipse cx="121" cy="90" rx="104" ry="6" fill="rgba(25,28,43,0.14)" /> : null}

      {/* body */}
      <Path
        d="M16 67 C13 58 16 51 27 48.5 L58 44 C70 31 86 23 106 22 L144 22 C160 23 172 30 186 40.5 L213 45 C224 47 229 53 229.5 61 L229.5 67 C229.5 72 226.5 74 222 74 L201 74 A19 19 0 0 0 163 74 L77 74 A19 19 0 0 0 39 74 L22 74 C18.5 74 16.5 71 16 67 Z"
        fill={`url(#body${id})`}
        stroke={outline}
        strokeWidth={light ? 1 : 0.6}
      />
      {/* lower sill shading */}
      <Path d="M39 74 L22 74 C18.5 74 16.5 71 16 67 L16 64 L229.5 64 L229.5 67 C229.5 72 226.5 74 222 74 L201 74 A19 19 0 0 0 163 74 L77 74 A19 19 0 0 0 39 74 Z" fill={crease} opacity={0.35} />
      {/* shoulder highlight */}
      <Path d="M28 51 L212 49.5" stroke={shine} strokeWidth={1.6} strokeLinecap="round" opacity={0.8} />

      {/* windows */}
      <Path d="M68 44.5 C78 33.5 91 27 106 26 L119 26 L119 44.5 Z" fill={`url(#glass${id})`} />
      <Path d="M125 26 L143 26 C156 27 166 33 176 43.5 L125 44.5 Z" fill={`url(#glass${id})`} />
      <Path d="M76 41 C84 33 93 29.5 103 28.5 L96 41 Z" fill="#FFFFFF" opacity={0.14} />
      <Path d="M130 28.5 L141 28.5 L131 41 L128 41 Z" fill="#FFFFFF" opacity={0.12} />
      {/* pillars + door seams */}
      <Rect x="119" y="25" width="6" height="20" fill={crease} opacity={0.9} />
      <Path d="M122 45 L122 72" stroke={crease} strokeWidth={1.2} opacity={0.8} />
      <Path d="M70 47 C69 56 70 64 74 71" stroke={crease} strokeWidth={1.2} fill="none" opacity={0.6} />
      <Path d="M176 46 C178 54 177 63 171 71" stroke={crease} strokeWidth={1.2} fill="none" opacity={0.6} />
      {/* handles */}
      <Rect x="101" y="52" width="11" height="3" rx="1.5" fill={crease} />
      <Rect x="148" y="52" width="11" height="3" rx="1.5" fill={crease} />
      {/* mirror */}
      <Path d="M172 42 C175 38 181 38 182 42 L180 45 L173 45 Z" fill={bottom} />
      {/* lights */}
      <Path d="M214 50 C220 50.5 225 52.5 227.5 56 L218 56 C215.5 56 214 54 214 50 Z" fill="#FFE8A3" stroke="#F2C45A" strokeWidth={0.6} />
      <Path d="M17.5 55 C18 52 20.5 50.5 25 50 L25 56 L18 56 Z" fill="#E5484D" />
      {/* bumpers */}
      <Path d="M216 66 L229 66" stroke={outline} strokeWidth={1.4} strokeLinecap="round" opacity={0.6} />
      <Path d="M17 66 L28 66" stroke={outline} strokeWidth={1.4} strokeLinecap="round" opacity={0.6} />

      {/* wheels */}
      {[58, 182].map((cx) => (
        <G key={cx}>
          <Circle cx={cx} cy="74" r="16" fill="#1E2029" />
          <Circle cx={cx} cy="74" r="10" fill={`url(#rim${id})`} />
          {[0, 72, 144, 216, 288].map((deg) => {
            const a = (deg * Math.PI) / 180;
            return (
              <Path
                key={deg}
                d={`M${cx} 74 L${(cx + Math.cos(a) * 8.5).toFixed(2)} ${(74 + Math.sin(a) * 8.5).toFixed(2)}`}
                stroke="#8D94A5"
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            );
          })}
          <Circle cx={cx} cy="74" r="3" fill="#5B6178" />
        </G>
      ))}
    </Svg>
  );
}
