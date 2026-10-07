import { KIGALI_PLACES, type Gender, type Me } from '@tmh/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  Avatar,
  Badge,
  Button,
  CarIllustration,
  Card,
  Chip,
  fromE164,
  Icon,
  Input,
  isValidLocalPhone,
  ListRow,
  PhoneInput,
  Screen,
  SegmentedControl,
  Stars,
  Text,
  toast,
  toE164,
  VerificationChips,
  type SegmentedOption,
} from '@/components';
import { hapticNotify } from '@/features/driver/haptics';
import { usePhotoUpload } from '@/features/driver/media';
import { PlaceSheet } from '@/features/driver/PlaceSheet';
import { errorMessage } from '@/lib/api';
import { formatPhone } from '@/lib/format';
import { useMe, useUnreadCount, useUpdateMe } from '@/lib/queries';
import { useSession, type AppMode } from '@/stores/session';
import { makeStyles, useTheme } from '@/theme';

const MODES: SegmentedOption<AppMode>[] = [
  { value: 'passenger', label: 'Passenger', icon: 'person' },
  { value: 'driver', label: 'Driver', icon: 'car-sport' },
];

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Profile tab: who you are, trust chips, mode switch, editable details, vehicles, links and sign out. */
export default function ProfileTab() {
  const s = useStyles();
  const { data: me } = useMe();
  const mode = useSession((st) => st.mode);
  const setMode = useSession((st) => st.setMode);
  const signOut = useSession((st) => st.signOut);
  const unread = useUnreadCount();

  if (!me) return null;

  const switchMode = (next: AppMode) => {
    if (next === mode) return;
    setMode(next);
    router.navigate(next === 'driver' ? '/my-trip' : '/home');
  };

  const allVerified = Object.values(me.verification).every((v) => v === 'verified');

  return (
    <Screen tabBarSpace testID="profile">
      <Text variant="h1" style={s.title}>
        Profile
      </Text>

      <ProfileHeader me={me} allVerified={allVerified} />

      <Card style={s.card}>
        <Text variant="label">Mode</Text>
        <SegmentedControl options={MODES} value={mode} onChange={switchMode} testID="mode-switch" />
        <Text variant="caption">
          {mode === 'driver'
            ? me.vehicles.length
              ? 'Publish trips you already make and share the running cost.'
              : "Driver mode is on — add your car on My Trip to publish your first trip."
            : 'Find a seat on a trip that is already going your way.'}
        </Text>
      </Card>

      <DetailsCard me={me} />

      <Text variant="label" style={s.sectionLabel}>
        My vehicles
      </Text>
      <Card style={s.card} testID="my-vehicles">
        {me.vehicles.length === 0 ? (
          <View style={s.noCar}>
            <CarIllustration color="Silver" width={120} shadow={false} />
            <View style={s.flex}>
              <Text variant="bodyStrong">No car yet</Text>
              <Text variant="caption">Add the car you drive to publish trips as a driver.</Text>
            </View>
          </View>
        ) : (
          me.vehicles.map((v, i) => (
            <Animated.View key={v.id} entering={FadeIn.duration(200)} style={[s.vehicle, i < me.vehicles.length - 1 ? s.divider : null]}>
              <CarIllustration color={v.color} width={88} shadow={false} />
              <View style={s.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {v.make} {v.model}
                </Text>
                <Text variant="caption" numberOfLines={1}>
                  {v.color} · {v.plate} · {v.seats} seats
                </Text>
                <View style={s.badges}>
                  {v.isEV ? <Badge kind="ev" /> : null}
                  {v.verified ? <Badge kind="success" icon="shield-checkmark" label="Verified" /> : <Badge kind="neutral" label="Not verified" />}
                </View>
              </View>
            </Animated.View>
          ))
        )}
        <Button label="Add vehicle" icon="add" variant="secondary" block onPress={() => router.push('/vehicle/new')} testID="profile-add-vehicle" />
      </Card>

      <Card style={s.card} padding={8}>
        <View style={s.list}>
          <ListRow
            icon="notifications"
            title="Notifications"
            subtitle={unread ? `${unread} unread` : 'Requests, payments and trip updates'}
            onPress={() => router.push('/notifications')}
            divider
          />
          <ListRow icon="time" title="Trip history" subtitle="Past trips as driver and passenger" onPress={() => router.push('/history')} divider />
          <ListRow icon="ban" title="Blocked users" onPress={() => router.push('/blocked')} divider />
          <ListRow
            icon="shield-checkmark"
            iconColor="success"
            title="Verification"
            subtitle={allVerified ? 'Everything is verified' : 'Email, ID, licence and vehicle'}
            onPress={() => router.push('/verify')}
            divider
          />
          <ListRow icon="flag" iconColor="coral" title="Report a problem" onPress={() => router.push('/report')} />
        </View>
      </Card>

      <Button label="Sign out" variant="ghost" icon="log-out-outline" onPress={() => void signOut()} style={s.signOut} testID="sign-out" />
    </Screen>
  );
}

function ProfileHeader({ me, allVerified }: { me: Me; allVerified: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  const photo = usePhotoUpload();
  const updateMe = useUpdateMe();
  const since = new Date(me.memberSince);
  const busy = photo.busy || updateMe.isPending;

  const changePhoto = async () => {
    const url = await photo.pickAndUpload({ square: true });
    if (!url) {
      if (photo.error) toast.error("Couldn't upload that photo", photo.error);
      return;
    }
    updateMe.mutate(
      { photoUrl: url },
      {
        onSuccess: () => {
          hapticNotify('success');
          toast.success('Photo updated', 'Drivers and passengers recognise you faster with a photo.');
        },
        onError: (e) => toast.error("Couldn't save your photo", errorMessage(e)),
      },
    );
  };

  return (
    <Card style={s.card}>
      <View style={s.who}>
        <Pressable onPress={() => void changePhoto()} disabled={busy} accessibilityRole="button" accessibilityLabel="Change profile photo" testID="change-photo">
          <Avatar name={me.name} photoUrl={me.photoUrl} size={76} />
          <View style={s.camera}>{busy ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Icon name="camera" size={14} color="onPrimary" />}</View>
        </Pressable>
        <View style={s.whoText}>
          <Text variant="h2" numberOfLines={1}>
            {me.name}
          </Text>
          <Text variant="caption">{formatPhone(me.phone)}</Text>
          {me.ratingCount > 0 ? <Stars value={me.ratingAvg} count={me.ratingCount} showValue size={14} /> : <Text variant="caption">No ratings yet</Text>}
          <Text variant="caption" color="ink3">
            Member since {MONTHS[since.getMonth()]} {since.getFullYear()}
          </Text>
        </View>
      </View>
      <VerificationChips chips={me.verification} />
      {!allVerified ? (
        <Button label="Get verified" icon="shield-checkmark" variant="secondary" size="sm" onPress={() => router.push('/verify')} testID="get-verified" />
      ) : null}
    </Card>
  );
}

function DetailsCard({ me }: { me: Me }) {
  const s = useStyles();
  const updateMe = useUpdateMe();
  const [name, setName] = useState(me.name);
  const [gender, setGender] = useState<Gender | null>(me.gender);
  const [homeArea, setHomeArea] = useState<string | null>(me.homeArea);
  const [contact, setContact] = useState(me.trustedContactPhone ? fromE164(me.trustedContactPhone) : '');
  const [sheet, setSheet] = useState(false);

  // Re-sync when the saved profile changes elsewhere (e.g. after saving).
  const savedKey = `${me.name}|${me.gender}|${me.homeArea}|${me.trustedContactPhone}`;
  const [lastSaved, setLastSaved] = useState(savedKey);
  if (savedKey !== lastSaved) {
    setLastSaved(savedKey);
    setName(me.name);
    setGender(me.gender);
    setHomeArea(me.homeArea);
    setContact(me.trustedContactPhone ? fromE164(me.trustedContactPhone) : '');
  }

  const contactE164 = contact ? toE164(contact) : null;
  const dirty = name.trim() !== me.name || gender !== me.gender || homeArea !== me.homeArea || contactE164 !== me.trustedContactPhone;
  const nameError = name.trim().length < 2 ? 'Please enter your name (2+ letters)' : null;
  const contactError = contact.length > 0 && !isValidLocalPhone(contact) ? 'Enter a Rwandan mobile number' : null;

  const save = () => {
    if (nameError || contactError) return;
    updateMe.mutate(
      { name: name.trim(), gender, homeArea, trustedContactPhone: contactE164 },
      {
        onSuccess: () => {
          hapticNotify('success');
          toast.success('Profile saved');
        },
        onError: (e) => toast.error("Couldn't save your profile", errorMessage(e)),
      },
    );
  };

  return (
    <>
      <Text variant="label" style={s.sectionLabel}>
        Your details
      </Text>
      <Card style={[s.card, s.details]} testID="profile-details">
        <Input label="Name" value={name} onChangeText={setName} autoCapitalize="words" error={nameError} testID="profile-name" />

        <View style={s.field}>
          <Text variant="caption" color="ink" style={s.label}>
            Home area
          </Text>
          <Pressable onPress={() => setSheet(true)} accessibilityRole="button" style={({ pressed }) => [s.picker, pressed ? s.pressed : null]} testID="profile-home-area">
            <Icon name="home-outline" size={18} color="ink2" />
            <Text variant="body" color={homeArea ? 'ink' : 'ink3'} style={s.flex}>
              {homeArea ?? 'Choose your area'}
            </Text>
            <Icon name="chevron-down" size={18} color="ink3" />
          </Pressable>
        </View>

        <View style={s.field}>
          <Text variant="caption" color="ink" style={s.label}>
            Gender
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

        <PhoneInput label="Trusted contact" value={contact} onChangeText={setContact} hint="We'll text them if you press SOS" error={contactError} autoFocus={false} testID="profile-contact" />

        {dirty ? (
          <Animated.View entering={FadeInDown.duration(200)}>
            <Button label="Save changes" icon="checkmark" block loading={updateMe.isPending} disabled={Boolean(nameError || contactError)} onPress={save} testID="profile-save" />
          </Animated.View>
        ) : null}
      </Card>

      <PlaceSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Your home area"
        subtitle="Helps us suggest trips near you"
        selectedId={KIGALI_PLACES.find((p) => p.name === homeArea)?.id ?? null}
        onSelect={(p) => setHomeArea(p.name)}
      />
    </>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
  title: { marginTop: 12, marginBottom: 16 },
  sectionLabel: { marginTop: 10, marginBottom: 10, marginLeft: 4 },
  card: { gap: 14, marginBottom: 14 },
  details: { gap: 18 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  whoText: { flex: 1, gap: 2 },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: t.colors.primary,
    borderWidth: 2,
    borderColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: 8 },
  signOut: { alignSelf: 'center' },
  noCar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  vehicle: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: t.colors.line },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  field: { gap: 10 },
  label: { fontFamily: t.fonts.bodySemiBold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
  },
}));
