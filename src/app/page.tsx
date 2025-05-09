import { JDQnaForm } from "@/components/JDQnaForm";

export default function Home() {
  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-4xl font-bold text-center mb-2">
          JD Q&A Generator
        </h1>
        <p className="text-muted-foreground text-center max-w-2xl">
          Upload a job description PDF and get customized interview questions
          based on the role and requirements.
        </p>
      </div>
      <JDQnaForm />
    </div>
  );
}
