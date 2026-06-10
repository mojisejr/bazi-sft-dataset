import { BaziTrainerWorkspace } from "@/components/bazi/BaziTrainerWorkspace";

export {
  BaziTrainerWorkspace,
} from "@/components/bazi/BaziTrainerWorkspace";

export {
  createDefaultFormState,
  getResetActionCopy,
  shouldConfirmSessionReset,
  type FormState,
} from "@/lib/bazi/trainer-workspace";

export default function HomePage() {
  return <BaziTrainerWorkspace />;
}
