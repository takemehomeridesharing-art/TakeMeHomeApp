import { buildCorridor, computeContribution, KIGALI_PLACES, type TripStop } from '@tmh/shared';
import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  CarIllustration,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  FareBreakdownCard,
  Input,
  ListRow,
  LoadingState,
  OtpInput,
  PhoneInput,
  Screen,
  SegmentedControl,
  Stars,
  StatChip,
  StopList,
  Text,
  Ticket,
  toast,
  TwoTripMeter,
  VerificationChips,
} from '@/components';
import { TripMap } from '@/components/TripMap';
import { simulateServerEvent } from '@/lib/socket';
import { makeStyles } from '@/theme';

const CORRIDOR = ['nyamirambo', 'kimisagara', 'cbd', 'kimihurura', 'remera', 'kimironko'];
const placeById = new Map(KIGALI_PLACES.map((p) => [p.id, p]));
const STOPS: TripStop[] = buildCorridor(CORRIDOR).map((c) => ({
  id: `stop-${c.placeId}`,
  placeId: c.placeId,
  order: c.order,
  cumulativeKm: c.cumulativeKm,
  place: placeById.get(c.placeId)!,
}));
const COLORS = ['Silver', 'White', 'Black', 'Grey', 'Blue', 'Red', 'Green'];

/** DEV: living catalogue of the UI kit (reachable at /dev/kit, signed in or not). */
export default function KitScreen() {
  const s = useStyles();
  const [board, setBoard] = useState('stop-kimisagara');
  const [alight, setAlight] = useState('stop-remera');
  const [chip, setChip] = useState('Tomorrow');
  const [seg, setSeg] = useState<'passenger' | 'driver'>('passenger');
  const [stars, setStars] = useState(4);
  const [sheet, setSheet] = useState(false);
  const [phone, setPhone] = useState('788123456');
  const [otp, setOtp] = useState('123');

  const segment = useMemo(() => {
    const b = STOPS.find((x) => x.id === board)!;
    const a = STOPS.find((x) => x.id === alight)!;
    const km = Math.round((a.cumulativeKm - b.cumulativeKm) * 10) / 10;
    return { km, ...computeContribution({ segmentKm: km, seatsOffered: 3, isEV: false }) };
  }, [board, alight]);

  return (
    <Screen header={{ title: 'UI kit', subtitle: 'DEV gallery' }}>
      <Section title="Text">
        <Text variant="display">Display</Text>
        <Text variant="h1">Heading 1</Text>
        <Text variant="h2">Heading 2</Text>
        <Text variant="h3">Heading 3</Text>
        <Text>Body — Public Sans 400</Text>
        <Text variant="bodyStrong">Body strong</Text>
        <Text variant="caption">Caption</Text>
        <Text variant="label">Label</Text>
        <Text variant="money" color="accentInk">
          RWF 1,250
        </Text>
      </Section>

      <Section title="Buttons">
        <Button label="Request to join" block icon="hand-right" />
        <View style={s.row}>
          <Button label="Secondary" variant="secondary" />
          <Button label="Ghost" variant="ghost" />
          <Button label="SOS" variant="danger" icon="warning" />
        </View>
        <View style={s.row}>
          <Button label="Small" size="sm" />
          <Button label="Loading" loading />
          <Button label="Disabled" disabled />
        </View>
      </Section>

      <Section title="Chips, badges, segmented">
        <View style={s.wrap}>
          {['Today', 'Tomorrow', 'This week'].map((c) => (
            <Chip key={c} label={c} selected={chip === c} onPress={() => setChip(c)} />
          ))}
          <Chip label="Women only" icon="female" />
        </View>
        <View style={s.wrap}>
          <Badge kind="womenOnly" />
          <Badge kind="ev" />
          <Badge kind="success" label="Paid" icon="checkmark" />
          <Badge kind="warning" label="Pending" icon="time" />
          <Badge kind="danger" label="Declined" />
          <Badge kind="primary" label="3 seats left" />
          <Badge kind="neutral" label="Neutral" />
        </View>
        <SegmentedControl
          options={[
            { value: 'passenger', label: 'Passenger', icon: 'person' },
            { value: 'driver', label: 'Driver', icon: 'car-sport' },
          ]}
          value={seg}
          onChange={setSeg}
        />
      </Section>

      <Section title="Avatar, stars, stats, verification">
        <View style={s.row}>
          <Avatar name="Aline Uwase" size={48} />
          <Avatar name="Jean Bosco" size={40} />
          <Avatar name="Eric" size={32} />
          <Stars value={4.6} showValue count={23} />
        </View>
        <Stars value={stars} onChange={setStars} size={32} />
        <View style={s.row}>
          <StatChip label="Seat" value="1" icon="person" />
          <StatChip label="Distance" value="6.4 km" icon="navigate" tone="primary" />
          <StatChip label="Paid" value="RWF 610" icon="wallet" tone="accent" />
        </View>
        <VerificationChips chips={{ phone: 'verified', email: 'pending', id: 'verified', licence: 'none', vehicle: 'pending' }} />
      </Section>

      <Section title="Cars">
        <CarIllustration color="Silver" width={300} />
        <View style={s.wrap}>
          {COLORS.map((c) => (
            <View key={c} style={s.carCell}>
              <CarIllustration color={c} width={96} shadow={false} />
              <Text variant="caption">{c}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Trip map">
        <TripMap
          height={260}
          routeStops={STOPS.map((x) => x.place)}
          boardPlaceId={STOPS.find((x) => x.id === board)?.placeId}
          alightPlaceId={STOPS.find((x) => x.id === alight)?.placeId}
          style={s.map}
        />
        <TripMap
          height={300}
          pins={[
            { id: 't1', lat: -1.9575, lng: 30.111, title: 'Remera', fromAmount: 460 },
            { id: 't2', lat: -1.9497, lng: 30.0588, title: 'CBD', fromAmount: 310 },
            { id: 't3', lat: -1.977, lng: 30.103, title: 'Kicukiro', fromAmount: 540 },
          ]}
          onPinPress={(id) => toast.show({ title: `Pin ${id}` })}
          style={s.map}
        />
      </Section>

      <Section title="Stop list (tap to change board / drop-off)">
        <Card>
          <StopList stops={STOPS} boardStopId={board} alightStopId={alight} onSelectBoard={setBoard} onSelectAlight={setAlight} />
        </Card>
      </Section>

      <Section title="Fare breakdown">
        <FareBreakdownCard segmentKm={segment.km} seatsOffered={3} costShare={segment.costShare} bookingFee={segment.bookingFee} total={segment.total} />
      </Section>

      <Section title="Ticket">
        <Ticket
          from="Kimisagara"
          fromLandmark="Kimisagara youth centre"
          to="Remera"
          toLandmark="Amahoro stadium gate"
          departureTime={new Date(Date.now() + 86_400_000).toISOString()}
          tripCode="K7Q2"
          status={<Badge kind="success" label="Confirmed" icon="checkmark" />}
          stats={[
            { label: 'Seat', value: '1', icon: 'person' },
            { label: 'Distance', value: '7.8 km', icon: 'navigate', tone: 'primary' },
            { label: 'Paid', value: 'RWF 730', icon: 'wallet', tone: 'accent' },
          ]}
        />
      </Section>

      <Section title="Two-trip meter">
        <Card style={s.gap}>
          <TwoTripMeter used={1} />
          <TwoTripMeter used={2} dayLabel="tomorrow" />
        </Card>
      </Section>

      <Section title="Inputs">
        <Input label="Name" placeholder="e.g. Aline" icon="person-outline" />
        <Input label="With error" value="x" error="Please enter your name" />
        <PhoneInput label="Phone" value={phone} onChangeText={setPhone} autoFocus={false} />
        <OtpInput value={otp} onChangeText={setOtp} autoFocus={false} />
      </Section>

      <Section title="List rows">
        <Card padding={8}>
          <ListRow icon="shield-checkmark" title="Verify your identity" subtitle="Email, ID, licence" onPress={() => {}} divider />
          <ListRow icon="flag" iconColor="coral" title="Report a problem" onPress={() => {}} />
        </Card>
      </Section>

      <Section title="States">
        <Card>
          <EmptyState icon="car" title="No trips yet" body="When drivers publish trips on your corridor, they show up here." action={{ label: 'Search', onPress: () => {} }} />
        </Card>
        <Card>
          <ErrorState error="Can't reach Take Me Home right now." onRetry={() => {}} fill={false} />
        </Card>
        <Card>
          <LoadingState label="Finding trips…" fill={false} />
        </Card>
      </Section>

      <Section title="Overlays">
        <Button label="Open bottom sheet" variant="secondary" onPress={() => setSheet(true)} />
        <Button label="Show toast" variant="secondary" onPress={() => toast.show({ title: 'Request accepted', message: 'Jean accepted your request. Pay to confirm your seat.', onPress: () => {} })} />
        <Button
          label="Simulate MoMo prompt"
          variant="secondary"
          onPress={() => simulateServerEvent('momo:prompt', { paymentId: 'p1', providerRef: 'MOCK-123', amount: 610, msisdn: '+250788123456', merchant: 'Take Me Home' })}
        />
      </Section>

      <BottomSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Request to join"
        subtitle="Kimisagara → Remera · Tomorrow 07:30"
        footer={<Button label="Send request" block size="lg" onPress={() => setSheet(false)} />}
      >
        <FareBreakdownCard segmentKm={segment.km} seatsOffered={3} costShare={segment.costShare} bookingFee={segment.bookingFee} total={segment.total} />
      </BottomSheet>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const s = useStyles();
  return (
    <View style={s.section}>
      <Text variant="label">{title}</Text>
      {children}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  section: { gap: 12, marginBottom: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  carCell: { alignItems: 'center', gap: 2 },
  map: { borderRadius: t.radius.lg },
  gap: { gap: 18 },
}));
