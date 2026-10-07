import { type TripDetail } from '@tmh/shared';
import { View } from 'react-native';
import { Card, StopList, Text } from '@/components';
import { TripMap } from '@/components/TripMap';
import { makeStyles } from '@/theme';

/** The trip's corridor: map, stop list and how many seats are taken on each leg. */
export function RouteCard({ trip, showOccupancy = true }: { trip: TripDetail; showOccupancy?: boolean }) {
  const s = useStyles();
  const places = trip.stops.map((st) => st.place);
  const first = trip.stops[0];
  const last = trip.stops[trip.stops.length - 1];
  return (
    <Card padding={0} style={s.card}>
      <TripMap routeStops={places} boardPlaceId={first?.placeId} alightPlaceId={last?.placeId} height={200} interactive={false} style={s.map} />
      <View style={s.body}>
        <StopList stops={trip.stops} />
        {showOccupancy && trip.legOccupancy.length ? (
          <View style={s.legs}>
            <Text variant="label">Seats taken per leg</Text>
            {trip.legOccupancy.map((n, i) => {
              const a = trip.stops[i];
              const b = trip.stops[i + 1];
              if (!a || !b) return null;
              return (
                <View key={a.id} style={s.leg}>
                  <Text variant="caption" style={s.legName} numberOfLines={1}>
                    {a.place.name} → {b.place.name}
                  </Text>
                  <View style={s.seats}>
                    {Array.from({ length: trip.seatsOffered }, (_, k) => (
                      <View key={k} style={[s.seat, k < n ? s.seatTaken : null]} />
                    ))}
                  </View>
                  <Text variant="caption" color="ink" style={s.legCount}>
                    {n}/{trip.seatsOffered}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: { overflow: 'hidden' },
  map: { borderTopLeftRadius: t.radius.lg, borderTopRightRadius: t.radius.lg },
  body: { padding: 16, gap: 16 },
  legs: { gap: 8, borderTopWidth: 1, borderTopColor: t.colors.line, paddingTop: 14 },
  leg: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legName: { flex: 1 },
  seats: { flexDirection: 'row', gap: 4 },
  seat: { width: 14, height: 14, borderRadius: 4, backgroundColor: t.colors.line },
  seatTaken: { backgroundColor: t.colors.primary },
  legCount: { width: 30, textAlign: 'right', fontFamily: t.fonts.bodySemiBold },
}));
