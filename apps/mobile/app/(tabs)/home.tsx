import { EmptyState, Screen, Text } from '@/components';

/** Home tab — placeholder (to be built). */
export default function HomeTab() {
  return (
    <Screen tabBarSpace>
      <Text variant="h1" style={{ marginTop: 12 }}>
        Home
      </Text>
      <EmptyState icon="map" title="Coming soon" body="Search trips and see cars on the map here." />
    </Screen>
  );
}
