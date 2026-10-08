import Link from "next/link";
import { redirect } from "next/navigation";
import { X } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { toClientUser } from "@/lib/clientuser";
import { Providers } from "@/components/providers";

export const dynamic = "force-dynamic";

/** Distraction-free layout for the placement test and review sessions. */
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <Providers initialUser={await toClientUser(user)}>
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-4">
        <header className="mb-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-lg font-semibold">Lingua</Link>
          <Link href="/dashboard" aria-label="Quitter" className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-surface-2"><X className="size-5" /></Link>
        </header>
        <main id="main" className="flex flex-1 flex-col">{children}</main>
      </div>
    </Providers>
  );
}
