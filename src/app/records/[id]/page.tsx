import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SkillRecordEditor from "@/components/SkillRecordEditor";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Database, BarChart3, Menu, ArrowLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RecordPage({ params }: PageProps) {
  const { id } = await params;

  // Fetch the record with skills and questions
  const record = await prisma.skillRecord.findUnique({
    where: { id },
    include: {
      skills: {
        orderBy: { name: "asc" },
      },
      questions: {
        include: {
          skill: true,
        },
      },
    },
  });

  if (!record) {
    notFound();
  }

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
        <div className="bg-white shadow p-4 flex items-center">
          <Link href="/records" className="mr-2">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <h2 className="text-lg font-medium">Record Details</h2>
        </div>
        
        {/* Content area */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            <SkillRecordEditor record={record as any} />
          </div>
        </div>
      </div>
    </div>
  );
}
