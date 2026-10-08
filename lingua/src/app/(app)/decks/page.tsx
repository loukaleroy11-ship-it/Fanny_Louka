import type { Metadata } from "next";
import { DecksPage } from "./decks-page";

export const metadata: Metadata = { title: "Decks" };
export default function Page() { return <DecksPage />; }
