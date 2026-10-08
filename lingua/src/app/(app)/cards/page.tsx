import type { Metadata } from "next";
import { CardsPage } from "./cards-page";

export const metadata: Metadata = { title: "My Cards" };

export default function Page() {
  return <CardsPage />;
}
