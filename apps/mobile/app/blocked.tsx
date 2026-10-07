import { EmptyState, Screen } from '@/components';

/** Blocked users — placeholder (to be built). */
export default function BlockedScreen() {
  return (
    <Screen header={{ title: 'Blocked users' }}>
      <EmptyState icon="ban" title="Coming soon" body="People you've blocked won't see your trips." />
    </Screen>
  );
}
