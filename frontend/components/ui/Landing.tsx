"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function TerminalLanding() {
  const [text, setText] = useState("ENTER");
  const [isScrambling, setIsScrambling] = useState(false);

  const scrambleText = () => {
    if (isScrambling) return;

    setIsScrambling(true);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$%^&*()";
    let iterations = 0;
    const interval = setInterval(() => {
      setText((prev) =>
        prev
          .split("")
          .map((_, i) =>
            i < iterations ? "ENTER"[i] : chars[Math.floor(Math.random() * chars.length)]
          )
          .join("")
      );

      if (iterations >= "ENTER".length) {
        clearInterval(interval);
        setTimeout(() => {
          setText("ENTER");
          setIsScrambling(false);
        }, 200);
      }
      iterations++;
    }, 50);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-black text-green-400 font-mono">
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-4xl mb-6"
        >
          Welcome to the Terminal
        </motion.div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={scrambleText}
          className="px-6 py-3 border-2 border-green-400 text-green-400 hover:bg-green-400 hover:text-black transition-colors duration-300 text-3xl"
        >
          {text}
        </motion.button>
      </div>
    </div>
  );
}
