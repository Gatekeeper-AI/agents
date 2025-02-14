import { useState, useEffect } from "react";

export default function About() {
  const text = "Gatekeeper is an agentic AI framework that enables websites to monetize access through intelligent automation.";
  const maintext = `\n- Agents autonomously explore and complete web tasks\n- Generate an agents.json file for structured automation\n- Save actions.json to quickly reuse past actions\n- Reduce reliance on expensive LLM queries\n- Enable seamless AI-driven site navigation and monetization`;
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
