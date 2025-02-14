import React, { useState } from "react";

interface AgentInteractionProps {
  url: string;
  agentsJson: any;
}

const AgentInteraction: React.FC<AgentInteractionProps> = ({ url, agentsJson }) => {
  const [agentQuery, setAgentQuery] = useState("");
  const [agentSteps, setAgentSteps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [generatedActions, setGeneratedActions] = useState<any>(null);

  // Map known actions to emojis; use 🤖 as the fallback.
  const actionEmojis: Record<string, string> = {
    navigate: "🌐",
    enter_text: "⌨️",
    click: "🖱️",
    // Add more custom mappings here if desired:
    // e.g. "select_dropdown": "⬇️"
  };

  const addStep = (message: string) => {
    setAgentSteps((prev) => [...prev, message]);
  };

  const handleAgentQuery = async () => {
    if (!agentQuery.trim()) {
      setStatusMessage("Error: Query cannot be empty.");
      return;
    }

    setAgentSteps([]);
    setGeneratedActions(null);
    setLoading(true);
    setStatusMessage("Processing query...");

    try {
      console.log("agentsJson")
      const response = await fetch("http://127.0.0.1:8000/generate_actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: agentQuery, agents_json: agentsJson }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();

      // Log the entire JSON response in agentSteps for debugging
      addStep("API response received:");
      addStep(JSON.stringify(data, null, 2));

      // Store the parsed actions in state for display
      setGeneratedActions(data);

      setStatusMessage("Actions generated successfully!");
    } catch (error) {
      console.error("Error processing query:", error);
      setStatusMessage("Failed to process query. Check API logs.");
    } finally {
      setLoading(false);
      setAgentQuery("");
    }
  };

  const handleInitiate = async () => {
    if (!generatedActions) {
      setStatusMessage("No actions available to initiate. Please generate actions first.");
      return;
    }

    try {
      setStatusMessage("Starting initiate...");
      
      // Because /initiate is defined as a GET endpoint with these query params,
      // encode the generatedActions as a string.
      const queryParams = new URLSearchParams({
        prompt: agentQuery,
        url,
        actions: JSON.stringify(generatedActions),
      });

      const response = await fetch(`http://127.0.0.1:8000/initiate?${queryParams.toString()}`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log("Initiate response:", data);

      setStatusMessage("Initiate started successfully!");
    } catch (error) {
      console.error("Error initiating:", error);
      setStatusMessage("Failed to start initiate. Check server logs.");
    }
  };

  // Helper function to get emoji for the action
  const getActionEmoji = (action: string) => {
    return actionEmojis[action] || "🤖";
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-white p-6 rounded-lg shadow-lg mt-5">
      <h2 className="text-xl font-semibold text-gray-700 text-center mb-4">
        Agent Interaction
      </h2>

      {/* Display the fixed website URL */}
      <p className="text-center text-sm text-gray-600 mb-4">
        Using <span className="font-semibold">{url}</span>
      </p>

      {/* Agent Query Input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Enter agent query"
          value={agentQuery}
          onChange={(e) => setAgentQuery(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAgentQuery}
          disabled={loading}
          className="w-full mt-2 bg-blue-500 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition"
        >
          {loading ? "Processing..." : "Execute Query"}
        </button>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <p className="text-center text-sm text-gray-600">{statusMessage}</p>
      )}

      {/* Query Steps (debug logs) */}
      {agentSteps.length > 0 && (
        <div className="mt-4 bg-gray-100 p-4 rounded-lg border border-gray-300">
          <h3 className="text-lg font-semibold text-gray-700">Debug Log:</h3>
          <pre className="text-sm font-mono text-gray-800 whitespace-pre-wrap">
            {agentSteps.join("\n")}
          </pre>
        </div>
      )}

      {/* Dynamically display generatedActions if available */}
      {generatedActions && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-300">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Task: {generatedActions.task}
          </h3>
          <ul className="space-y-2">
            {generatedActions.steps && generatedActions.steps.length > 0 ? (
              generatedActions.steps.map((step: any, index: number) => (
                <li
                  key={index}
                  className="flex items-center text-gray-800 text-sm"
                >
                  <span className="mr-2">{getActionEmoji(step.action)}</span>
                  <span>
                    <strong>Action:</strong> {step.action}
                    {step.selector && (
                      <>
                        {" "}
                        | <strong>Selector:</strong> {step.selector} (
                        {step.selector_type})
                      </>
                    )}
                    {step.text && (
                      <>
                        {" "}
                        | <strong>Text:</strong> "{step.text}"
                      </>
                    )}
                    {step.url && (
                      <>
                        {" "}
                        | <strong>URL:</strong> {step.url}
                      </>
                    )}
                    {step.description && (
                      <>
                        {" "}
                        | <strong>Description:</strong> {step.description}
                      </>
                    )}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-sm text-gray-500">
                No steps found in the returned actions.
              </li>
            )}
          </ul>
          <button
            onClick={handleInitiate}
            className="w-full mt-4 bg-green-500 text-white font-semibold py-2 rounded-lg hover:bg-green-700 transition"
          >
            Run Initiate
          </button>
        </div>
      )}
    </div>
  );
};

export default AgentInteraction;
