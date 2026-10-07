import { BOOKING_FEE, BOOKING_FEE_EV } from '@tmh/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Button, CarIllustration, carColorHex, Card, Chip, Icon, Input, Screen, Text, toast } from '@/components';
import { Column } from '@/features/driver/Column';
import { hapticNotify, hapticTap } from '@/features/driver/haptics';
import { usePhotoUpload } from '@/features/driver/media';
import { NumberStepper } from '@/features/driver/Steppers';
import { ToggleRow } from '@/features/driver/ToggleRow';
import { assetUrl, errorMessage } from '@/lib/api';
import { useCreateVehicle, useCreateVerification } from '@/lib/queries';
import { makeStyles, useTheme } from '@/theme';

const COLORS = ['Silver', 'White', 'Black', 'Grey', 'Blue', 'Red', 'Green'];
/** Swatch dots use the same palette as CarIllustration. */
const SWATCH: Record<string, string> = Object.fromEntries(COLORS.map((c) => [c, carColorHex(c)]));
const MAKES = ['Toyota', 'Suzuki', 'Hyundai', 'Kia', 'Volkswagen', 'Nissan'];
const PLATE_RE = /^R[A-Z]{2} ?\d{3} ?[A-Z]$/;
const MAX_PHOTOS = 3;

/** Register a vehicle: details, colour (live preview), seats, EV flag, 1–3 photos, optional verification. */
export default function NewVehicleScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const create = useCreateVehicle();
  const verify = useCreateVerification();
  const photo = usePhotoUpload();

  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [plate, setPlate] = useState('');
  const [color, setColor] = useState('Silver');
  const [seats, setSeats] = useState(5);
  const [isEV, setIsEV] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitVerification, setSubmitVerification] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const plateNorm = plate.trim().toUpperCase();
  const errors = {
    make: make.trim().length < 2 ? 'Enter the make, e.g. Toyota' : null,
    model: model.trim().length < 1 ? 'Enter the model, e.g. Corolla' : null,
    plate: !PLATE_RE.test(plateNorm) ? 'Rwandan plates look like RAD 123 A' : null,
    photos: photos.length < 1 ? 'Add at least one photo of your car' : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (e: string | null) => (submitted ? e : null);

  const addPhoto = async () => {
    const url = await photo.pickAndUpload();
    if (url) {
      hapticTap();
      setPhotos((p) => [...p, url].slice(0, MAX_PHOTOS));
    }
  };

  const save = async () => {
    setSubmitted(true);
    if (!valid) {
      toast.error('A few details are missing', Object.values(errors).find(Boolean) ?? undefined);
      return;
    }
    try {
      const vehicle = await create.mutateAsync({
        make: make.trim(),
        model: model.trim(),
        plate: plateNorm,
        color,
        seats,
        isEV,
        photos,
      });
      let verifyNote = '';
      if (submitVerification) {
        try {
          await verify.mutateAsync({
            type: 'vehicle',
            vehicleId: vehicle.id,
            documentUrl: photos[0]!,
          });
          verifyNote = ' Sent for verification — an admin usually reviews within a day.';
        } catch (e) {
          verifyNote = ` Verification wasn't sent (${errorMessage(e)}) — you can retry from Verification.`;
        }
      }
      hapticNotify('success');
      toast.success(`${vehicle.make} ${vehicle.model} added`, `You can now publish trips with it.${verifyNote}`);
      if (router.canGoBack()) router.back();
      else router.replace('/my-trip');
    } catch (e) {
      hapticNotify('error');
      toast.error("Couldn't add your car", errorMessage(e));
    }
  };

  const busy = create.isPending || verify.isPending;

  return (
    <Screen
      header={{ title: 'Add your car' }}
      footer={
        <Column style={s.footerCol}>
          {create.error ? (
            <Text variant="caption" color="coral" align="center">
              {errorMessage(create.error)}
            </Text>
          ) : null}
          <Button label="Save car" icon="checkmark" size="lg" block loading={busy} disabled={photo.busy} onPress={() => void save()} testID="save-vehicle" />
        </Column>
      }
    >
      <Column>
        <Card style={s.preview}>
          <Animated.View key={color} entering={FadeIn.duration(250)} style={s.previewCar}>
            <CarIllustration color={color} width={260} />
          </Animated.View>
          <View style={s.previewText}>
            <Text variant="h2" align="center" numberOfLines={1}>
              {make.trim() || model.trim() ? `${make.trim()} ${model.trim()}`.trim() : 'Your car'}
            </Text>
            <View style={s.plate}>
              <Text style={s.plateText}>{plateNorm || 'RAD 123 A'}</Text>
            </View>
          </View>
        </Card>

        <View style={s.form}>
          <View style={s.field}>
            <Input
              label="Make"
              value={make}
              onChangeText={setMake}
              placeholder="e.g. Toyota"
              autoCapitalize="words"
              error={show(errors.make)}
              testID="vehicle-make"
            />
            <View style={s.chips}>
              {MAKES.map((m) => (
                <Chip key={m} label={m} selected={make === m} onPress={() => setMake(m)} />
              ))}
            </View>
          </View>
          <Input
            label="Model"
            value={model}
            onChangeText={setModel}
            placeholder="e.g. Corolla"
            autoCapitalize="words"
            error={show(errors.model)}
            testID="vehicle-model"
          />
          <Input
            label="Number plate"
            value={plate}
            onChangeText={(v) => setPlate(v.toUpperCase())}
            placeholder="RAD 123 A"
            autoCapitalize="characters"
            autoCorrect={false}
            hint="Format: RAD 123 A — passengers check it before getting in"
            error={plate.length >= 7 || submitted ? (errors.plate ? 'Rwandan plates look like RAD 123 A' : null) : null}
            right={PLATE_RE.test(plateNorm) ? <Icon name="checkmark-circle" size={20} color="success" /> : null}
            testID="vehicle-plate"
          />

          <View style={s.field}>
            <Text variant="caption" color="ink" style={s.label}>
              Colour
            </Text>
            <View style={s.chips}>
              {COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => {
                    hapticTap();
                    setColor(c);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: color === c }}
                  accessibilityLabel={c}
                  style={({ pressed }) => [s.swatchChip, color === c ? s.swatchChipOn : null, pressed ? s.pressed : null]}
                  testID={`color-${c}`}
                >
                  <View style={[s.swatch, { backgroundColor: SWATCH[c] ?? colors.line }]} />
                  <Text variant="caption" style={[s.swatchLabel, color === c ? s.swatchLabelOn : null]}>
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Card style={s.rowCard}>
            <View style={s.flex}>
              <Text variant="bodyStrong">Seats in the car</Text>
              <Text variant="caption">Including yours — you can offer up to {Math.min(seats - 1, 4)} to passengers.</Text>
            </View>
            <NumberStepper value={seats} min={2} max={8} onChange={setSeats} testID="vehicle-seats" />
          </Card>

          <Card>
            <ToggleRow
              icon="flash"
              title="Electric or hybrid"
              subtitle={`Passengers pay a lower RWF ${BOOKING_FEE_EV} booking fee on your trips (instead of RWF ${BOOKING_FEE}).`}
              value={isEV}
              onChange={setIsEV}
              testID="vehicle-ev"
            />
          </Card>

          <View style={s.field}>
            <View style={s.photoHead}>
              <Text variant="caption" color="ink" style={s.label}>
                Photos ({photos.length}/{MAX_PHOTOS})
              </Text>
              <Text variant="caption">Front with the plate visible works best</Text>
            </View>
            <View style={s.photos}>
              {photos.map((p, i) => (
                <Animated.View key={p} entering={ZoomIn.duration(200)} style={s.photo}>
                  <Image source={{ uri: assetUrl(p) }} style={s.photoImg} contentFit="cover" />
                  {i === 0 ? (
                    <View style={s.coverTag}>
                      <Text style={s.coverText}>Cover</Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => setPhotos((list) => list.filter((x) => x !== p))}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo"
                    style={s.removePhoto}
                  >
                    <Icon name="close" size={14} color="onPrimary" />
                  </Pressable>
                </Animated.View>
              ))}
              {photos.length < MAX_PHOTOS ? (
                <Pressable
                  onPress={() => void addPhoto()}
                  disabled={photo.busy}
                  accessibilityRole="button"
                  accessibilityLabel="Add a photo"
                  style={({ pressed }) => [s.photo, s.addPhoto, show(errors.photos) ? s.addPhotoError : null, pressed ? s.pressed : null]}
                  testID="add-photo"
                >
                  {photo.busy ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <>
                      <Icon name="camera-outline" size={24} color="primary" />
                      <Text variant="caption" color="primary" style={s.label}>
                        Add photo
                      </Text>
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>
            {photo.error ? (
              <Text variant="caption" color="coral">
                {photo.error}
              </Text>
            ) : show(errors.photos) ? (
              <Text variant="caption" color="coral">
                {errors.photos}
              </Text>
            ) : null}
          </View>

          <Card variant="tinted">
            <ToggleRow
              icon="shield-checkmark"
              title="Also verify this car"
              subtitle="We'll send your cover photo to our team. Verified cars get a badge passengers trust — usually reviewed within a day."
              value={submitVerification}
              onChange={setSubmitVerification}
              testID="vehicle-verify"
            />
          </Card>
        </View>
      </Column>
    </Screen>
  );
}

const useStyles = makeStyles((t) => ({
  flex: { flex: 1, gap: 2 },
  footerCol: { gap: 10 },
  pressed: { opacity: 0.7 },
  preview: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 20,
    backgroundColor: t.colors.surface,
  },
  previewCar: { alignItems: 'center' },
  previewText: { alignItems: 'center', gap: 8 },
  plate: {
    borderWidth: 2,
    borderColor: t.colors.ink,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 2,
    backgroundColor: t.colors.accent2,
  },
  plateText: {
    fontFamily: t.fonts.headingHeavy,
    fontSize: 16,
    letterSpacing: 1.5,
    color: t.colors.ink,
  },
  form: { gap: 20, marginTop: 20 },
  field: { gap: 10 },
  label: { fontFamily: t.fonts.bodySemiBold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
  },
  swatchChipOn: {
    borderColor: t.colors.primary,
    backgroundColor: t.colors.tint,
  },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: t.colors.line,
  },
  swatchLabel: { fontFamily: t.fonts.bodySemiBold, color: t.colors.ink2 },
  swatchLabelOn: { color: t.colors.primary },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photoHead: { gap: 2 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: {
    width: 100,
    height: 100,
    borderRadius: t.radius.md,
    overflow: 'hidden',
    backgroundColor: t.colors.tint,
  },
  photoImg: { width: '100%', height: '100%' },
  addPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: t.colors.primary,
  },
  addPhotoError: { borderColor: t.colors.coral },
  coverTag: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: t.colors.scrim,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coverText: {
    fontFamily: t.fonts.bodyBold,
    fontSize: 10,
    color: t.colors.onPrimary,
  },
  removePhoto: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: t.colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
