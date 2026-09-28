import { Suspense } from "react";
import { TopBar } from "@/components/TopBar";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Inscription" };

export default function Page() {
  return (
    <>
      <TopBar />
      <main className="container narrow page">
        <h1>Créer ma carte</h1>
        <p className="muted">Déjà client avec l&apos;ancienne carte ? Utilisez la même adresse e-mail pour récupérer vos tampons.</p>
        <Suspense>
          <RegisterForm />
        </Suspense>
      </main>
    </>
  );
}
