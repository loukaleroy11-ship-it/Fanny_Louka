import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-xl font-semibold">
          <span className="grid size-10 place-items-center rounded-xl bg-brand text-brand-ink"><Sparkles className="size-5" /></span> Lingua
        </Link>
        {children}
      </div>
    </div>
  );
}
