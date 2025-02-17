"use client"

import { useState, useEffect, useRef } from "react"

export default function About() {
  const text = "Mechanize Labs: Pioneering the future of autonomous agent frameworks."

//   const maintext = `\n> Agents execute complex web tasks autonomously
// > Generate agents.json for structured automation
// > Compile actions.json to optimize future operations
// > Minimize costly LLM queries
// > Enable AI-driven web exploration and task completion`

  const [displayedText, setDisplayedText] = useState("")
  // const [showMainText, setShowMainText] = useState(false)
  const [showHowTo, setShowHowTo] = useState(false)
  const [showFeatures, setShowFeatures] = useState(false)
  const textRef = useRef("")

  useEffect(() => {
    let i = 0

    const interval = setInterval(() => {
      if (i < text.length) {
        textRef.current += text[i]
        setDisplayedText(textRef.current)
        i++
      } else {
        clearInterval(interval)
        setTimeout(() => {
          // setShowMainText(true)
          setTimeout(() => {
            setShowHowTo(true)
            setTimeout(() => setShowFeatures(true), 500)
          }, 500)
        }, 500)
      }
    }, 50)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="p-6 bg-black font-mono text-lg">
      <div className="border-2 p-2 rounded-lg mb-2">
        <p className="mt-2 whitespace-pre-wrap">
          {displayedText}
          {displayedText.length < text.length && <span className="animate-pulse">█</span>}
        </p>
      </div>

      {/* {showMainText && (
        <div className="mt-4 whitespace-pre-wrap animate-fadeIn border-2 border-green-400 p-4 rounded-lg">
          {maintext}
        </div>
      )} */}

      {showHowTo && (
        <div className="mt-6 animate-fadeIn border-2 p-4 rounded-lg">
          <h2 className="text-2xl font-bold">System Initialization</h2>
          <ul className="mt-2 list-none">
            <li className="flex items-center space-x-2">
              <span className="text-yellow-400">&gt;</span>
              <span>Acquire $TOKENS to access the agent network</span>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-yellow-400">&gt;</span>
              <span>Deploy agent and initiate web exploration sequence</span>
            </li>
          </ul>
        </div>
      )}

      {showFeatures && (
        <div className="mt-6 animate-fadeIn">
          <h2 className="text-2xl font-bold  mb-4">Core Functionalities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border-2  rounded-lg bg-black">
              <h3 className="text-xl font-semibold text-yellow-400">Agent Control</h3>
              <p>Grant agents full autonomy over web browser operations for task execution.</p>
            </div>
            <div className="p-4 border-2 rounded-lg bg-black">
              <h3 className="text-xl font-semibold text-yellow-400">Neural Task Memory</h3>
              <p>Upcoming: Agents will store and analyze past operations to optimize future actions.</p>
            </div>
            <div className="p-4 border-2  rounded-lg bg-black">
              <h3 className="text-xl font-semibold text-yellow-400">Web3 Integration</h3>
              <p>Upcoming: Seamless integration with decentralized networks for enhanced task diversity.</p>
            </div>
            <div className="p-4 border-2 rounded-lg bg-black">
              <h3 className="text-xl font-semibold text-yellow-400">Multi-Agent Swarm Execution</h3>
              <p>Upcoming: Deploy multiple agents in parallel for exponential task completion efficiency.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

