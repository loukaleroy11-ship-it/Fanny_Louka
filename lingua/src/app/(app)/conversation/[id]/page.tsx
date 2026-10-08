import type { Metadata } from "next";
import { ChatView } from "./chat";

export const metadata: Metadata = { title: "Conversation" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ChatView id={(await params).id} />;
}
