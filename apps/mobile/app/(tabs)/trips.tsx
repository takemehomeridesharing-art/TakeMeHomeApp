import { EmptyState, Screen, Text } from '@/components';

/** Trips tab — placeholder (to be built). */
export default function TripsTab() {
  return (
    <Screen tabBarSpace>
      <Text variant="h1" style={{ marginTop: 12 }}>
        Trips
      </Text>
      <EmptyState icon="car" title="Coming soon" body="Upcoming and past trips will show up here." />
    </Screen>
  );
}
