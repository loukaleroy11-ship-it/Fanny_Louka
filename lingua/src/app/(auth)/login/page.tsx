import type { Metadata } from "next";
import { registrationOpen } from "@/lib/registration";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Connexion" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <LoginForm canRegister={registrationOpen()} />;
}
