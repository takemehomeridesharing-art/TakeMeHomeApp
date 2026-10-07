import { EmptyState, Screen } from '@/components';

/** Notifications — placeholder (to be built). */
export default function NotificationsScreen() {
  return (
    <Screen header={{ title: 'Notifications' }}>
      <EmptyState icon="notifications" title="Coming soon" body="Updates about your requests and trips." />
    </Screen>
  );
}
