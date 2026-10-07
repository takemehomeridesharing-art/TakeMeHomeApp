import { useLocalSearchParams } from 'expo-router';
import { EmptyState, Screen } from '@/components';

/** Ticket — placeholder (to be built). */
export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen header={{ title: 'Ticket' }}>
      <EmptyState icon="ticket" title="Coming soon" body={`Your ticket for booking ${id}.`} />
    </Screen>
  );
}
