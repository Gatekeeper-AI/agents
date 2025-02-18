'use client'
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Copy, Download, ThumbsUp, ThumbsDown ,Eye } from 'lucide-react'
import { cn } from "@/lib/utils"
import { useEffect } from "react"
import { toast } from "@/components/ui/use-toast"

interface Message {
  role: "agent" | "user"
  content: string
  timestamp: string
}

export default function ChatInterface() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  
  useEffect(() => {
    setMessages([
      {
        role: "agent",
        content: "Ask me to do anything!",
        timestamp: new Date().toLocaleTimeString(),
      },
    ])
  }, [])

  const handleCopy = (content: string) => {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        toast({
          description: "Text copied to clipboard",
        })
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err)
        toast({
          variant: "destructive",
          description: "Failed to copy text",
        })
      })
  }

  const handleFeedback = (type: "up" | "down") => {
    toast({
      description: `Thanks for your ${type === "up" ? "positive" : "negative"} feedback!`,
    })
  }

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return

    // Add user message
    const userMessage = {
      role: "user" as const,
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    }
    setMessages(prev => [...prev, userMessage])
    setInput("")
    
    setIsLoading(true)
    
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/v1/query_agent?prompt=${encodeURIComponent(input)}&max_steps=20`)
      if (!response.ok) throw new Error('Failed to get response')
      
      const data = await response.json()

      // Check if the response contains an error
      if (data.error) {
        throw new Error(data.error)
      }

      // Extract the result from the response
      const agentContent = data.result || "Sorry, I couldn't find an answer."

      // Add agent message
      const agentMessage = {
        role: "agent" as const,
        content: agentContent,
        timestamp: new Date().toLocaleTimeString(),
      }
      setMessages(prev => [...prev, agentMessage])
    } catch (error) {
      console.error('API Error:', error)
      const errorMessage = {
        role: "agent" as const,
        content: error instanceof Error ? error.message : "Sorry, there was an error processing your request.",
        timestamp: new Date().toLocaleTimeString(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={cn("flex gap-2 max-w-[80%]", message.role === "user" && "ml-auto")}> 
              {message.role === "agent" && <div className="h-8 w-8 rounded-full bg-primary flex-shrink-0" />}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{message.role === "agent" ? "Agent" : "You"}</span>
                  <span className="text-sm text-muted-foreground">{message.timestamp}</span>
                </div>
                <div className={cn("p-3 rounded-lg", message.role === "agent" ? "bg-muted/50" : "bg-primary/10")}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === "agent" && (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(message.content)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleFeedback("up")}>
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleFeedback("down")}>
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {message.role === "user" && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIframeUrl("http://your-server-ip:6080/vnc.html")}> 
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {iframeUrl && (
        <div className="p-4 border-t">
          <h3 className="text-sm font-medium mb-2">Live Execution</h3>
          <iframe src={iframeUrl} width="100%" height="400px" className="border rounded-lg" />
        </div>
      )}

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea placeholder="Type your task here..." value={input} onChange={(e) => setInput(e.target.value)}
            className="min-h-[44px] max-h-32 resize-none" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit() } }} />
          <Button onClick={handleSubmit} disabled={isLoading} className="px-8">{isLoading ? "Processing..." : "Send"}</Button>
        </div>
      </div>
    </div>
  )
}
