import type { Metadata } from "next";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Connexion" };

export default function Page() {
  return <LoginForm />;
}
