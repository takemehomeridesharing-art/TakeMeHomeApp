import { type Gender } from '@tmh/shared';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Chip, fromE164, Icon, Input, isValidLocalPhone, PhoneInput, Screen, Text, toE164, toast } from '@/components';
import { errorMessage } from '@/lib/api';
import { usePlaces, useUpdateMe } from '@/lib/queries';
import { useSession } from '@/stores/session';
import { makeStyles } from '@/theme';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];

/** First-run profile: name, optional gender, home area and trusted contact. */
export default function ProfileSetup() {
  const s = useStyles();
  const me = useSession((st) => st.me);
  const signOut = useSession((st) => st.signOut);
  const places = usePlaces();
  const updateMe = useUpdateMe();

  // New accounts come back as "New member" (empty name server-side) — don't prefill that.
  const [name, setName] = useState(me?.profileComplete ? me.name : '');
  const [gender, setGender] = useState<Gender | null>(me?.gender ?? null);
  const [homeArea, setHomeArea] = useState<string | null>(me?.homeArea ?? null);
  const [contact, setContact] = useState(me?.trustedContactPhone ? fromE164(me.trustedContactPhone) : '');
  const [submitted, setSubmitted] = useState(false);

  const nameError = submitted && name.trim().length < 2 ? 'Please enter your name (2+ letters)' : null;
  const contactError = submitted && contact.length > 0 && !isValidLocalPhone(contact) ? 'Enter a Rwandan mobile number' : null;

  const save = () => {
    setSubmitted(true);
    if (name.trim().length < 2 || (contact.length > 0 && !isValidLocalPhone(contact))) return;
    updateMe.mutate(
      { name: name.trim(), gender, homeArea, trustedContactPhone: contact ? toE164(contact) : null },
      {
        onSuccess: (updated) => {
          if (!updated.profileComplete) toast.error('Almost there', 'Your profile still needs a few details.');
        },
      },
    );
  };

  return (
    <Screen
      header={{
        back: false,
        right: (
          <Pressable onPress={() => void signOut()} hitSlop={8} accessibilityRole="button">
            <Text variant="caption" color="ink2">
              Sign out
            </Text>
          </Pressable>
        ),
      }}
      footer={
        <>
          {updateMe.error ? (
            <Text variant="caption" color="coral" align="center">
              {errorMessage(updateMe.error)}
            </Text>
          ) : null}
          <Button label="Continue" size="lg" block loading={updateMe.isPending} onPress={save} testID="profile-continue" />
        </>
      }
    >
      <View style={s.intro}>
        <Text variant="h1">Set up your profile</Text>
        <Text variant="body" color="ink2">
          Drivers and passengers see your first name and rating. That&apos;s it.
        </Text>
      </View>

      <View style={s.form}>
        <Input label="Your name" value={name} onChangeText={setName} placeholder="e.g. Aline Uwase" autoCapitalize="words" autoComplete="name" textContentType="name" error={nameError} testID="name-input" />

        <View style={s.field}>
          <Text variant="caption" color="ink" style={s.label}>
            Gender <Text variant="caption">(optional)</Text>
          </Text>
          <View style={s.chips}>
            {GENDERS.map((g) => (
              <Chip key={g.value} label={g.label} selected={gender === g.value} onPress={() => setGender(gender === g.value ? null : g.value)} />
            ))}
          </View>
          <View style={s.note}>
            <Icon name="female" size={14} color="primary" />
            <Text variant="caption">Needed to join women-only trips</Text>
          </View>
        </View>

        <View style={s.field}>
          <Text variant="caption" color="ink" style={s.label}>
            Home area
          </Text>
          <View style={s.chips}>
            {(places.data ?? []).map((p) => (
              <Chip key={p.id} label={p.name} icon={homeArea === p.name ? 'home' : undefined} selected={homeArea === p.name} onPress={() => setHomeArea(homeArea === p.name ? null : p.name)} />
            ))}
          </View>
        </View>

        <PhoneInput
          label="Trusted contact (optional)"
          value={contact}
          onChangeText={setContact}
          hint="We'll alert them if you press SOS"
          error={contactError}
          autoFocus={false}
        />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  intro: { gap: 8, marginTop: 4, marginBottom: 24 },
  form: { gap: 24 },
  field: { gap: 10 },
  label: { fontFamily: t.fonts.bodySemiBold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6 },
}));
