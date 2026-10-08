import type { Metadata } from "next";
import { Suspense } from "react";
import { ConversationHome } from "./home";

export const metadata: Metadata = { title: "AI Conversation" };
export default function Page() { return <Suspense><ConversationHome /></Suspense>; }
