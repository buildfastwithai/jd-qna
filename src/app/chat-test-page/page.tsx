"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export default function ChatTestPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    // Add message to list
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: message }],
        }),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log("Response data:", data);
      
      // Handle different response formats
      if (Array.isArray(data) && data.length > 0) {
        // Array format response
        setMessages(prev => [...prev, data[0]]);
        setResponse(JSON.stringify(data, null, 2));
      } else if (data.role && data.content) {
        // Single message format
        setMessages(prev => [...prev, data]);
        setResponse(JSON.stringify(data, null, 2));
      } else {
        // Unknown format
        setResponse(JSON.stringify(data, null, 2));
      }
    } catch (err: any) {
      console.error("Error:", err);
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
      setMessage("");
    }
  };

  // Test the API on page load
  useEffect(() => {
    const testApi = async () => {
      try {
        const res = await fetch("/api/chat-test");
        const data = await res.json();
        console.log("API test result:", data);
      } catch (err) {
        console.error("API test error:", err);
      }
    };
    
    testApi();
  }, []);

  return (
    <div className="container mx-auto max-w-3xl py-12">
      <h1 className="text-2xl font-bold mb-6">Chat API Test Page</h1>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Chat Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md p-4 h-80 overflow-y-auto mb-4">
            {messages.length === 0 ? (
              <p className="text-center text-muted-foreground">No messages yet</p>
            ) : (
              messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`p-3 mb-2 rounded-lg ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground ml-auto max-w-[80%]' 
                      : 'bg-muted mr-auto max-w-[80%]'
                  }`}
                >
                  <p><strong>{msg.role}</strong>: {msg.content}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
        <CardFooter>
          <form onSubmit={handleSubmit} className="flex w-full gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1"
              disabled={loading}
            />
            <Button type="submit" disabled={loading}>
              {loading ? <Spinner size="sm" className="mr-2" /> : null}
              Send
            </Button>
          </form>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>API Response</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md p-4 min-h-24 bg-muted/10 overflow-auto">
            {error ? (
              <p className="text-red-500">{error}</p>
            ) : response ? (
              <pre className="whitespace-pre-wrap text-sm">{response}</pre>
            ) : (
              <p className="text-center text-muted-foreground">No response yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 