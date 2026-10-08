import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";

/** For server components: the signed-in user or a redirect to /login. */
export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}
