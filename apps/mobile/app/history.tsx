import { EmptyState, Screen } from '@/components';

/** Trip history — placeholder (to be built). */
export default function HistoryScreen() {
  return (
    <Screen header={{ title: 'Trip history' }}>
      <EmptyState icon="time" title="Coming soon" body="Your past trips as driver and passenger." />
    </Screen>
  );
}
