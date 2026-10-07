import { EmptyState, Screen, Text } from '@/components';

/** My Trip tab — placeholder (to be built). */
export default function MyTripTab() {
  return (
    <Screen tabBarSpace>
      <Text variant="h1" style={{ marginTop: 12 }}>
        My Trip
      </Text>
      <EmptyState icon="navigate" title="Coming soon" body="Your next trip, requests and the daily meter will show up here." />
    </Screen>
  );
}
