import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { toClientUser } from "@/lib/clientuser";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <Providers initialUser={await toClientUser(user)}>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
