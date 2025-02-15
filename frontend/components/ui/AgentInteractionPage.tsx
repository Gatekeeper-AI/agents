"use client";

import { useState } from "react";
import AgentInteraction from "@/components/ui/AgentInteraction";

const AgentInteractionPage = () => {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [agentsJson, setAgentsJson] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleFetchAgents = async () => {
    if (!websiteUrl.trim()) {
      alert("Please enter a valid website URL.");
      return;
    }
    setLoading(true);
    
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/get_json?url=${websiteUrl}`
      );
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      const data = await response.json();
      setAgentsJson(data);
    } catch (error) {
      console.error("Error fetching agents.json:", error);
      alert("Failed to fetch agents.json.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-slate-100 space-y-6">
      <div className="w-full max-w-md mx-auto bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold text-gray-700 text-center mb-4">
          Enter Website URL
        </h2>
        <input
          type="text"
          placeholder="Enter website URL"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
        />
        <button
          onClick={handleFetchAgents}
          disabled={loading}
          className="w-full bg-blue-500 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition"
        >
          {loading ? "Loading..." : "Fetch Agents"}
        </button>
      </div>
      {agentsJson && <AgentInteraction url={websiteUrl} agentsJson={agentsJson} />}
    </main>
  );
};

export default AgentInteractionPage;
