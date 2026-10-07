import { EmptyState, Screen } from '@/components';

/** Report a problem — placeholder (to be built). */
export default function ReportScreen() {
  return (
    <Screen header={{ title: 'Report a problem' }}>
      <EmptyState icon="flag" title="Coming soon" body="Tell us what happened. Our safety team reviews every report." />
    </Screen>
  );
}
