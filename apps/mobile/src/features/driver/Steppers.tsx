import { Pressable, ScrollView, View } from 'react-native';
import { Icon, Text } from '@/components';
import { makeStyles } from '@/theme';
import { hapticTap } from './haptics';

const SLOT = 15;
const DAY_MIN = 24 * 60;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function fromMinutes(min: number): string {
  const wrapped = ((min % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/** Rounds `HH:mm` up to the next 15-minute slot. */
export function roundToSlot(hhmm: string): string {
  return fromMinutes(Math.ceil(toMinutes(hhmm) / SLOT) * SLOT);
}

const PRESETS = ['06:00', '06:30', '07:00', '07:30', '08:00', '12:30', '16:30', '17:00', '17:30', '18:00', '18:30'];

export interface TimeStepperProps {
  value: string;
  onChange: (hhmm: string) => void;
  /** Slots before this `HH:mm` are disabled (e.g. earlier today). */
  minTime?: string | null;
  error?: string | null;
}

/** Cross-platform departure-time picker: −/+ 15 minutes around a big readout, plus commute presets. */
export function TimeStepper({ value, onChange, minTime, error }: TimeStepperProps) {
  const s = useStyles();
  const min = minTime ? toMinutes(minTime) : 0;
  const cur = toMinutes(value);
  const step = (delta: number) => {
    const next = cur + delta;
    if (next < 0 || next >= DAY_MIN || next < min) return;
    hapticTap();
    onChange(fromMinutes(next));
  };
  return (
    <View style={s.wrap}>
      <View style={[s.readoutRow, error ? s.readoutError : null]}>
        <RoundBtn icon="remove" onPress={() => step(-SLOT)} disabled={cur - SLOT < Math.max(0, min)} label="15 minutes earlier" testID="time-minus" />
        <View style={s.readout}>
          <Text style={s.time} testID="time-value">
            {value}
          </Text>
          <Text variant="caption">{cur < 12 * 60 ? 'Morning' : cur < 17 * 60 ? 'Afternoon' : 'Evening'} departure</Text>
        </View>
        <RoundBtn icon="add" onPress={() => step(SLOT)} disabled={cur + SLOT >= DAY_MIN} label="15 minutes later" testID="time-plus" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.presets}>
        {PRESETS.map((p) => {
          const disabled = toMinutes(p) < min;
          const selected = p === value;
          return (
            <Pressable
              key={p}
              disabled={disabled}
              onPress={() => {
                hapticTap();
                onChange(p);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              style={({ pressed }) => [s.preset, selected ? s.presetSelected : null, disabled ? s.presetDisabled : null, pressed ? s.pressed : null]}
            >
              <Text style={[s.presetText, selected ? s.presetTextSelected : null]}>{p}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {error ? (
        <Text variant="caption" color="coral">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export interface NumberStepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  /** Label under the number, e.g. "seats". */
  unit?: (n: number) => string;
  testID?: string;
}

/** A − value + stepper for small integers (seats). */
export function NumberStepper({ value, min, max, onChange, unit, testID }: NumberStepperProps) {
  const s = useStyles();
  return (
    <View style={s.numRow} testID={testID}>
      <RoundBtn
        icon="remove"
        onPress={() => value > min && (hapticTap(), onChange(value - 1))}
        disabled={value <= min}
        label="Fewer"
        testID={testID ? `${testID}-minus` : undefined}
      />
      <View style={s.numReadout}>
        <Text style={s.num}>{value}</Text>
        {unit ? <Text variant="caption">{unit(value)}</Text> : null}
      </View>
      <RoundBtn
        icon="add"
        onPress={() => value < max && (hapticTap(), onChange(value + 1))}
        disabled={value >= max}
        label="More"
        testID={testID ? `${testID}-plus` : undefined}
      />
    </View>
  );
}

function RoundBtn({
  icon,
  onPress,
  disabled,
  label,
  testID,
}: {
  icon: 'add' | 'remove';
  onPress: () => void;
  disabled?: boolean;
  label: string;
  testID?: string;
}) {
  const s = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      testID={testID}
      style={({ pressed }) => [s.round, disabled ? s.roundDisabled : null, pressed ? s.pressed : null]}
    >
      <Icon name={icon} size={22} color={disabled ? 'ink3' : 'primary'} />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { gap: 12 },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: t.colors.bg,
    borderRadius: t.radius.md,
    padding: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  readoutError: { borderColor: t.colors.coral },
  readout: { alignItems: 'center' },
  time: {
    fontFamily: t.fonts.headingHeavy,
    fontSize: 36,
    lineHeight: 42,
    color: t.colors.ink,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...t.shadows.sm,
  },
  roundDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  presets: { gap: 8, paddingRight: 8 },
  preset: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: t.radius.pill,
    borderWidth: 1,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
    justifyContent: 'center',
  },
  presetSelected: {
    backgroundColor: t.colors.tint,
    borderColor: t.colors.primary,
  },
  presetDisabled: { opacity: 0.35 },
  presetText: {
    fontFamily: t.fonts.bodySemiBold,
    fontSize: 13,
    color: t.colors.ink2,
    fontVariant: ['tabular-nums'],
  },
  presetTextSelected: { color: t.colors.primary },
  numRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  numReadout: { minWidth: 64, alignItems: 'center' },
  num: {
    fontFamily: t.fonts.headingHeavy,
    fontSize: 30,
    lineHeight: 36,
    color: t.colors.ink,
  },
}));
