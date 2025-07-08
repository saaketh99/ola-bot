"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Send, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: number;
  buttons?: Array<{ title: string; payload: string }>;
  image?: string;
}

interface ChatSession {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: number;
}

const SESSION_STORAGE_KEY = "rasa_chat_sessions";

export default function Chat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      const parsed: ChatSession[] = JSON.parse(stored);
      setSessions(parsed);
      if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
    } else {
      createNewSession();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      name: `Chat ${sessions.length + 1}`,
      messages: [
        {
          id: "1",
          text: "Hello! I'm your order management assistant...",
          sender: "bot",
          timestamp: Date.now(),
        },
      ],
      createdAt: Date.now(),
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
  };

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  const updateCurrentSessionMessages = (newMessages: ChatMessage[]) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === currentSessionId ? { ...session, messages: newMessages } : session
      )
    );
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading || !currentSessionId) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      sender: "user",
      timestamp: Date.now(),
    };
    const updatedMessages = [...messages, userMessage];
    updateCurrentSessionMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sender: "user" + Date.now() }),
      });
      const data = await response.json();
      const botMessages = (data.responses || []).map((resp: any, i: number) => ({
        id: (Date.now() + i).toString(),
        text: resp.text,
        sender: "bot",
        timestamp: Date.now(),
        buttons: resp.buttons,
        image: resp.image,
      }));
      updateCurrentSessionMessages([...updatedMessages, ...botMessages]);
    } catch (err) {
      updateCurrentSessionMessages([
        ...updatedMessages,
        {
          id: Date.now().toString(),
          text: "Sorry, I couldn't connect to Rasa server.",
          sender: "bot",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-gray-100 p-4 overflow-y-auto border-r">
        <Button onClick={createNewSession} className="w-full mb-4">
          + New Chat
        </Button>
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => setCurrentSessionId(session.id)}
            className={`cursor-pointer p-2 rounded mb-2 ${
              session.id === currentSessionId ? "bg-blue-200" : "hover:bg-gray-200"
            }`}
          >
            {session.name}
          </div>
        ))}
      </div>

      {/* Chat Panel */}
      <div className="flex-1 flex flex-col">
        <Card className="w-full h-full flex flex-col">
          <CardHeader className="bg-blue-600 text-white">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-6 w-6" /> Order Assistant
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4" ref={scrollAreaRef}>
            <ScrollArea className="h-full">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} mb-2`}
                >
                  <div
                    className={`px-4 py-2 rounded-lg max-w-[70%] ${
                      msg.sender === "user" ? "bg-blue-600 text-white" : "bg-gray-200"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start mb-2">
                  <div className="px-4 py-2 rounded-lg bg-gray-200 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}
            </ScrollArea>
          </CardContent>

          <CardFooter className="border-t p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="flex gap-2 w-full"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1"
              />
              <Button type="submit" disabled={!input.trim() || isLoading}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
