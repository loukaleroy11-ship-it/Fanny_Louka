import { redirect } from "next/navigation";
import { registrationOpen } from "@/lib/registration";
import { RegisterForm } from "./form";

export const dynamic = "force-dynamic";

export default function Page() {
  if (!registrationOpen()) redirect("/login");
  return <RegisterForm />;
}
