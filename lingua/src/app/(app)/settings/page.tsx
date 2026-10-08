import type { Metadata } from "next";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Paramètres" };
export default function Page() { return <SettingsView />; }
