import { CreatePotForm } from '@/components/pot/CreatePotForm';
import { Screen } from '@/components/pot/Screen';

export default function NewPotPage() {
  return (
    <Screen title="New pot">
      <CreatePotForm />
    </Screen>
  );
}
