import Link from "next/link";
import { JDQnaForm } from "@/components/JDQnaForm";
import { Button } from "@/components/ui/button";
import { Database } from "lucide-react";
import Chathome from "@/components/chatformate/Chat-home";
export default function Home() {
  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex flex-col items-center mb-8">
        <div className="w-full flex justify-end mb-4">
          <Button variant="outline" asChild>
            <Link href="/records">
              <Database className="h-4 w-4 mr-2" />
              View Saved Records
            </Link>
          </Button>
        </div>
        <h1 className="text-4xl font-bold text-center mb-2">
          JD Q&A Generator
        </h1>
        <p className="text-muted-foreground text-center max-w-2xl">
          Upload a job description PDF and get customized interview questions
          based on the role and requirements.
        </p>
      </div>
      <div className="flex flex-col md:flex-row gap-4 w-full">
        <div className="w-full md:w-1/2">
          <JDQnaForm />
        </div>
        <div className="w-full md:w-1/2">
          <Chathome />
        </div>
      </div>


    </div>
  );
}
