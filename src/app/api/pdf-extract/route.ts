import { NextResponse } from "next/server";
import { getLogger } from "@/lib/logger";
import { extractTextFromPDF } from "@/lib/pdf-extraction";

const logger = getLogger("pdf-extract-api");

export async function POST(request: Request) {
  const body = await request.json();
  const { resumeUrl } = body;

  if (!resumeUrl) {
    return NextResponse.json(
      { success: false, error: "Resume URL is required" },
      { status: 400 }
    );
  }

  try {
    logger.info(`Processing PDF from URL: ${resumeUrl}`);

    // Use our improved PDF extraction utility
    const fullText = await extractTextFromPDF(resumeUrl);

    return NextResponse.json({
      success: true,
      content: fullText,
    });
  } catch (error: any) {
    logger.error("Error processing PDF:", error);

    let errorMessage = "An error occurred while processing the PDF";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
