import { useLocalSearchParams } from 'expo-router';
import { EmptyState, Screen } from '@/components';

/** Trip — placeholder (to be built). */
export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen header={{ title: 'Trip' }}>
      <EmptyState icon="car-sport" title="Coming soon" body={`Trip ${id}: corridor, driver, car and your contribution.`} />
    </Screen>
  );
}
