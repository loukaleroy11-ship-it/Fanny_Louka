import type { Metadata } from "next";
import { VerbsView } from "./verbs-view";

export const metadata: Metadata = { title: "Most Common Verbs" };
export default function Page() { return <VerbsView />; }
