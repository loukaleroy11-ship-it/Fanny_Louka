import type { Metadata } from "next";
import { CognatesView } from "./cognates-view";

export const metadata: Metadata = { title: "Words You Already Know" };
export default function Page() { return <CognatesView />; }
