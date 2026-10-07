import { type Me, type VerificationRequest, type VerificationType } from '@tmh/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Badge, Button, CarIllustration, Card, Chip, ErrorState, Icon, Input, LoadingState, Screen, Text, toast, type IconName } from '@/components';
import { hapticNotify } from '@/features/driver/haptics';
import { usePhotoUpload } from '@/features/driver/media';
import { assetUrl, errorMessage } from '@/lib/api';
import { formatPhone, formatRelative } from '@/lib/format';
import { useCreateVerification, useMe } from '@/lib/queries';
import { makeStyles, useTheme } from '@/theme';

type RowState = 'verified' | 'pending' | 'rejected' | 'none';
type Key = 'phone' | VerificationType;

const STATE_BADGE: Record<RowState, { kind: 'success' | 'warning' | 'danger' | 'neutral'; label: string; icon: IconName }> = {
  verified: { kind: 'success', label: 'Verified', icon: 'checkmark-circle' },
  pending: { kind: 'warning', label: 'Pending review', icon: 'time' },
  rejected: { kind: 'danger', label: 'Not approved', icon: 'alert-circle' },
  none: { kind: 'neutral', label: 'Not started', icon: 'ellipse-outline' },
};

function latestOf(me: Me, type: VerificationType, vehicleId?: string): VerificationRequest | undefined {
  return [...me.verificationRequests]
    .filter((r) => r.type === type && (vehicleId === undefined || r.vehicleId === vehicleId))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

function stateOf(me: Me, type: VerificationType): { state: RowState; latest?: VerificationRequest } {
  const latest = latestOf(me, type);
  if (me.verification[type] === 'verified') return { state: 'verified', latest };
  if (latest?.status === 'pending') return { state: 'pending', latest };
  if (latest?.status === 'rejected') return { state: 'rejected', latest };
  return { state: 'none', latest };
}

/** Verification centre: phone, email, ID, licence and vehicle — what's verified, pending or still to do. */
export default function VerifyScreen() {
  const s = useStyles();
  const meQ = useMe();
  const [open, setOpen] = useState<Key | null>(null);

  if (meQ.isPending) {
    return (
      <Screen header={{ title: 'Verification' }} scroll={false}>
        <LoadingState />
      </Screen>
    );
  }
  if (meQ.isError || !meQ.data) {
    return (
      <Screen header={{ title: 'Verification' }} scroll={false}>
        <ErrorState error={meQ.error} onRetry={() => void meQ.refetch()} />
      </Screen>
    );
  }
  const me = meQ.data;
  const chips = me.verification;
  const done = (Object.keys(chips) as (keyof typeof chips)[]).filter((k) => chips[k] === 'verified').length;
  const toggle = (k: Key) => setOpen((cur) => (cur === k ? null : k));

  const email = stateOf(me, 'email');
  const id = stateOf(me, 'id');
  const licence = stateOf(me, 'licence');
  const vehicleState: RowState =
    chips.vehicle === 'verified' ? 'verified' : chips.vehicle === 'pending' ? 'pending' : latestOf(me, 'vehicle')?.status === 'rejected' ? 'rejected' : 'none';

  return (
    <Screen header={{ title: 'Verification' }} testID="verify">
      <Card style={s.intro}>
        <View style={s.introTop}>
          <View style={s.shield}>
            <Icon name="shield-checkmark" size={26} color="primary" />
          </View>
          <View style={s.flex}>
            <Text variant="h2">
              {done} of 5 verified
            </Text>
            <Text variant="caption">Verified members get more accepted requests and more passengers.</Text>
          </View>
        </View>
        <View style={s.progress}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[s.progressSeg, i < done ? s.progressOn : null]} />
          ))}
        </View>
        <View style={s.introNote}>
          <Icon name="time-outline" size={16} color="primary" />
          <Text variant="caption" color="ink" style={s.flex}>
            An admin reviews your documents — usually within a day. Only our safety team sees them.
          </Text>
        </View>
      </Card>

      <View style={s.rows}>
        <VRow icon="call" title="Phone" subtitle={`${formatPhone(me.phone)} · confirmed by SMS code`} state="verified" />

        <VRow
          icon="mail"
          title="Email"
          subtitle={me.email ?? 'Add an email for receipts and account recovery'}
          state={email.state}
          latest={email.latest}
          open={open === 'email'}
          onToggle={() => toggle('email')}
        >
          <EmailForm initial={me.email ?? email.latest?.email ?? ''} onDone={() => setOpen(null)} />
        </VRow>

        <VRow
          icon="id-card"
          title="National ID"
          subtitle="Your Rwandan ID or passport"
          state={id.state}
          latest={id.latest}
          open={open === 'id'}
          onToggle={() => toggle('id')}
        >
          <DocumentForm type="id" hint="A clear photo of the front of your ID, all four corners visible." onDone={() => setOpen(null)} />
        </VRow>

        <VRow
          icon="card"
          title="Driving licence"
          subtitle="Needed to show the Licence badge to passengers"
          state={licence.state}
          latest={licence.latest}
          open={open === 'licence'}
          onToggle={() => toggle('licence')}
        >
          <DocumentForm type="licence" hint="A photo of your licence with your name and expiry date readable." onDone={() => setOpen(null)} />
        </VRow>

        <VRow
          icon="car-sport"
          title="Vehicle"
          subtitle={me.vehicles.length ? `${me.vehicles.length} car${me.vehicles.length === 1 ? '' : 's'} registered` : 'Register the car you drive first'}
          state={vehicleState}
          latest={latestOf(me, 'vehicle')}
          open={open === 'vehicle'}
          onToggle={() => toggle('vehicle')}
          alwaysOpenable
        >
          <VehicleForm me={me} onDone={() => setOpen(null)} />
        </VRow>
      </View>
    </Screen>
  );
}

function VRow({
  icon,
  title,
  subtitle,
  state,
  latest,
  open,
  onToggle,
  alwaysOpenable,
  children,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  state: RowState;
  latest?: VerificationRequest;
  open?: boolean;
  onToggle?: () => void;
  alwaysOpenable?: boolean;
  children?: ReactNode;
}) {
  const s = useStyles();
  const badge = STATE_BADGE[state];
  const openable = Boolean(onToggle) && (alwaysOpenable || state === 'none' || state === 'rejected');
  return (
    <Animated.View layout={LinearTransition.duration(200)}>
      <Card padding={0} style={s.vcard} testID={`verify-${title.toLowerCase().replace(/\s+/g, '-')}`}>
        <Pressable onPress={openable ? onToggle : undefined} disabled={!openable} style={({ pressed }) => [s.vhead, pressed ? s.pressed : null]} accessibilityRole={openable ? 'button' : undefined}>
          <View style={[s.vicon, state === 'verified' ? s.viconOk : state === 'pending' ? s.viconPending : null]}>
            <Icon name={icon} size={18} color={state === 'verified' ? 'success' : state === 'pending' ? 'accentInk' : 'primary'} />
          </View>
          <View style={s.flex}>
            <Text variant="bodyStrong">{title}</Text>
            <Text variant="caption" numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
          <View style={s.vright}>
            <Badge kind={badge.kind} label={badge.label} icon={badge.icon} />
            {openable ? <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color="ink3" /> : null}
          </View>
        </Pressable>

        {state === 'pending' && latest ? (
          <View style={s.vnote}>
            <Icon name="hourglass-outline" size={14} color="accentInk" />
            <Text variant="caption" color="accentInk" style={s.flex}>
              Sent {formatRelative(latest.createdAt)} — an admin usually reviews within a day.
            </Text>
          </View>
        ) : null}
        {state === 'rejected' && latest ? (
          <View style={[s.vnote, s.vnoteRejected]}>
            <Icon name="alert-circle" size={14} color="coral" />
            <Text variant="caption" color="ink" style={s.flex}>
              {latest.note ? `Reviewer's note: “${latest.note}”` : 'Your last submission was not approved.'} {open ? '' : 'Tap to send it again.'}
            </Text>
          </View>
        ) : null}

        {open && children ? (
          <Animated.View entering={FadeInDown.duration(200)} style={s.vbody}>
            {children}
          </Animated.View>
        ) : null}
      </Card>
    </Animated.View>
  );
}

function EmailForm({ initial, onDone }: { initial: string; onDone: () => void }) {
  const s = useStyles();
  const create = useCreateVerification();
  const [email, setEmail] = useState(initial);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const submit = () =>
    create.mutate(
      { type: 'email', email: email.trim() },
      {
        onSuccess: () => {
          hapticNotify('success');
          toast.success('Email sent for review', "We'll let you know when it's verified.");
          onDone();
        },
      },
    );
  return (
    <View style={s.form}>
      <Input
        label="Email address"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={create.error ? errorMessage(create.error) : null}
        testID="verify-email-input"
      />
      <Button label="Submit email" icon="paper-plane" block disabled={!valid} loading={create.isPending} onPress={submit} testID="verify-email-submit" />
    </View>
  );
}

function PhotoPicker({ value, onChange, label }: { value: string | null; onChange: (path: string | null) => void; label: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  const photo = usePhotoUpload();
  const pick = async () => {
    const url = await photo.pickAndUpload();
    if (url) onChange(url);
  };
  return (
    <View style={s.photoWrap}>
      {value ? (
        <Animated.View entering={FadeIn.duration(200)} style={s.docPreview}>
          <Image source={{ uri: assetUrl(value) }} style={s.docImg} contentFit="cover" />
          <Pressable onPress={() => void pick()} style={s.retake} accessibilityRole="button">
            <Icon name="refresh" size={14} color="onPrimary" />
            <Text style={s.retakeText}>Change</Text>
          </Pressable>
        </Animated.View>
      ) : (
        <Pressable onPress={() => void pick()} disabled={photo.busy} style={({ pressed }) => [s.docPick, pressed ? s.pressed : null]} accessibilityRole="button" testID="verify-pick-photo">
          {photo.busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Icon name="camera-outline" size={26} color="primary" />
              <Text variant="bodyStrong" color="primary">
                {label}
              </Text>
              <Text variant="caption">JPG or PNG from your photos</Text>
            </>
          )}
        </Pressable>
      )}
      {photo.error ? (
        <Text variant="caption" color="coral">
          {photo.error}
        </Text>
      ) : null}
    </View>
  );
}

function DocumentForm({ type, hint, onDone }: { type: 'id' | 'licence'; hint: string; onDone: () => void }) {
  const s = useStyles();
  const create = useCreateVerification();
  const [doc, setDoc] = useState<string | null>(null);
  const submit = () =>
    doc &&
    create.mutate(
      { type, documentUrl: doc },
      {
        onSuccess: () => {
          hapticNotify('success');
          toast.success(type === 'id' ? 'ID sent for review' : 'Licence sent for review', 'An admin usually reviews within a day.');
          onDone();
        },
      },
    );
  return (
    <View style={s.form}>
      <Text variant="caption">{hint}</Text>
      <PhotoPicker value={doc} onChange={setDoc} label={type === 'id' ? 'Add a photo of your ID' : 'Add a photo of your licence'} />
      {create.error ? (
        <Text variant="caption" color="coral">
          {errorMessage(create.error)}
        </Text>
      ) : null}
      <Button label="Submit for review" icon="paper-plane" block disabled={!doc} loading={create.isPending} onPress={submit} testID={`verify-${type}-submit`} />
    </View>
  );
}

function VehicleForm({ me, onDone }: { me: Me; onDone: () => void }) {
  const s = useStyles();
  const create = useCreateVerification();
  const candidates = me.vehicles.filter((v) => !v.verified && latestOf(me, 'vehicle', v.id)?.status !== 'pending');
  const [vehicleId, setVehicleId] = useState<string | null>(candidates[0]?.id ?? null);
  const [doc, setDoc] = useState<string | null>(null);

  if (me.vehicles.length === 0) {
    return (
      <View style={s.form}>
        <Text variant="caption">Add the car you drive, with a photo, and we&apos;ll verify it.</Text>
        <Button label="Add your car" icon="car-sport" variant="secondary" block onPress={() => router.push('/vehicle/new')} />
      </View>
    );
  }

  return (
    <View style={s.form}>
      {me.vehicles.map((v) => {
        const pending = latestOf(me, 'vehicle', v.id)?.status === 'pending';
        return (
          <View key={v.id} style={s.vehRow}>
            <CarIllustration color={v.color} width={72} shadow={false} />
            <View style={s.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {v.make} {v.model}
              </Text>
              <Text variant="caption">{v.plate}</Text>
            </View>
            {v.verified ? (
              <Badge kind="success" label="Verified" icon="checkmark-circle" />
            ) : pending ? (
              <Badge kind="warning" label="Pending" icon="time" />
            ) : (
              <Chip label={vehicleId === v.id ? 'Selected' : 'Select'} selected={vehicleId === v.id} onPress={() => setVehicleId(v.id)} />
            )}
          </View>
        );
      })}
      {candidates.length ? (
        <>
          <Text variant="caption">A photo of the registration card (carte grise) or of the car with its plate visible.</Text>
          <PhotoPicker value={doc} onChange={setDoc} label="Add a registration photo" />
          {create.error ? (
            <Text variant="caption" color="coral">
              {errorMessage(create.error)}
            </Text>
          ) : null}
          <Button
            label="Submit vehicle"
            icon="paper-plane"
            block
            disabled={!doc || !vehicleId}
            loading={create.isPending}
            onPress={() =>
              vehicleId &&
              doc &&
              create.mutate(
                { type: 'vehicle', vehicleId, documentUrl: doc },
                {
                  onSuccess: () => {
                    hapticNotify('success');
                    toast.success('Vehicle sent for review', 'An admin usually reviews within a day.');
                    onDone();
                  },
                },
              )
            }
            testID="verify-vehicle-submit"
          />
        </>
      ) : (
        <Text variant="caption">All your cars are verified or waiting for review.</Text>
      )}
      <Button label="Add another car" icon="add" variant="ghost" onPress={() => router.push('/vehicle/new')} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
  intro: { gap: 14 },
  introTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  shield: { width: 52, height: 52, borderRadius: 26, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center' },
  progress: { flexDirection: 'row', gap: 6 },
  progressSeg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: t.colors.line },
  progressOn: { backgroundColor: t.colors.success },
  introNote: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: t.colors.tint, borderRadius: t.radius.sm, padding: 12 },
  rows: { gap: 12, marginTop: 20 },
  vcard: { overflow: 'hidden' },
  vhead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  vicon: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.tint, alignItems: 'center', justifyContent: 'center' },
  viconOk: { backgroundColor: t.colors.mint },
  viconPending: { backgroundColor: t.colors.accent2 },
  vright: { alignItems: 'flex-end', gap: 6 },
  vnote: { flexDirection: 'row', gap: 8, alignItems: 'center', marginHorizontal: 16, marginBottom: 14, padding: 10, borderRadius: t.radius.sm, backgroundColor: t.colors.accent2 },
  vnoteRejected: { backgroundColor: t.colors.coralWash },
  vbody: { borderTopWidth: 1, borderTopColor: t.colors.line, padding: 16 },
  form: { gap: 12 },
  photoWrap: { gap: 6 },
  docPick: {
    height: 140,
    borderRadius: t.radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: t.colors.primary,
    backgroundColor: t.colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  docPreview: { height: 180, borderRadius: t.radius.md, overflow: 'hidden', backgroundColor: t.colors.bg },
  docImg: { width: '100%', height: '100%' },
  retake: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.colors.scrim, borderRadius: 14, paddingHorizontal: 10, height: 28 },
  retakeText: { fontFamily: t.fonts.bodySemiBold, fontSize: 12, color: t.colors.onPrimary },
  vehRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
}));
