import { useLocalSearchParams } from 'expo-router';
import { EmptyState, Screen } from '@/components';

/** Rate your trip — placeholder (to be built). */
export default function RateScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  return (
    <Screen header={{ title: 'Rate your trip' }}>
      <EmptyState icon="star" title="Coming soon" body={`Rate booking ${bookingId}.`} />
    </Screen>
  );
}
