import { useLocalSearchParams } from 'expo-router';
import { EmptyState, Screen } from '@/components';

/** Chat — placeholder (to be built). */
export default function ChatScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  return (
    <Screen header={{ title: 'Chat' }}>
      <EmptyState icon="chatbubbles" title="Coming soon" body={`Messages for booking ${bookingId}.`} />
    </Screen>
  );
}
