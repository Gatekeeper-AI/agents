import { useState, useEffect } from "react";

export default function About() {
  const text = " Gatekeeper is an agentic AI framework allow agents to get stuff done.";
  const maintext = `\n- Agents autonomously explore and complete web tasks
- Generate an agents.json file for structured automation
- Save actions.json to quickly reuse past actions
- Reduce reliance on expensive LLM queries
- Enable seamless AI-driven site navigation and monetization

Features:
- Give agent control of web browser
- Coming Soon: Task Memory
- Coming Soon: Agent Web3 Integration
- Coming Soon: Parallel Execution `;

  const [displayedText, setDisplayedText] = useState("_");
  const [showMainText, setShowMainText] = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayedText((prev) => prev.slice(0, -1) + text[i] + "_");
        i++;
      } else {
        clearInterval(interval);
        setDisplayedText(text);
        setTimeout(() => setShowMainText(true), 500);
      }
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 bg-black font-mono text-lg">
      <p className="mt-2 whitespace-pre-wrap">{displayedText}</p>
      {showMainText && <p className="mt-4 whitespace-pre-wrap">{maintext}</p>}
    </div>
  );
}
