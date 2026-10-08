import type { Metadata } from "next";
import { MistakesView } from "./mistakes-view";

export const metadata: Metadata = { title: "My Mistakes" };
export default function Page() { return <MistakesView />; }
