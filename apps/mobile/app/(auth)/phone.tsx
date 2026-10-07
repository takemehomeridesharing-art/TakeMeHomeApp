import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar, Badge, Button, Card, isValidLocalPhone, PhoneInput, Screen, Text, toE164 } from '@/components';
import { errorMessage } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { useDevAccounts, useRequestOtp } from '@/lib/queries';
import { makeStyles } from '@/theme';

/** Phone entry: sends the OTP. In dev, lists seeded accounts to tap-fill. */
export default function PhoneScreen() {
  const s = useStyles();
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);
  const requestOtp = useRequestOtp();
  const valid = isValidLocalPhone(phone);

  const submit = (local = phone) => {
    setTouched(true);
    if (!isValidLocalPhone(local)) return;
    const e164 = toE164(local);
    requestOtp.mutate(e164, {
      onSuccess: (res) => router.push({ pathname: '/otp', params: { phone: res.phone ?? e164, hint: res.devHint ?? '' } }),
    });
  };

  const fieldError =
    requestOtp.error ? errorMessage(requestOtp.error) : touched && phone.length > 0 && !valid ? 'Enter a Rwandan mobile number, e.g. 078 123 4567' : null;

  return (
    <Screen
      header={{ back: true }}
      footer={<Button label="Send code" size="lg" block loading={requestOtp.isPending} disabled={!valid} onPress={() => submit()} testID="send-code" />}
    >
      <View style={s.intro}>
        <Text variant="h1">What&apos;s your number?</Text>
        <Text variant="body" color="ink2">
          We&apos;ll text you a 6-digit code. New to Take Me Home? The same code creates your account.
        </Text>
      </View>

      <PhoneInput
        label="Mobile number"
        value={phone}
        onChangeText={(v) => {
          setPhone(v);
          if (requestOtp.error) requestOtp.reset();
        }}
        onBlur={() => setTouched(true)}
        onSubmitEditing={() => submit()}
        returnKeyType="send"
        autoFocus
        error={fieldError}
        hint="MTN or Airtel number — you'll also pay with it."
        testID="phone-input"
      />

      {__DEV__ ? <DevAccounts onPick={(p) => setPhone(p)} /> : null}
    </Screen>
  );
}

function DevAccounts({ onPick }: { onPick: (localPhone: string) => void }) {
  const s = useStyles();
  const { data, isError, isLoading } = useDevAccounts();
  return (
    <Card variant="outlined" style={s.dev} padding={14}>
      <View style={s.devHeader}>
        <Badge kind="neutral" icon="construct" label="DEV" />
        <Text variant="bodyStrong" style={s.devTitle}>
          Seeded accounts
        </Text>
        <Text variant="caption">
          OTP <Text variant="caption" color="ink" style={s.code}>123456</Text>
        </Text>
      </View>
      {isLoading ? <Text variant="caption">Loading…</Text> : null}
      {isError ? <Text variant="caption">Dev accounts unavailable — is the API running on :4000?</Text> : null}
      {data?.map((a, i) => (
        <Pressable
          key={a.phone}
          onPress={() => onPick(a.phone.replace(/^\+250/, ''))}
          style={({ pressed }) => [s.devRow, i > 0 ? s.devRowBorder : null, pressed ? s.pressed : null]}
          accessibilityRole="button"
          accessibilityLabel={`Use ${a.name}`}
          testID={`dev-account-${i}`}
        >
          <Avatar name={a.name} size={34} />
          <View style={s.devText}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {a.name}
            </Text>
            <Text variant="caption" numberOfLines={1}>
              {formatPhone(a.phone)}
              {a.note ? ` · ${a.note}` : ''}
            </Text>
          </View>
          <Badge kind={/driver/i.test(a.role) ? 'primary' : /admin/i.test(a.role) ? 'warning' : 'neutral'} label={a.role} />
        </Pressable>
      ))}
      <Text variant="caption" style={s.devHint}>
        Dev OTP is 123456 — tap an account to fill the number.
      </Text>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  intro: { gap: 8, marginTop: 8, marginBottom: 24 },
  dev: { marginTop: 28, gap: 4, backgroundColor: t.colors.surface },
  devHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  devTitle: { flex: 1 },
  code: { fontFamily: t.fonts.heading, letterSpacing: 1 },
  devRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  devRowBorder: { borderTopWidth: 1, borderTopColor: t.colors.line },
  devText: { flex: 1 },
  pressed: { opacity: 0.6 },
  devHint: { marginTop: 6 },
}));
