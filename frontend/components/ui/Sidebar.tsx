'use client'

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Settings, EqualApproximately, Menu, ChevronLeft, Activity } from 'lucide-react';
import { useEffect, useState } from "react";
import { usePrivy, useSolanaWallets } from "@privy-io/react-auth";
import { useUserStore } from '@/store/useAuthStore';
import Image from "next/image";

interface SidebarProps {
  setActivePage: (page: string) => void;
}



export function Sidebar({ setActivePage }: SidebarProps) {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useSolanaWallets();
  const [isOpen, setIsOpen] = useState(true);
  const { userInfo } = useUserStore();


  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button variant="outline" size="icon" onClick={() => setIsOpen(!isOpen)}>
          <Menu className="w-5 h-5" />
        </Button>
      </div>

      {/* Sidebar Panel */}
      <div className={`fixed md:relative h-screen bg-muted/10 border-r transition-all duration-300 ${isOpen ? "w-64" : "w-16"} overflow-hidden`}>
        <div className="flex items-center justify-between p-4 border-b">
          {isOpen && (
            <div className="flex items-center gap-2">
            {/* Logo with Green Overlay */}
            <div className="relative w-8 h-8">
              <Image src="/logo.png" alt="Logo" width={128} height={128} className="rounded-full" />
              <div className="absolute inset-0 bg-green-500 opacity-20 rounded-full" />
            </div>
            <span className="font-semibold">Mechanize Labs</span>
          </div>
          )}
          <Button variant="ghost" size="icon" className="hidden md:flex" onClick={() => setIsOpen(!isOpen)}>
            <ChevronLeft className={`w-5 h-5 transform transition-transform ${isOpen ? "rotate-0" : "rotate-180"}`} />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-64px)]">
          <div className="space-y-4 p-4">
            <nav className="space-y-2">
              <Button variant="ghost" className="w-full justify-start" onClick={() => setActivePage("about")}>
                <EqualApproximately className="mr-2 h-4 w-4" /> {isOpen && "Manifesto"}
              </Button>
              {ready && authenticated && user && (
                <>
                
                  <Button variant="ghost" className="w-full justify-start" onClick={() => setActivePage("tasks")}>
                    <Brain className="mr-2 h-4 w-4" /> {isOpen && "Tasks"}
                  </Button>
                  <Button variant="ghost" className="w-full justify-start" onClick={() => setActivePage("settings")}> 
                    <Settings className="mr-2 h-4 w-4" /> {isOpen && "Settings"} 
                  </Button>
                  <Button variant="ghost" className="w-full justify-start" onClick={() => setActivePage("agentgenerator")}> 
                    <Activity className="mr-2 h-4 w-4" /> {isOpen && "Agent"} 
                  </Button>
                  {(userInfo.tokenBalance !== null && userInfo.tokenBalance < 0) && (
                    <Button variant="ghost" className="w-full justify-start" onClick={() => setActivePage("exclusive")}>
                      🔑 {isOpen && "Exclusive Access"}
                    </Button>
                  )}
                  
                </>
              )}
            </nav>
          </div>
        </ScrollArea>
      </div>

      {/* Overlay for Mobile */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 md:hidden z-40" onClick={() => setIsOpen(false)} />
      )}
    </>
  );
}
