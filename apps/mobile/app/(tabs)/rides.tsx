import { EmptyState, Screen, Text } from '@/components';

/** Rides tab — placeholder (to be built). */
export default function RidesTab() {
  return (
    <Screen tabBarSpace>
      <Text variant="h1" style={{ marginTop: 12 }}>
        Rides
      </Text>
      <EmptyState icon="ticket" title="Coming soon" body="Your requests and tickets will show up here." />
    </Screen>
  );
}
