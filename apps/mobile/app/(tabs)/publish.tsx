import { EmptyState, Screen, Text } from '@/components';

/** Publish tab — placeholder (to be built). */
export default function PublishTab() {
  return (
    <Screen tabBarSpace>
      <Text variant="h1" style={{ marginTop: 12 }}>
        Publish
      </Text>
      <EmptyState icon="add-circle" title="Coming soon" body="Publish a trip you're already making." />
    </Screen>
  );
}
