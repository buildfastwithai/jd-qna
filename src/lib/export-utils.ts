import * as XLSX from "xlsx";
import { Parser } from "json2csv";

export interface ExportQuestion {
  slNo: number;
  skill: string;
  questionTitle: string;
  questionDescription: string;
  idealAnswer: string;
  tags: string;
  coding: string; // "Yes" or "No"
}

// Helper function to format ideal answer with proper HTML formatting for CKEditor
function formatIdealAnswer(answer: string): string {
  if (!answer) return "";

  // Ensure input is a string and trim whitespace
  let formatted = String(answer).trim();

  // Convert newlines to <br> tags
  formatted = formatted.replace(/\r?\n/g, "<br>");

  // Convert bullet points (- or *) to HTML list format
  // Handle both single bullets and consecutive bullets
  const lines = formatted.split("<br>");
  let inList = false;
  const processedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const isBulletPoint = /^\s*[-*]\s+/.test(line);

    if (isBulletPoint) {
      const content = line.replace(/^\s*[-*]\s+/, "").trim();
      if (!inList) {
        processedLines.push("<ul>");
        inList = true;
      }
      processedLines.push(`<li>${content}</li>`);
    } else {
      if (inList) {
        processedLines.push("</ul>");
        inList = false;
      }
      if (line) {
        processedLines.push(line);
      }
    }
  }

  // Close any open list
  if (inList) {
    processedLines.push("</ul>");
  }

  formatted = processedLines.join("<br>");

  // Clean up extra <br> tags around lists
  formatted = formatted.replace(/<br><ul>/g, "<ul>");
  formatted = formatted.replace(/<\/ul><br>/g, "</ul>");

  // Wrap code blocks with pre/code tags (triple backticks)
  formatted = formatted.replace(/```([^`]+)```/g, (match, code) => {
    // Escape newlines within code blocks using \\n
    const escapedCode = code.replace(/\r?\n/g, "\\n");
    return `<pre><code>${escapedCode}</code></pre>`;
  });

  // Handle inline code (single backticks)
  formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Ensure the result is safe for database storage
  return formatted.replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); // Remove control characters
}

// Helper function to extract question title (first sentence)
function extractQuestionTitle(question: string): string {
  if (!question) return "";

  // Ensure input is a string
  const questionStr = String(question).trim();

  // Find the first sentence (ending with ., ?, or !)
  const firstSentenceMatch = questionStr.match(/^[^.!?]*[.!?]/);
  if (firstSentenceMatch) {
    return firstSentenceMatch[0].trim();
  }

  // If no sentence ending found, take first 100 characters
  return questionStr.length > 100
    ? questionStr.substring(0, 100) + "..."
    : questionStr;
}

// Helper function to format coding field as Yes/No string
function formatCodingField(coding: boolean | string): string {
  if (typeof coding === "boolean") {
    return coding ? "Yes" : "No";
  }
  if (typeof coding === "string") {
    const normalized = coding.toLowerCase().trim();
    if (normalized === "true" || normalized === "yes" || normalized === "1") {
      return "Yes";
    }
    if (normalized === "false" || normalized === "no" || normalized === "0") {
      return "No";
    }
  }
  return "No"; // Default to No if unclear
}

export function exportToExcel(
  questions: ExportQuestion[],
  filename: string = "interview-questions.xlsx"
): Buffer {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Convert questions to worksheet format with proper formatting
  const worksheetData = questions.map((q) => ({
    "Sl No": String(q.slNo), // Ensure string format
    Skill: String(q.skill || "").trim(),
    "Question Title": extractQuestionTitle(q.questionDescription),
    "Question Description": String(q.questionDescription || "").trim(),
    "Ideal Answer": formatIdealAnswer(q.idealAnswer),
    Tags: String(q.tags || "").trim(),
    Coding: formatCodingField(q.coding),
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
    { wch: 30 }, // Tags
    { wch: 10 }, // Coding
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
    { label: "Sl No", value: (row: ExportQuestion) => String(row.slNo) },
    {
      label: "Skill",
      value: (row: ExportQuestion) => String(row.skill || "").trim(),
    },
    {
      label: "Question Title",
      value: (row: ExportQuestion) =>
        extractQuestionTitle(row.questionDescription),
    },
    {
      label: "Question Description",
      value: (row: ExportQuestion) =>
        String(row.questionDescription || "").trim(),
    },
    {
      label: "Ideal Answer",
      value: (row: ExportQuestion) => formatIdealAnswer(row.idealAnswer),
    },
    {
      label: "Tags",
      value: (row: ExportQuestion) => String(row.tags || "").trim(),
    },
    {
      label: "Coding",
      value: (row: ExportQuestion) => formatCodingField(row.coding),
    },
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
