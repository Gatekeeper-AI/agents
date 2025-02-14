//app/chat/layout.tsx
"use client";

import { Sidebar } from "@/components/ui/Sidebar";
import { Header } from "@/components/ui/Header";
import { useState } from "react";
import ChatInterface from "@/components/ui/chat-interface";
import About from "@/components/ui/About";
import Settings from "@/components/ui/Settings";
import AgentInteractionPage from "@/components/ui/AgentInteractionPage";

export default function ChatLayout() {
  const [activePage, setActivePage] = useState("about");

  const renderPage = () => {
    switch (activePage) {
      case "tasks":
        return <ChatInterface />;
      case "agentgenerator":
        return <AgentInteractionPage/>
      case "settings":
        return <Settings />;
      case "about":
      default:
        return <About />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar setActivePage={setActivePage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 overflow-y-auto">{renderPage()}</div>
      </div>
    </div>
  );
}
