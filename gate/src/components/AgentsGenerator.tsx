import React, { useState } from "react";

interface AgentsJsonGeneratorProps {
  // You can pass an initial Solana address from the parent if desired
  solanaAddress: string;
}

const AgentsGenerator: React.FC<AgentsJsonGeneratorProps> = ({ solanaAddress }) => {
  const [websiteUrl, setWebsiteUrl] = useState<string>("");
  const [customSolanaAddress, setCustomSolanaAddress] = useState<string>(solanaAddress || "");
  const [solanaRate, setSolanaRate] = useState<string>("");

  const [agentsJSON, setAgentsJSON] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Fetch the agents.json from the server
  // by calling /get_json?url=<websiteUrl>&prompt=
  const handleFetchAgentsJSON = async () => {
    if (!websiteUrl.trim()) {
      setStatusMessage("Error: Website URL cannot be empty.");
      return;
    }
    setStatusMessage("Fetching agents.json...");
    setAgentsJSON("");
    setCopied(false);

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/get_json?url=${websiteUrl}&prompt=`
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Get the JSON data from the server
      const data = await response.json();

      // Add the user-input Solana fields to the fetched JSON
      data.solanaAddress = customSolanaAddress;
      data.solanaRate = solanaRate;

      // Convert the updated object to a JSON string
      const jsonString = JSON.stringify(data, null, 2);
      setAgentsJSON(jsonString);
      setStatusMessage("agents.json fetched successfully!");
    } catch (error) {
      console.error("Error fetching agents.json:", error);
      setStatusMessage("Failed to fetch agents.json. Check server logs.");
    }
  };

  // Copy the JSON to clipboard
  const handleCopyJSON = async () => {
    try {
      if (agentsJSON) {
        await navigator.clipboard.writeText(agentsJSON);
        setCopied(true);
      }
    } catch (error) {
      console.error("Failed to copy JSON", error);
    }
  };

  // Download the JSON as a file named "agents.json"
  const handleDownloadJSON = () => {
    if (!agentsJSON) return;
    const blob = new Blob([agentsJSON], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "agents.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up the object URL
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-white p-6 rounded-lg shadow-lg mt-5">
      <h2 className="text-xl font-semibold text-gray-700 text-center mb-4">
        Generate an agent.json
      </h2>

      {/* Website URL Input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Enter Website URL"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-2"
        />
        <button
          onClick={handleFetchAgentsJSON}
          className="w-full bg-green-500 text-white font-semibold py-2 rounded-lg hover:bg-green-700 transition"
        >
          Generate
        </button>
      </div>

      {/* Solana Address Input */}
      <div className="mb-4">
        <label className="block mb-1 text-sm font-medium text-gray-700">
          Solana Address
        </label>
        <input
          type="text"
          placeholder="Enter Solana Address"
          value={customSolanaAddress}
          onChange={(e) => setCustomSolanaAddress(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Solana Rate Input */}
      <div className="mb-4">
        <label className="block mb-1 text-sm font-medium text-gray-700">
          Solana Rate
        </label>
        <input
          type="number"
          placeholder="Enter Solana Rate (e.g., 0.01)"
          value={solanaRate}
          onChange={(e) => setSolanaRate(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Status or Error Message */}
      {statusMessage && (
        <p className="text-center text-sm text-gray-600">{statusMessage}</p>
      )}

      {/* Display the returned agents.json */}
      {agentsJSON && (
        <div className="mt-6 bg-gray-100 p-4 rounded-lg border border-gray-300">
          <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap">
            {agentsJSON}
          </pre>

          {/* Copy Button */}
          <button
            onClick={handleCopyJSON}
            className={`mt-3 w-full py-2 text-white font-semibold rounded-lg transition ${
              copied ? "bg-green-500" : "bg-blue-500 hover:bg-blue-700"
            }`}
          >
            {copied ? "Copied!" : "Copy JSON"}
          </button>

          {/* Download Button */}
          <button
            onClick={handleDownloadJSON}
            className="mt-2 w-full py-2 text-white font-semibold rounded-lg bg-indigo-500 hover:bg-indigo-700 transition"
          >
            Download JSON
          </button>
        </div>
      )}
    </div>
  );
};

export default AgentsGenerator;
