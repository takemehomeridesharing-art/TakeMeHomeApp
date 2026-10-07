import { useLocalSearchParams } from 'expo-router';
import { EmptyState, Screen } from '@/components';

/** Track — placeholder (to be built). */
export default function TrackScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  return (
    <Screen header={{ title: 'Track' }}>
      <EmptyState icon="navigate" title="Coming soon" body={`Live trip for booking ${bookingId}, with SOS.`} />
    </Screen>
  );
}
