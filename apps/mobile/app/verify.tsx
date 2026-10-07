import { EmptyState, Screen } from '@/components';

/** Verification — placeholder (to be built). */
export default function VerifyScreen() {
  return (
    <Screen header={{ title: 'Verification' }}>
      <EmptyState icon="shield-checkmark" title="Coming soon" body="Verify your email, ID, licence and vehicle." />
    </Screen>
  );
}
