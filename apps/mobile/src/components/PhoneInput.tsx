import { forwardRef } from 'react';
import { View, type TextInput } from 'react-native';
import { makeStyles } from '@/theme';
import { Input, type InputProps } from './Input';
import { Text } from './Text';

/** Keeps only the 9 local digits after +250 (drops a leading 0 or 250 prefix). */
export function normalizeLocalPhone(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('250')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 9);
}

/** `788123456` → `+250788123456`. */
export function toE164(local: string): string {
  return `+250${normalizeLocalPhone(local)}`;
}

/** `+250788123456` (or any accepted form) → `788123456`. */
export function fromE164(phone: string): string {
  return normalizeLocalPhone(phone);
}

/** Whether the 9 local digits look like a Rwandan mobile number (07[2389]…). */
export function isValidLocalPhone(local: string): boolean {
  return /^7[2389]\d{7}$/.test(normalizeLocalPhone(local));
}

function formatLocal(local: string): string {
  const d = normalizeLocalPhone(local);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(' ');
}

export interface PhoneInputProps extends Omit<InputProps, 'value' | 'onChangeText' | 'left'> {
  /** The 9 local digits (no +250, no spaces). */
  value: string;
  onChangeText: (localDigits: string) => void;
}

/** Rwandan phone field with a fixed `+250` prefix and the flag. Value is the 9 local digits; use `toE164` to submit. */
export const PhoneInput = forwardRef<TextInput, PhoneInputProps>(function PhoneInput({ value, onChangeText, ...rest }, ref) {
  const s = useStyles();
  return (
    <Input
      ref={ref}
      keyboardType="phone-pad"
      textContentType="telephoneNumber"
      autoComplete="tel"
      placeholder="788 123 456"
      maxLength={11}
      {...rest}
      value={formatLocal(value)}
      onChangeText={(t) => onChangeText(normalizeLocalPhone(t))}
      style={s.text}
      left={
        <View style={s.prefix}>
          <View style={s.flag}>
            <View style={[s.stripe, s.blue]} />
            <View style={[s.stripe, s.yellow]} />
            <View style={[s.stripe, s.green]} />
          </View>
          <Text variant="bodyStrong">+250</Text>
          <View style={s.divider} />
        </View>
      }
    />
  );
});

const useStyles = makeStyles((t) => ({
  prefix: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flag: { width: 22, height: 15, borderRadius: 3, overflow: 'hidden' },
  stripe: { flex: 1 },
  blue: { flex: 2, backgroundColor: '#20A0D8' },
  yellow: { backgroundColor: '#FAD201' },
  green: { backgroundColor: '#20603D' },
  divider: { width: 1, height: 22, backgroundColor: t.colors.line, marginLeft: 4 },
  text: { fontFamily: t.fonts.bodySemiBold, fontSize: 17, letterSpacing: 0.5 },
}));
