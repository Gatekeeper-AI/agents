//app/chat/page.tsx

import ChatInterface from "@/components/ui/chat-interface";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat",
};

export default function ChatPage() {
  return (
        <ChatInterface />
  );
}
