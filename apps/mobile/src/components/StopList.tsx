import { formatKm } from '@tmh/shared';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles, useTheme } from '@/theme';
import { Text } from './Text';

/** The minimum a stop needs (a `TripStop` from @tmh/shared fits). */
export interface StopListStop {
  id: string;
  cumulativeKm: number;
  place: { name: string; landmark?: string };
}

export interface StopListProps {
  stops: readonly StopListStop[];
  boardStopId?: string;
  alightStopId?: string;
  /**
   * Make stops tappable to change the passenger's segment. A tap before the board stop moves the
   * board stop, after the alight stop moves the alight stop; in between, whichever end is nearer.
   */
  onSelectBoard?: (stopId: string) => void;
  onSelectAlight?: (stopId: string) => void;
  /** Hide landmarks for a denser list. */
  compact?: boolean;
  /** Show distance from the passenger's board stop instead of from the trip origin. */
  kmFromBoard?: boolean;
  style?: StyleProp<ViewStyle>;
}

type Role = 'board' | 'alight' | 'riding' | 'outside';

/** Vertical corridor: dots joined by a line; board = indigo, alight = amber, stops ridden highlighted, others grey. */
export function StopList({ stops, boardStopId, alightStopId, onSelectBoard, onSelectAlight, compact, kmFromBoard, style }: StopListProps) {
  const s = useStyles();
  const { colors } = useTheme();
  const hasSegment = Boolean(boardStopId && alightStopId);
  const bi = boardStopId ? stops.findIndex((x) => x.id === boardStopId) : -1;
  const ai = alightStopId ? stops.findIndex((x) => x.id === alightStopId) : -1;
  const baseKm = kmFromBoard && bi >= 0 ? stops[bi]!.cumulativeKm : 0;
  const selectable = Boolean(onSelectBoard || onSelectAlight);

  const roleOf = (i: number): Role => {
    if (!hasSegment) return 'riding';
    if (i === bi) return 'board';
    if (i === ai) return 'alight';
    if (i > bi && i < ai) return 'riding';
    return 'outside';
  };
  // A line segment between i and i+1 is "ridden" if both ends are within [bi, ai].
  const ridden = (i: number) => !hasSegment || (i >= bi && i + 1 <= ai);

  const onTap = (i: number) => {
    const id = stops[i]!.id;
    if (i === bi || i === ai) return;
    if (bi < 0 || i < bi) {
      if (i < stops.length - 1) onSelectBoard?.(id);
    } else if (ai < 0 || i > ai) {
      if (i > 0) onSelectAlight?.(id);
    } else if (i - bi <= ai - i) onSelectBoard?.(id);
    else onSelectAlight?.(id);
  };

  return (
    <View style={style}>
      {stops.map((stop, i) => {
        const role = roleOf(i);
        const first = i === 0;
        const last = i === stops.length - 1;
        const dimmed = role === 'outside';
        const km = stop.cumulativeKm - baseKm;
        const row = (
          <View style={[s.row, compact ? s.rowCompact : null]}>
            <View style={s.rail}>
              <View style={[s.line, s.lineTop, first ? s.hidden : null, { backgroundColor: ridden(i - 1) ? colors.primary : colors.line }]} />
              <View style={[s.line, s.lineBottom, last ? s.hidden : null, { backgroundColor: ridden(i) ? colors.primary : colors.line }]} />
              <View
                style={[
                  s.dot,
                  role === 'board' ? s.dotBoard : role === 'alight' ? s.dotAlight : role === 'riding' ? s.dotRiding : s.dotOutside,
                ]}
              />
            </View>
            <View style={s.texts}>
              <View style={s.nameRow}>
                <Text variant={role === 'board' || role === 'alight' ? 'bodyStrong' : 'body'} color={dimmed ? 'ink3' : 'ink'} numberOfLines={1} style={s.name}>
                  {stop.place.name}
                </Text>
                {role === 'board' ? <Tag label="Board" kind="board" /> : role === 'alight' ? <Tag label="Drop-off" kind="alight" /> : null}
              </View>
              {!compact && stop.place.landmark ? (
                <Text variant="caption" color={dimmed ? 'ink3' : 'ink2'} numberOfLines={1}>
                  {stop.place.landmark}
                </Text>
              ) : null}
            </View>
            <Text variant="caption" color={dimmed ? 'ink3' : 'ink2'} style={s.km}>
              {km < 0 ? '' : formatKm(km)}
            </Text>
          </View>
        );
        return selectable ? (
          <Pressable
            key={stop.id}
            onPress={() => onTap(i)}
            accessibilityRole="button"
            accessibilityLabel={`${stop.place.name}${role === 'board' ? ', board here' : role === 'alight' ? ', drop-off here' : ''}`}
            style={({ pressed }) => (pressed ? s.pressed : null)}
          >
            {row}
          </Pressable>
        ) : (
          <View key={stop.id}>{row}</View>
        );
      })}
    </View>
  );
}

function Tag({ label, kind }: { label: string; kind: 'board' | 'alight' }) {
  const s = useStyles();
  return (
    <View style={[s.tag, kind === 'board' ? s.tagBoard : s.tagAlight]}>
      <Text variant="caption" style={[s.tagText, kind === 'board' ? s.tagTextBoard : s.tagTextAlight]}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'stretch', minHeight: 56, gap: 12 },
  rowCompact: { minHeight: 40 },
  rail: { width: 20, alignItems: 'center', justifyContent: 'center' },
  line: { position: 'absolute', width: 3, borderRadius: 2, left: 8.5 },
  lineTop: { top: 0, bottom: '50%' },
  lineBottom: { top: '50%', bottom: 0 },
  hidden: { opacity: 0 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotBoard: { width: 18, height: 18, borderRadius: 9, backgroundColor: t.colors.primary, borderWidth: 4, borderColor: t.colors.tint },
  dotAlight: { width: 18, height: 18, borderRadius: 9, backgroundColor: t.colors.accent, borderWidth: 4, borderColor: t.colors.accent2 },
  dotRiding: { backgroundColor: t.colors.surface, borderWidth: 3, borderColor: t.colors.primary },
  dotOutside: { backgroundColor: t.colors.surface, borderWidth: 2.5, borderColor: t.colors.line },
  texts: { flex: 1, justifyContent: 'center', paddingVertical: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1 },
  km: { alignSelf: 'center', fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.6 },
  tag: { paddingHorizontal: 7, height: 20, borderRadius: 10, justifyContent: 'center' },
  tagBoard: { backgroundColor: t.colors.tint },
  tagAlight: { backgroundColor: t.colors.accent2 },
  tagText: { fontSize: 11, lineHeight: 14, fontFamily: t.fonts.bodyBold },
  tagTextBoard: { color: t.colors.primary },
  tagTextAlight: { color: t.colors.accentInk },
}));
