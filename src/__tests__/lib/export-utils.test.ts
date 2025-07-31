import {
  generatePDFReport,
  generateExcelReport,
  generateCSVReport,
  formatQuestionForExport,
} from "@/lib/export-utils";

// Mock @react-pdf/renderer
jest.mock("@react-pdf/renderer", () => ({
  pdf: jest.fn(() => ({
    toBuffer: jest.fn().mockResolvedValue(Buffer.from("pdf content")),
  })),
  Document: jest.fn(),
  Page: jest.fn(),
  Text: jest.fn(),
  View: jest.fn(),
  StyleSheet: {
    create: jest.fn(() => ({})),
  },
}));

describe("Export Utils", () => {
  const mockQuestions = [
    {
      id: "q1",
      question: "What is JavaScript?",
      answer: "JavaScript is a programming language",
      category: "Technical",
      difficulty: "Medium",
      skillName: "JavaScript",
      liked: "NONE",
    },
    {
      id: "q2",
      question: "Explain React hooks",
      answer: "React hooks are functions",
      category: "Technical",
      difficulty: "Hard",
      skillName: "React",
      liked: "LIKED",
    },
  ];

  const mockSkillRecord = {
    id: "record-1",
    jobTitle: "Software Developer",
    jobDescription: "Full stack developer position",
    interviewLength: 60,
    skills: [
      {
        id: "skill-1",
        name: "JavaScript",
        level: "INTERMEDIATE",
        category: "TECHNICAL",
        questions: mockQuestions,
      },
    ],
    questions: mockQuestions,
    createdAt: new Date().toISOString(),
  };

  describe("generatePDFReport", () => {
    it("should generate PDF report successfully", async () => {
      const result = await generatePDFReport(mockSkillRecord);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe("pdf content");
    });

    it("should handle PDF generation errors", async () => {
      const { pdf } = require("@react-pdf/renderer");
      pdf.mockImplementation(() => ({
        toBuffer: jest.fn().mockRejectedValue(new Error("PDF error")),
      }));

      await expect(generatePDFReport(mockSkillRecord)).rejects.toThrow(
        "PDF error"
      );
    });

    it("should handle empty questions", async () => {
      const emptyRecord = {
        ...mockSkillRecord,
        questions: [],
        skills: [],
      };

      const result = await generatePDFReport(emptyRecord);
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe("generateExcelReport", () => {
    it("should generate Excel report successfully", async () => {
      const result = await generateExcelReport(mockSkillRecord);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should include all question data", async () => {
      const result = await generateExcelReport(mockSkillRecord);

      // Excel buffer should contain question data
      expect(result).toBeDefined();
    });

    it("should handle multiple sheets", async () => {
      const result = await generateExcelReport(mockSkillRecord, {
        includeSkills: true,
        includeFeedback: true,
      });

      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe("generateCSVReport", () => {
    it("should generate CSV report successfully", () => {
      const result = generateCSVReport(mockQuestions);

      expect(typeof result).toBe("string");
      expect(result).toContain("Question,Answer,Category,Difficulty,Skill");
      expect(result).toContain("What is JavaScript?");
      expect(result).toContain("Explain React hooks");
    });

    it("should handle empty questions", () => {
      const result = generateCSVReport([]);

      expect(result).toBe("Question,Answer,Category,Difficulty,Skill,Status\n");
    });

    it("should escape CSV special characters", () => {
      const questionsWithSpecialChars = [
        {
          id: "q1",
          question: 'Question with "quotes" and, commas',
          answer: "Answer with\nnewlines",
          category: "Technical",
          difficulty: "Medium",
          skillName: "Test",
          liked: "NONE",
        },
      ];

      const result = generateCSVReport(questionsWithSpecialChars);

      expect(result).toContain('"Question with ""quotes"" and, commas"');
      expect(result).toContain('"Answer with\nnewlines"');
    });

    it("should include status information", () => {
      const result = generateCSVReport(mockQuestions);

      expect(result).toContain("None");
      expect(result).toContain("Liked");
    });
  });

  describe("formatQuestionForExport", () => {
    it("should format question correctly", () => {
      const formatted = formatQuestionForExport(mockQuestions[0]);

      expect(formatted.question).toBe("What is JavaScript?");
      expect(formatted.answer).toBe("JavaScript is a programming language");
      expect(formatted.category).toBe("Technical");
      expect(formatted.difficulty).toBe("Medium");
      expect(formatted.skill).toBe("JavaScript");
      expect(formatted.status).toBe("None");
    });

    it("should handle liked status", () => {
      const formatted = formatQuestionForExport(mockQuestions[1]);

      expect(formatted.status).toBe("Liked");
    });

    it("should handle disliked status", () => {
      const dislikedQuestion = {
        ...mockQuestions[0],
        liked: "DISLIKED",
      };

      const formatted = formatQuestionForExport(dislikedQuestion);

      expect(formatted.status).toBe("Disliked");
    });

    it("should handle missing fields", () => {
      const incompleteQuestion = {
        id: "q1",
        question: "Test question",
        answer: "Test answer",
      };

      const formatted = formatQuestionForExport(incompleteQuestion as any);

      expect(formatted.category).toBe("Unknown");
      expect(formatted.difficulty).toBe("Unknown");
      expect(formatted.skill).toBe("Unknown");
      expect(formatted.status).toBe("None");
    });

    it("should truncate long text", () => {
      const longQuestion = {
        ...mockQuestions[0],
        question: "x".repeat(500),
        answer: "y".repeat(1000),
      };

      const formatted = formatQuestionForExport(longQuestion, {
        maxLength: 100,
      });

      expect(formatted.question.length).toBeLessThanOrEqual(103); // 100 + "..."
      expect(formatted.answer.length).toBeLessThanOrEqual(103);
    });
  });

  describe("error handling", () => {
    it("should handle invalid data gracefully", async () => {
      const invalidRecord = null;

      await expect(generatePDFReport(invalidRecord as any)).rejects.toThrow();
    });

    it("should handle malformed questions", () => {
      const malformedQuestions = [
        null,
        undefined,
        {},
        { question: null, answer: undefined },
      ];

      malformedQuestions.forEach((question) => {
        expect(() => formatQuestionForExport(question as any)).not.toThrow();
      });
    });
  });
});
