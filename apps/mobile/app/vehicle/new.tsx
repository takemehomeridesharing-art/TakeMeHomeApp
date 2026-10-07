import { EmptyState, Screen } from '@/components';

/** Add a vehicle — placeholder (to be built). */
export default function NewVehicleScreen() {
  return (
    <Screen header={{ title: 'Add a vehicle' }}>
      <EmptyState icon="car" title="Coming soon" body="Register the car you drive." />
    </Screen>
  );
}
