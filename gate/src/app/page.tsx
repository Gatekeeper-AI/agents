"use client";

import Image from "next/image";
import { AuthForm } from "../components/AuthForm";
import { withTurnkey } from "@/hoc";

function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-full max-w-md px-6">
        <div className="space-y-3 mb-12 flex flex-col items-center">
          <Image 
            src="/logo.png" 
            alt="Logo" 
            width={100} 
            height={100} 
            priority
          />
          <p className="text-gray-700 text-center text-lg">
            Get paid from AI Agents
          </p>
        </div>
        <div className="bg-white p-6 shadow-md rounded-lg">
          <AuthForm />
        </div>
      </div>
    </main>
  );
}

export default withTurnkey(Home);
