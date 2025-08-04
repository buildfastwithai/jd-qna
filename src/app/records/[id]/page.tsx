import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SkillRecordEditor from "@/components/SkillRecordEditor";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RecordPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tab } = await searchParams;

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
    <div className="py-8 mx-auto px-4">
      <SkillRecordEditor record={record as any} defaultTab={tab as string} />
    </div>
  );
}
