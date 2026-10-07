import { useLocalSearchParams } from 'expo-router';
import { EmptyState, Screen } from '@/components';

/** Request — placeholder (to be built). */
export default function RequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen header={{ title: 'Request' }}>
      <EmptyState icon="hourglass" title="Coming soon" body={`Request ${id}: waiting for the driver to accept.`} />
    </Screen>
  );
}
