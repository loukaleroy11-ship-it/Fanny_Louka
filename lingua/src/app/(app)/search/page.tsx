import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchView } from "./search-view";

export const metadata: Metadata = { title: "Recherche" };
export default function Page() { return <Suspense><SearchView /></Suspense>; }
