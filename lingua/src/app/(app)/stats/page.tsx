import type { Metadata } from "next";
import { StatsView } from "./stats-view";

export const metadata: Metadata = { title: "Statistiques" };
export default function Page() { return <StatsView />; }
