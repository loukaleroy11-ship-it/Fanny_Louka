import type { Metadata } from "next";
import { VocabularyView } from "./vocabulary-view";

export const metadata: Metadata = { title: "Vocabulaire par fonction" };
export default function Page() { return <VocabularyView />; }
