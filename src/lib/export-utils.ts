import * as XLSX from "xlsx";
import { Parser } from "json2csv";

export interface ExportQuestion {
  slNo: number;
  skill: string;
  questionTitle: string;
  questionDescription: string;
  idealAnswer: string;
}

export function exportToExcel(
  questions: ExportQuestion[],
  filename: string = "interview-questions.xlsx"
): Buffer {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Convert questions to worksheet format
  const worksheetData = questions.map((q) => ({
    "Sl No": q.slNo,
    Skill: q.skill,
    "Question Title": q.questionTitle,
    "Question Description": q.questionDescription,
    "Ideal Answer": q.idealAnswer,
  }));

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);

  // Set column widths for better readability
  const columnWidths = [
    { wch: 8 }, // Sl No
    { wch: 20 }, // Skill
    { wch: 40 }, // Question Title
    { wch: 60 }, // Question Description
    { wch: 80 }, // Ideal Answer
  ];
  worksheet["!cols"] = columnWidths;

  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Interview Questions");

  // Generate Excel file buffer
  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });

  return excelBuffer;
}

export function exportToCSV(questions: ExportQuestion[]): string {
  const fields = [
    { label: "Sl No", value: "slNo" },
    { label: "Skill", value: "skill" },
    { label: "Question Title", value: "questionTitle" },
    { label: "Question Description", value: "questionDescription" },
    { label: "Ideal Answer", value: "idealAnswer" },
  ];

  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(questions);

  return csv;
}

export function createDownloadResponse(
  data: Buffer | string,
  filename: string,
  mimeType: string
) {
  const headers = new Headers();
  headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  headers.set("Content-Type", mimeType);

  return new Response(data, { headers });
}
