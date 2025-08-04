"use client";
import Link from "next/link";
import { JDQnaForm } from "@/components/JDQnaForm";
import { Button } from "@/components/ui/button";
import { Database, BarChart3 } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function JDQnaFormPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const reqId = searchParams.get("req_id") as string;
  const userId = searchParams.get("user_id") as string;
  const parentUrl = searchParams.get("parentUrl") as string;
  const page = searchParams.get("page") as "skill" | "questions";
  const tab = searchParams.get("page") as "skill" | "questions";

  const [isCheckingRecord, setIsCheckingRecord] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Check for existing record and navigate if found
  useEffect(() => {
    const findAndNavigateToRecord = async () => {
      // Only search if both reqId and userId are present
      if (reqId && userId) {
        setIsCheckingRecord(true);
        try {
          const response = await fetch(
            `/api/find-record?req_id=${reqId}&user_id=${userId}`
          );
          const data = await response.json();

          if (data.success && data.record) {
            // Determine the active tab based on the page parameter
            const activeTab = page === "questions" ? "questions" : "skills";

            // Build the navigation URL with parentUrl and tab
            const currentUrl = window.location.href;
            const params = new URLSearchParams();

            if (parentUrl) {
              params.set("parentUrl", parentUrl);
            } else {
              params.set("parentUrl", currentUrl);
            }

            params.set("tab", activeTab);

            const navigationUrl = `/records/${
              data.record.id
            }?${params.toString()}`;

            console.log(navigationUrl);

            // Navigate to the record page
            router.push(navigationUrl);
            return; // Don't show form, navigate directly
          }
        } catch (error) {
          console.error("Error finding record:", error);
          // Continue with normal flow if there's an error
        }
        setIsCheckingRecord(false);
      }

      // Show form if no reqId/userId or if record not found
      setShowForm(true);
    };

    findAndNavigateToRecord();
  }, [reqId, userId, parentUrl, page, router]);

  // Show loading state while checking for existing record
  if (isCheckingRecord) {
    return (
      <div className="container mx-auto py-10 px-4">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">
            Checking for existing record...
          </h2>
          <p className="text-muted-foreground text-center">
            Please wait while we search for your existing interview questions.
          </p>
        </div>
      </div>
    );
  }

  // Only show form if we're not checking and form should be shown
  if (!showForm) {
    return null;
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex flex-col items-center mb-8">
        <div className="w-full flex justify-end mb-4 space-x-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
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
      <JDQnaForm reqId={reqId} userId={userId} />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <JDQnaFormPage />
    </Suspense>
  );
}
