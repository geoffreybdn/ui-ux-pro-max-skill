import { Suspense } from "react";
import { TopBar } from "@/components/TopBar";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Connexion" };

export default function Page() {
  return (
    <>
      <TopBar />
      <main className="container narrow page">
        <h1>Connexion</h1>
        <Suspense>
          <LoginForm />
        </Suspense>
      </main>
    </>
  );
}
