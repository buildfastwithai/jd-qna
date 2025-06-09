import Link from "next/link";
import { JDQnaForm } from "@/components/JDQnaForm";
import { Button } from "@/components/ui/button";
import { Database, BarChart3, Menu } from "lucide-react";

export default function Home() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white p-4 flex flex-col">
        <h1 className="text-xl font-bold mb-6">JD Q&A Generator</h1>
        
        <div className="space-y-2">
          <Button variant="ghost" className="w-full justify-start text-white" asChild>
            <Link href="/">
              <span className="flex items-center">
                <Menu className="h-4 w-4 mr-2" />
                New Chat
              </span>
            </Link>
          </Button>
          
          <Button variant="ghost" className="w-full justify-start text-white" asChild>
            <Link href="/dashboard">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          
          <Button variant="ghost" className="w-full justify-start text-white" asChild>
            <Link href="/records">
              <Database className="h-4 w-4 mr-2" />
              Saved Records
            </Link>
          </Button>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white shadow p-4">
          <h2 className="text-lg font-medium">Job Description Analysis</h2>
        </div>
        
        {/* Chat area */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <p className="text-gray-800">
                Welcome! Upload a job description PDF and get customized interview questions
                based on the role and requirements.
              </p>
            </div>
            
            {/* Form component styled as a chat interface */}
            <JDQnaForm />
          </div>
        </div>
      </div>
    </div>
  );
}
