import { HealthCheck } from "./HealthCheck";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-4 py-24">
      <h1 className="text-4xl font-bold tracking-tight">Run a retro in minutes.</h1>
      <p className="text-lg text-muted-foreground">
        Retro Meeting is being built. This page checks that the deployment and the backend work.
      </p>
      <HealthCheck />
    </main>
  );
}
