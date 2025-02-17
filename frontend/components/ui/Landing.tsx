"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function Landing() {
  const router = useRouter();
  const canvasRef = useRef(null);
  const [text, setText] = useState("ENTER");
  const [isScrambling, setIsScrambling] = useState(false);
  const mouseRef = useRef({ x: 0, y: 0 });

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
          router.push("/chat");
        }, 200);
      }
      iterations++;
    }, 50);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = "01";
    const fontSize = 14;
    let particles = [];
    let fadeOpacity = 0;
    const targetOpacity = 0.9;

    function getSilhouetteShape() {
      const centerX = canvas.width * 0.5;
      const scale = canvas.height * 0.8; 

      return {
        head: { x: centerX, y: canvas.height * 0.18, radius: scale * 0.09 },
        bodyParts: [
          { startX: centerX - scale * 0.13, startY: canvas.height * 0.27, endX: centerX + scale * 0.13, endY: canvas.height * 0.4, width: scale * 0.26 }, // Shoulders
          { startX: centerX - scale * 0.08, startY: canvas.height * 0.4, endX: centerX + scale * 0.08, endY: canvas.height * 0.65, width: scale * 0.16 }, // Torso
          { startX: centerX - scale * 0.07, startY: canvas.height * 0.65, endX: centerX - scale * 0.09, endY: canvas.height * 0.9, width: scale * 0.1 }, // Left Leg
          { startX: centerX + scale * 0.07, startY: canvas.height * 0.65, endX: centerX + scale * 0.09, endY: canvas.height * 0.9, width: scale * 0.1 }, // Right Leg
          { startX: centerX - scale * 0.15, startY: canvas.height * 0.32, endX: centerX - scale * 0.25, endY: canvas.height * 0.55, width: scale * 0.08 } // Left Arm (better positioned)
        ]
      };
    }

    function initParticles() {
      particles = [];
      const particleCount = 3500;
      
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          char: chars[Math.floor(Math.random() * chars.length)],
          opacity: Math.random(),
          velocity: { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5 },
          lifetime: 100 + Math.random() * 100
        });
      }
    }

    function isInSilhouette(x, y) {
      const shape = getSilhouetteShape();

      const distanceToHead = Math.sqrt((x - shape.head.x) ** 2 + (y - shape.head.y) ** 2);
      if (distanceToHead < shape.head.radius) return true;

      for (const part of shape.bodyParts) {
        const distance = distanceToLineSegment(x, y, part.startX, part.startY, part.endX, part.endY);
        if (distance < part.width / 2) return true;
      }

      const shoulderX = shape.bodyParts[4].startX;
      const shoulderY = shape.bodyParts[4].startY;
      const armDistance = distanceToLineSegment(x, y, shoulderX, shoulderY, mouseRef.current.x, mouseRef.current.y);
      return armDistance < shape.bodyParts[4].width / 2;
    }

    function distanceToLineSegment(x, y, x1, y1, x2, y2) {
      const A = x - x1, B = y - y1, C = x2 - x1, D = y2 - y1;
      const dot = A * C + B * D;
      const len_sq = C * C + D * D;
      let param = len_sq !== 0 ? dot / len_sq : -1;
      let xx = param < 0 ? x1 : param > 1 ? x2 : x1 + param * C;
      let yy = param < 0 ? y1 : param > 1 ? y2 : y1 + param * D;
      return Math.sqrt((x - xx) ** 2 + (y - yy) ** 2);
    }

    function animate() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      fadeOpacity += (targetOpacity - fadeOpacity) * 0.05;

      particles.forEach((particle, index) => {
        if (isInSilhouette(particle.x, particle.y)) {
          ctx.fillStyle = `rgba(136, 255, 136, ${particle.opacity * fadeOpacity})`;
          ctx.font = `${fontSize}px monospace`;
          ctx.fillText(particle.char, particle.x, particle.y);

          particle.x += particle.velocity.x;
          particle.y += particle.velocity.y;
          particle.lifetime--;

          if (Math.random() < 0.1) {
            particle.char = chars[Math.floor(Math.random() * chars.length)];
            particle.opacity = Math.random() * 2 + 0.5;
          }

          if (particle.lifetime <= 0 || !isInSilhouette(particle.x, particle.y)) {
            let newX, newY;
            do {
              newX = Math.random() * canvas.width;
              newY = Math.random() * canvas.height;
            } while (!isInSilhouette(newX, newY));

            particles[index] = { x: newX, y: newY, char: chars[Math.floor(Math.random() * chars.length)], opacity: Math.random(), velocity: { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5 }, lifetime: 100 + Math.random() * 100 };
          }
        }
      });

      requestAnimationFrame(animate);
    }

    window.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    });

    initParticles();
    animate();
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
    </div>
  );
}
