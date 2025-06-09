import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ArrowLeft, ChevronRight, Database, BarChart3, Menu } from "lucide-react";

export default async function RecordsPage() {
  // Fetch all records
  const records = await prisma.skillRecord.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      _count: {
        select: {
          skills: true,
          questions: true,
        },
      },
    },
  });

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
          
          <Button variant="ghost" className="w-full justify-start text-white hover:bg-gray-800 bg-gray-800" asChild>
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
          <div className="flex items-center">
            <Button variant="ghost" asChild className="mr-2">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
              </Link>
            </Button>
            <h2 className="text-lg font-medium">Job Skill Records</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            View and manage your saved job skill records
          </p>
        </div>
        
        {/* Content area */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {records.length === 0 ? (
              <div className="col-span-full text-center py-8 bg-white rounded-lg shadow p-6">
                <p className="text-muted-foreground mb-4">No job records found.</p>
                <Button asChild>
                  <Link href="/">Create Your First Record</Link>
                </Button>
              </div>
            ) : (
              records.map((record: any) => (
                <Card key={record.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="truncate">{record.jobTitle}</CardTitle>
                    <CardDescription>
                      Created{" "}
                      {formatDistanceToNow(new Date(record.createdAt), {
                        addSuffix: true,
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm mb-4">
                      <div>
                        <span className="font-medium">{record._count.skills}</span>{" "}
                        Skills
                      </div>
                      <div>
                        <span className="font-medium">
                          {record._count.questions}
                        </span>{" "}
                        Questions
                      </div>
                    </div>
                    <Button asChild className="w-full mt-2">
                      <Link href={`/records/${record.id}`}>
                        View Details <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
