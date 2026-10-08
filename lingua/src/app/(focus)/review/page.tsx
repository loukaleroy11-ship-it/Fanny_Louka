import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewApp } from "./review-app";

export const metadata: Metadata = { title: "Réviser" };

export default function Page() {
  return <Suspense><ReviewApp /></Suspense>;
}
