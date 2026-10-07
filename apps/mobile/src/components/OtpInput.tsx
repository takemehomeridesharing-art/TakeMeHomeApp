import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { makeStyles } from '@/theme';
import { Text } from './Text';

export interface OtpInputProps {
  value: string;
  onChangeText: (code: string) => void;
  /** Called once all digits are entered. */
  onComplete?: (code: string) => void;
  length?: number;
  /** Turns the boxes coral. */
  error?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
}

/** One-time-code entry: N boxes backed by a single hidden TextInput (SMS autofill friendly). */
export function OtpInput({ value, onChangeText, onComplete, length = 6, error = false, autoFocus = true, disabled }: OtpInputProps) {
  const s = useStyles();
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (autoFocus) {
      const id = setTimeout(() => ref.current?.focus(), 250);
      return () => clearTimeout(id);
    }
  }, [autoFocus]);

  return (
    <Pressable onPress={() => ref.current?.focus()} style={s.row} accessibilityLabel="One-time code">
      {Array.from({ length }, (_, i) => {
        const char = value[i] ?? '';
        const active = focused && (i === value.length || (i === length - 1 && value.length === length));
        return (
          <View key={i} style={[s.box, char ? s.filled : null, active ? s.active : null, error ? s.error : null]}>
            <Text style={s.digit}>{char}</Text>
            {active && !char ? <View style={s.caret} /> : null}
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        editable={!disabled}
        onChangeText={(t) => {
          const code = t.replace(/\D/g, '').slice(0, length);
          onChangeText(code);
          if (code.length === length) onComplete?.(code);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        caretHidden
        style={s.hidden}
        testID="otp-input"
      />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  box: {
    flex: 1,
    maxWidth: 56,
    aspectRatio: 0.82,
    borderRadius: t.radius.sm,
    borderWidth: 1.5,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: { borderColor: t.colors.ink3 },
  active: { borderColor: t.colors.primary, ...t.shadows.sm },
  error: { borderColor: t.colors.coral, backgroundColor: t.colors.coralWash },
  digit: { fontFamily: t.fonts.headingHeavy, fontSize: 26, lineHeight: 32, color: t.colors.ink },
  caret: { position: 'absolute', width: 2, height: 24, borderRadius: 1, backgroundColor: t.colors.primary },
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: 'transparent' },
}));
