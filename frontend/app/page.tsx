"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"

export default function Landing() {
  const router = useRouter()
  const canvasRef = useRef(null)
  const [text, setText] = useState("ENTER")
  const [isScrambling, setIsScrambling] = useState(false)
  const mouseRef = useRef({ x: 0, y: 0 })

  const scrambleText = () => {
    if (isScrambling) return

    setIsScrambling(true)
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$%^&*()"
    let iterations = 0
    const interval = setInterval(() => {
      setText((prev) =>
        prev
          .split("")
          .map((_, i) => (i < iterations ? "ENTER"[i] : chars[Math.floor(Math.random() * chars.length)]))
          .join(""),
      )

      if (iterations >= "ENTER".length) {
        clearInterval(interval)
        setTimeout(() => {
          setText("ENTER")
          setIsScrambling(false)
          router.push("/chat")
        }, 200)
      }
      iterations++
    }, 50)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const chars = "01"
    const fontSize = 14
    let particles = []
    let fadeOpacity = 0
    const targetOpacity = 0.9

    // Define human silhouette points and curves
    function getSilhouetteShape() {
      const centerX = canvas.width * 0.5 // Moved to the center
      const scale = canvas.height * 0.8

      return {
        // Head
        head: {
          x: centerX,
          y: canvas.height * 0.15,
          radius: scale * 0.06,
        },
        // Body parts defined as curves
        bodyParts: [
          // Neck
          {
            startX: centerX - scale * 0.02,
            startY: canvas.height * 0.2,
            endX: centerX + scale * 0.02,
            endY: canvas.height * 0.25,
            width: scale * 0.04,
          },
          // Torso (left side)
          {
            startX: centerX - scale * 0.08,
            startY: canvas.height * 0.25,
            endX: centerX - scale * 0.1,
            endY: canvas.height * 0.55,
            width: scale * 0.08,
            controlX: centerX - scale * 0.12,
            controlY: canvas.height * 0.4,
          },
          // Torso (right side)
          {
            startX: centerX + scale * 0.08,
            startY: canvas.height * 0.25,
            endX: centerX + scale * 0.1,
            endY: canvas.height * 0.55,
            width: scale * 0.08,
            controlX: centerX + scale * 0.12,
            controlY: canvas.height * 0.4,
          },
          // Left leg
          {
            startX: centerX - scale * 0.08,
            startY: canvas.height * 0.55,
            endX: centerX - scale * 0.1,
            endY: canvas.height * 0.9,
            width: scale * 0.06,
          },
          // Right leg
          {
            startX: centerX + scale * 0.08,
            startY: canvas.height * 0.55,
            endX: centerX + scale * 0.1,
            endY: canvas.height * 0.9,
            width: scale * 0.06,
          },
          // Left arm (static part)
          {
            startX: centerX - scale * 0.08,
            startY: canvas.height * 0.28,
            endX: centerX - scale * 0.12,
            endY: canvas.height * 0.4,
            width: scale * 0.05,
          },
          // Right arm (static)
          {
            startX: centerX + scale * 0.08,
            startY: canvas.height * 0.28,
            endX: centerX + scale * 0.12,
            endY: canvas.height * 0.45,
            width: scale * 0.05,
          },
        ],
      }
    }

    function initParticles() {
      particles = []
      const particleCount = 5000 // Increased from 3000 to 5000 for better definition

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          char: chars[Math.floor(Math.random() * chars.length)],
          opacity: Math.random(),
          velocity: {
            x: (Math.random() - 0.5) * 0.3, // Reduced velocity for more stable appearance
            y: (Math.random() - 0.5) * 0.3,
          },
          lifetime: 150 + Math.random() * 150, // Increased lifetime for more stable appearance
        })
      }
    }

    function isInSilhouette(x, y) {
      const shape = getSilhouetteShape()

      // Check head
      const distanceToHead = Math.sqrt(Math.pow(x - shape.head.x, 2) + Math.pow(y - shape.head.y, 2))
      if (distanceToHead < shape.head.radius) return true

      // Check body parts
      for (const part of shape.bodyParts) {
        if (part.controlX && part.controlY) {
          // For curved parts (torso)
          const distance = distanceToBezierCurve(
            x,
            y,
            part.startX,
            part.startY,
            part.controlX,
            part.controlY,
            part.endX,
            part.endY,
          )
          if (distance < part.width / 2) return true
        } else {
          // For straight parts
          const distance = distanceToLineSegment(x, y, part.startX, part.startY, part.endX, part.endY)
          if (distance < part.width / 2) return true
        }
      }

      // Check dynamic left arm
      const leftShoulderX = shape.bodyParts[5].startX
      const leftShoulderY = shape.bodyParts[5].startY
      const leftArmLength = Math.min(
        Math.sqrt(Math.pow(mouseRef.current.x - leftShoulderX, 2) + Math.pow(mouseRef.current.y - leftShoulderY, 2)),
        canvas.height * 0.3,
      )
      const leftArmEndX =
        leftShoulderX +
        (mouseRef.current.x - leftShoulderX) *
          (leftArmLength /
            Math.sqrt(
              Math.pow(mouseRef.current.x - leftShoulderX, 2) + Math.pow(mouseRef.current.y - leftShoulderY, 2),
            ))
      const leftArmEndY =
        leftShoulderY +
        (mouseRef.current.y - leftShoulderY) *
          (leftArmLength /
            Math.sqrt(
              Math.pow(mouseRef.current.x - leftShoulderX, 2) + Math.pow(mouseRef.current.y - leftShoulderY, 2),
            ))
      const leftArmDistance = distanceToLineSegment(x, y, leftShoulderX, leftShoulderY, leftArmEndX, leftArmEndY)
      if (leftArmDistance < shape.bodyParts[5].width / 2) return true

      return false // If none of the above conditions are met
    }

    function distanceToLineSegment(x, y, x1, y1, x2, y2) {
      const A = x - x1
      const B = y - y1
      const C = x2 - x1
      const D = y2 - y1

      const dot = A * C + B * D
      const len_sq = C * C + D * D
      let param = -1

      if (len_sq !== 0) param = dot / len_sq

      let xx, yy

      if (param < 0) {
        xx = x1
        yy = y1
      } else if (param > 1) {
        xx = x2
        yy = y2
      } else {
        xx = x1 + param * C
        yy = y1 + param * D
      }

      const dx = x - xx
      const dy = y - yy
      return Math.sqrt(dx * dx + dy * dy)
    }

    function distanceToBezierCurve(x, y, x1, y1, x2, y2, x3, y3) {
      const steps = 100
      let minDistance = Number.POSITIVE_INFINITY

      for (let i = 0; i <= steps; i++) {
        const t = i / steps
        const bx = Math.pow(1 - t, 2) * x1 + 2 * (1 - t) * t * x2 + Math.pow(t, 2) * x3
        const by = Math.pow(1 - t, 2) * y1 + 2 * (1 - t) * t * y2 + Math.pow(t, 2) * y3
        const distance = Math.sqrt(Math.pow(x - bx, 2) + Math.pow(y - by, 2))
        if (distance < minDistance) {
          minDistance = distance
        }
      }

      return minDistance
    }

    function animate() {
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Smooth fade in/out
      fadeOpacity += (targetOpacity - fadeOpacity) * 0.05

      particles.forEach((particle, index) => {
        if (isInSilhouette(particle.x, particle.y)) {
          ctx.fillStyle = `rgba(136, 255, 136, ${particle.opacity * fadeOpacity})`
          ctx.font = `${fontSize}px monospace`
          ctx.fillText(particle.char, particle.x, particle.y)

          // Particle movement and lifetime
          particle.x += particle.velocity.x
          particle.y += particle.velocity.y
          particle.lifetime--

          // Glitch effect
          if (Math.random() < 0.1) {
            particle.char = chars[Math.floor(Math.random() * chars.length)]
            particle.opacity = Math.random() * 2 + 0.5
          }

          // Reset particle if it dies or moves out of silhouette
          if (particle.lifetime <= 0 || !isInSilhouette(particle.x, particle.y)) {
            // Find a random point within the silhouette
            let newX, newY
            do {
              newX = Math.random() * canvas.width
              newY = Math.random() * canvas.height
            } while (!isInSilhouette(newX, newY))

            particles[index] = {
              x: newX,
              y: newY,
              char: chars[Math.floor(Math.random() * chars.length)],
              opacity: Math.random(),
              velocity: {
                x: (Math.random() - 0.5) * 0.3, // Reduced velocity for more stable appearance
                y: (Math.random() - 0.5) * 0.3,
              },
              lifetime: 150 + Math.random() * 150, // Increased lifetime for more stable appearance
            }
          }
        }
      })

      requestAnimationFrame(animate)
    }

    function handleMouseMove(e) {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }

    function handleResize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initParticles()
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("resize", handleResize)
    initParticles()
    animate()

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
      <div className="absolute top-1/2 left-1/4 transform -translate-y-1/2">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={scrambleText}
          className="px-6 py-3 border-2 border-[#88FF88] text-[#88FF88] hover:bg-[#88FF88] hover:text-black transition-colors duration-300 text-3xl"
        >
          {text}
        </motion.button>
      </div>
    </div>
  )
}

