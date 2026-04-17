import { BaziTrainerWorkspace, type WorkspaceMode } from "@/components/bazi/BaziTrainerWorkspace";

export {
  BaziTrainerWorkspace,
} from "@/components/bazi/BaziTrainerWorkspace";

export {
  createDefaultFormState,
  getResetActionCopy,
  shouldConfirmSessionReset,
  type FormState,
} from "@/lib/bazi/trainer-workspace";

type HomePageProps = {
  searchParams?: Promise<{
    workspace?: string;
  }>;
};

function resolveInitialWorkspace(candidate?: string): WorkspaceMode {
  return candidate === "queue" ? "queue" : "manual";
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <BaziTrainerWorkspace
      initialWorkspace={resolveInitialWorkspace(resolvedSearchParams?.workspace)}
    />
  );
}
