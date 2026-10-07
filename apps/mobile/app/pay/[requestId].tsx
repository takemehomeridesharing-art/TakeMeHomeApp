import { useLocalSearchParams } from 'expo-router';
import { EmptyState, Screen } from '@/components';

/** Pay with MoMo — placeholder (to be built). */
export default function PayScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  return (
    <Screen header={{ title: 'Pay with MoMo' }}>
      <EmptyState icon="wallet" title="Coming soon" body={`Pay your contribution for request ${requestId}.`} />
    </Screen>
  );
}
