import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Icon, OtpInput, Screen, Text } from '@/components';
import { errorMessage } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { useRequestOtp, useVerifyOtp } from '@/lib/queries';
import { makeStyles } from '@/theme';

const RESEND_SECONDS = 30;

/** OTP verification. On success the session is stored and the auth gate routes onward. */
export default function OtpScreen() {
  const s = useStyles();
  const { phone = '', hint } = useLocalSearchParams<{ phone: string; hint?: string }>();
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const verify = useVerifyOtp();
  const resend = useRequestOtp();

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((x) => x - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const submit = (c = code) => {
    if (c.length !== 6 || verify.isPending) return;
    verify.mutate({ phone, code: c });
  };

  return (
    <Screen
      header={{ back: true }}
      footer={<Button label="Verify" size="lg" block loading={verify.isPending} disabled={code.length !== 6} onPress={() => submit()} testID="verify" />}
    >
      <View style={s.intro}>
        <Text variant="h1">Enter the code</Text>
        <View style={s.sentRow}>
          <Text variant="body" color="ink2">
            Sent by SMS to <Text variant="bodyStrong">{formatPhone(phone)}</Text>
          </Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text variant="bodyStrong" color="primary">
              Change
            </Text>
          </Pressable>
        </View>
      </View>

      <OtpInput
        value={code}
        onChangeText={(c) => {
          setCode(c);
          if (verify.error) verify.reset();
        }}
        onComplete={submit}
        error={Boolean(verify.error)}
        disabled={verify.isPending}
      />

      {verify.error ? (
        <View style={s.errorRow}>
          <Icon name="alert-circle" size={16} color="coral" />
          <Text variant="caption" color="coral">
            {errorMessage(verify.error)}
          </Text>
        </View>
      ) : null}

      <View style={s.resendRow}>
        {seconds > 0 ? (
          <Text variant="caption">Resend code in 0:{String(seconds).padStart(2, '0')}</Text>
        ) : (
          <Pressable
            hitSlop={8}
            disabled={resend.isPending}
            onPress={() => resend.mutate(phone, { onSuccess: () => setSeconds(RESEND_SECONDS) })}
          >
            <Text variant="bodyStrong" color="primary">
              {resend.isPending ? 'Sending…' : 'Resend code'}
            </Text>
          </Pressable>
        )}
      </View>

      {__DEV__ ? (
        <View style={s.devHint}>
          <Icon name="construct" size={14} color="ink2" />
          <Text variant="caption">{hint || 'Dev OTP is 123456'}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  intro: { gap: 8, marginTop: 8, marginBottom: 28 },
  sentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  resendRow: { marginTop: 24, alignItems: 'center' },
  devHint: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.line,
  },
}));
