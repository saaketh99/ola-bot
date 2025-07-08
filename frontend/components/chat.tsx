"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
// @ts-ignore
import { saveAs } from "file-saver";

interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: number;
  buttons?: Array<{ title: string; payload: string }>;
  image?: string;
}

interface RasaResponse {
  text: string;
  buttons?: Array<{ title: string; payload: string }>;
  image?: string;
  attachment?: any;
}

// LocalStorage helpers
const LOCAL_STORAGE_KEY = "rasa_chat_history";

const saveMessagesToLocalStorage = (messages: ChatMessage[]) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(messages));
};

const loadMessagesFromLocalStorage = (): ChatMessage[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  try {
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

function ClientTime({ timestamp }: { timestamp: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <>{new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
  );
}

function renderMessageText(text: string) {
  const downloadRegex = /<a [^>]*href=["']([^"']+)["'][^>]*download[^>]*>([\s\S]*?)<\/a>/i;
  const match = text.match(downloadRegex);
  if (match) return null;
  return <span>{text}</span>;
}

export function Chat() {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const stored = loadMessagesFromLocalStorage();
    return stored.length > 0
      ? stored
      : [
          {
            id: "1",
            text: "Hello! I'm your order management assistant. I can help you track orders, check delivery status, find orders by customer, date, location, and much more. How can I assist you today?",
            sender: "bot",
            timestamp: 0,
          },
        ];
  });

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (mounted) {
      setMessages((msgs) =>
        msgs.map((msg) =>
          msg.timestamp === 0 ? { ...msg, timestamp: Date.now() } : msg
        )
      );
    }
  }, [mounted]);

  useEffect(() => {
    if (mounted) {
      saveMessagesToLocalStorage(messages);
    }
  }, [messages, mounted]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: messageText,
      sender: "user",
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          sender: "user_" + Date.now(),
        }),
      });

      const data = await response.json();

      if (data.success && data.responses) {
        const botMessages: ChatMessage[] = data.responses
          .filter((resp: RasaResponse) => resp.text && resp.text.trim())
          .map((resp: RasaResponse, index: number) => ({
            id: (Date.now() + index).toString(),
            text: resp.text,
            sender: "bot" as const,
            timestamp: Date.now(),
            buttons: resp.buttons,
            image: resp.image,
          }));

        if (botMessages.length > 0) {
          setMessages((prev) => [...prev, ...botMessages]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              text: "I received your message but don't have a response right now. Please try rephrasing your question.",
              sender: "bot",
              timestamp: Date.now(),
            },
          ]);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            text: data.responses?.[0]?.text || "Sorry, I encountered an error. Please try again.",
            sender: "bot",
            timestamp: Date.now(),
          },
        ]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: "Sorry, I'm having trouble connecting. Please check if the Rasa server is running and try again.",
          sender: "bot",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleButtonClick = (payload: string) => {
    sendMessage(payload);
  };

  const extractPincodeOrders = (text: string) => {
    const regex = /Pincode:\s*(\d+)\s*→\s*(\d+) orders/g;
    const result = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      result.push({ Pincode: match[1], Orders: parseInt(match[2], 10) });
    }
    return result;
  };

  const extractOrderDetails = (text: string) => {
    const fullRegex = /- Order ID: ([^|]+) \| Status: ([^|]+) \| To: ([^|]+) \| Created: ([^\n]+)/g;
    const simpleRegex = /- Order ID: ([^|]+) \| Status: ([^\n]+)/g;
    const result = [];
    let match;
    while ((match = fullRegex.exec(text)) !== null) {
      result.push({
        "Order ID": match[1].trim(),
        "Status": match[2].trim(),
        "To": match[3].trim(),
        "Created": match[4].trim(),
      });
    }
    if (result.length === 0) {
      while ((match = simpleRegex.exec(text)) !== null) {
        result.push({
          "Order ID": match[1].trim(),
          "Status": match[2].trim(),
        });
      }
    }
    return result;
  };

  const handleDownloadExcel = () => {
    const lastBotMsg = [...messages]
      .reverse()
      .find((m) => m.sender === "bot" && (/Pincode:/i.test(m.text) || /- Order ID:/i.test(m.text)));
    if (!lastBotMsg) return;

    let data: any[] = extractPincodeOrders(lastBotMsg.text);
    let sheetName = "Pincodes";
    if (!data.length) {
      data = extractOrderDetails(lastBotMsg.text);
      sheetName = "Orders";
    }
    if (!data.length) return;

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const file = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(file, sheetName === "Pincodes" ? "top_pincodes.xlsx" : "pending_orders.xlsx");
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat interface...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-4xl h-[80vh] flex flex-col shadow-xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6" />
            Order Management Assistant
          </CardTitle>
          <p className="text-blue-100 text-sm">Ask me about orders, delivery status, customer information, and more</p>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 p-0">
          <ScrollArea className="h-full min-h-0 p-4" ref={scrollAreaRef}>
            <div className="space-y-4 bg-white rounded-lg p-4">
              {messages
                .filter((message) => !(message.sender === "bot" && (!message.text || !message.text.trim())))
                .map((message, idx) => (
                  <div key={message.id} className={`flex gap-3 ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                    {message.sender === "bot" && (
                      <Avatar className="h-8 w-8 bg-blue-100">
                        <AvatarFallback>
                          <Bot className="h-4 w-4 text-blue-600" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`max-w-[70%] rounded-lg px-4 py-2 ${message.sender === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                      <div className="whitespace-pre-wrap break-words">{renderMessageText(message.text)}</div>

                      {message.buttons && message.buttons.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {message.buttons.map((button, index) => (
                            <Button
                              key={index}
                              variant="outline"
                              size="sm"
                              className="mr-2 mb-1 bg-transparent"
                              onClick={() => handleButtonClick(button.payload)}
                            >
                              {button.title}
                            </Button>
                          ))}
                        </div>
                      )}

                      {message.image && (
                        <div className="mt-2">
                          <img src={message.image || "/placeholder.svg"} alt="Bot response" className="max-w-full h-auto rounded" />
                        </div>
                      )}

                      {(() => {
                        const isLastBotMsgWithData =
                          message.sender === "bot" &&
                          (/Pincode:/i.test(message.text) || /- Order ID:/i.test(message.text)) &&
                          messages.slice(idx + 1).every(
                            (m) => !(m.sender === "bot" && (/Pincode:/i.test(m.text) || /- Order ID:/i.test(m.text)))
                          );
                        if (!isLastBotMsgWithData) return null;
                        return (
                          <button
                            onClick={handleDownloadExcel}
                            style={{ marginTop: 12, padding: "10px 20px", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
                          >
                            📥 Download Excel
                          </button>
                        );
                      })()}

                      <div className={`text-xs mt-1 ${message.sender === "user" ? "text-blue-200" : "text-gray-500"}`}>
                        <ClientTime timestamp={message.timestamp} />
                      </div>
                    </div>

                    {message.sender === "user" && (
                      <Avatar className="h-8 w-8 bg-blue-600">
                        <AvatarFallback>
                          <User className="h-4 w-4 text-white" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="h-8 w-8 bg-blue-100">
                    <AvatarFallback>
                      <Bot className="h-4 w-4 text-blue-600" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-gray-600">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="border-t bg-gray-50">
          <form onSubmit={handleSubmit} className="flex w-full gap-2" suppressHydrationWarning>
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about orders, delivery status, customers..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()} className="bg-blue-600 hover:bg-blue-700">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
