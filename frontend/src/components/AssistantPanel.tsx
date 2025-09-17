"use client";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Mic, MicOff, Volume2, VolumeX, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMessage, SystemContext } from "@/lib/gemini";
import { toast } from "sonner";

// Custom hook to handle client-side rendering
function useIsClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}

// Component to handle timestamp display without hydration issues
function TimeDisplay({ timestamp }: { timestamp: Date }) {
  const isClient = useIsClient();

  if (!isClient) {
    // Return a consistent format for SSR
    return <>{timestamp.toISOString().split('T')[1].split('.')[0]}</>;
  }

  // Return localized time on client
  return <>{timestamp.toLocaleTimeString()}</>;
}

interface AssistantPanelProps {
  context?: SystemContext;
  onRecommendationApply?: (recommendation: any) => void;
}

export default function AssistantPanel({ context, onRecommendationApply }: AssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your AI assistant for railway operations. I can help you analyze conflicts, optimize routes, and provide real-time insights. What would you like to know?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
        toast.error("Voice recognition failed. Please try again.");
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    // Initialize speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          context: context || getDefaultContext(),
          history: messages.slice(-5) // Send last 5 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      setMessages(prev => [...prev, data.message]);
      setIsOnline(true);

      // Auto-speak response if enabled
      if (isSpeaking && synthRef.current) {
        const utterance = new SpeechSynthesisUtterance(data.message.content);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        synthRef.current.speak(utterance);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      setIsOnline(false);

      // Fallback response
      const fallbackResponse: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `I understand you're asking about "${currentInput}". I'm currently in offline mode, but based on typical railway operations, I recommend checking the conflict heatmap and monitoring train delays. Please ensure your internet connection is stable for full AI capabilities.`,
        timestamp: new Date(),
        metadata: {
          recommendations: ['offline-mode'],
          actions: ['check-connection']
        }
      };

      setMessages(prev => [...prev, fallbackResponse]);
      toast.error("AI service temporarily unavailable. Using offline mode.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error("Voice recognition not supported in this browser");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const toggleSpeaking = () => {
    if (!synthRef.current) {
      toast.error("Text-to-speech not supported in this browser");
      return;
    }

    if (isSpeaking) {
      synthRef.current.cancel();
    }
    setIsSpeaking(!isSpeaking);
  };

  const getDefaultContext = (): SystemContext => ({
    activeTrains: 142,
    conflicts: [],
    energyEfficiency: 92.4,
    avgDelay: 4.2,
    throughput: 87.6,
    userRole: 'controller',
    currentView: 'dashboard'
  });

  const handleApplyRecommendation = (recommendation: any) => {
    if (onRecommendationApply) {
      onRecommendationApply(recommendation);
      toast.success("Recommendation applied successfully");
    }
  };

  return (
    <Card className="bg-neutral-900/50 border-neutral-800 h-[400px] flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot size={18} className="text-cyan-400" />
          AI Assistant
          <Badge
            variant={isOnline ? "secondary" : "destructive"}
            className="ml-auto"
          >
            {isOnline ? "Online" : "Offline"}
          </Badge>
          {context && (
            <Badge variant="outline" className="text-xs">
              {context.userRole}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-2 gap-2">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-2 p-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] p-3 rounded-lg text-sm",
                  message.role === "user"
                    ? "bg-cyan-600 text-white"
                    : "bg-neutral-800 text-neutral-100"
                )}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>

                {/* Action buttons for AI responses */}
                {message.role === "assistant" && message.metadata && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {message.metadata.recommendations && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs"
                        onClick={() => handleApplyRecommendation(message.metadata)}
                      >
                        <Sparkles size={10} className="mr-1" />
                        Apply
                      </Button>
                    )}
                    {message.metadata.charts && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs"
                      >
                        View Chart
                      </Button>
                    )}
                  </div>
                )}

                <div className="text-xs text-neutral-400 mt-1">
                  <TimeDisplay timestamp={message.timestamp} />
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-neutral-800 text-neutral-100 p-3 rounded-lg text-sm">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                  <span className="ml-2 text-neutral-400">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 p-2 bg-neutral-800/50 rounded-lg">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about conflicts, delays, or optimizations..."
            className="flex-1 bg-transparent text-sm text-white placeholder-neutral-400 outline-none"
            disabled={isLoading}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleListening}
            className={cn(
              "h-8 w-8",
              isListening ? "text-red-400 animate-pulse" : "text-neutral-400"
            )}
            disabled={isLoading}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSpeaking}
            className={cn(
              "h-8 w-8",
              isSpeaking ? "text-green-400" : "text-neutral-400"
            )}
          >
            {isSpeaking ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-8 w-8 text-cyan-400"
          >
            <Send size={16} />
          </Button>
        </div>

        {!isOnline && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 p-2 rounded">
            <AlertCircle size={12} />
            Limited functionality - Check internet connection
          </div>
        )}
      </CardContent>
    </Card>
  );
}
