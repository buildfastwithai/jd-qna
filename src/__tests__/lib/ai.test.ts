import { generateQuestionsFromJD, generateQuestionForSkill } from "@/lib/ai";

// Mock OpenAI
jest.mock("openai", () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  })),
}));

describe("AI Module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("generateQuestionsFromJD", () => {
    it("should generate questions from job description", async () => {
      const mockOpenAI = require("openai").OpenAI;
      const mockCreate = mockOpenAI().chat.completions.create;

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                skills: [
                  {
                    name: "JavaScript",
                    level: "INTERMEDIATE",
                    category: "TECHNICAL",
                    priority: 1,
                    requirement: "MANDATORY",
                    numQuestions: 3,
                  },
                ],
                questions: [
                  {
                    question: "What is JavaScript?",
                    answer: "JavaScript is a programming language",
                    category: "Technical",
                    difficulty: "Medium",
                    skillName: "JavaScript",
                  },
                ],
              }),
            },
          },
        ],
      });

      const result = await generateQuestionsFromJD(
        "Software Developer",
        "We need someone with JavaScript experience",
        60
      );

      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].name).toBe("JavaScript");
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].question).toBe("What is JavaScript?");
    });

    it("should handle OpenAI API errors", async () => {
      const mockOpenAI = require("openai").OpenAI;
      const mockCreate = mockOpenAI().chat.completions.create;

      mockCreate.mockRejectedValue(new Error("OpenAI API Error"));

      await expect(
        generateQuestionsFromJD("Developer", "Job description", 60)
      ).rejects.toThrow("OpenAI API Error");
    });

    it("should handle invalid JSON response", async () => {
      const mockOpenAI = require("openai").OpenAI;
      const mockCreate = mockOpenAI().chat.completions.create;

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "invalid json response",
            },
          },
        ],
      });

      await expect(
        generateQuestionsFromJD("Developer", "Job description", 60)
      ).rejects.toThrow();
    });

    it("should validate interview length", async () => {
      await expect(
        generateQuestionsFromJD("Developer", "Job description", 0)
      ).rejects.toThrow("Invalid interview length");

      await expect(
        generateQuestionsFromJD("Developer", "Job description", 200)
      ).rejects.toThrow("Invalid interview length");
    });

    it("should validate job description length", async () => {
      const shortDescription = "Short";
      const longDescription = "x".repeat(10001);

      await expect(
        generateQuestionsFromJD("Developer", shortDescription, 60)
      ).rejects.toThrow("Job description too short");

      await expect(
        generateQuestionsFromJD("Developer", longDescription, 60)
      ).rejects.toThrow("Job description too long");
    });
  });

  describe("generateQuestionForSkill", () => {
    it("should generate question for specific skill", async () => {
      const mockOpenAI = require("openai").OpenAI;
      const mockCreate = mockOpenAI().chat.completions.create;

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                question: "Explain React hooks",
                answer: "React hooks are functions that let you use state",
                category: "Technical",
                difficulty: "Medium",
              }),
            },
          },
        ],
      });

      const skill = {
        name: "React",
        level: "INTERMEDIATE",
        category: "TECHNICAL",
      };

      const result = await generateQuestionForSkill(skill, "Scenario");

      expect(result.question).toBe("Explain React hooks");
      expect(result.answer).toBe(
        "React hooks are functions that let you use state"
      );
      expect(result.category).toBe("Technical");
      expect(result.difficulty).toBe("Medium");
    });

    it("should handle different question formats", async () => {
      const formats = ["Open-ended", "Scenario", "Coding", "Case Study"];

      for (const format of formats) {
        const mockOpenAI = require("openai").OpenAI;
        const mockCreate = mockOpenAI().chat.completions.create;

        mockCreate.mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  question: `${format} question`,
                  answer: `${format} answer`,
                  category: "Technical",
                  difficulty: "Medium",
                }),
              },
            },
          ],
        });

        const skill = {
          name: "JavaScript",
          level: "INTERMEDIATE",
          category: "TECHNICAL",
        };

        const result = await generateQuestionForSkill(skill, format);
        expect(result.question).toBe(`${format} question`);
      }
    });

    it("should handle feedback for regeneration", async () => {
      const mockOpenAI = require("openai").OpenAI;
      const mockCreate = mockOpenAI().chat.completions.create;

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                question: "Improved question based on feedback",
                answer: "Improved answer",
                category: "Technical",
                difficulty: "Hard",
              }),
            },
          },
        ],
      });

      const skill = {
        name: "JavaScript",
        level: "ADVANCED",
        category: "TECHNICAL",
      };

      const feedback = "Make it more challenging";
      const result = await generateQuestionForSkill(
        skill,
        "Scenario",
        feedback
      );

      expect(result.question).toBe("Improved question based on feedback");
      expect(result.difficulty).toBe("Hard");
    });

    it("should handle different skill levels", async () => {
      const levels = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"];

      for (const level of levels) {
        const mockOpenAI = require("openai").OpenAI;
        const mockCreate = mockOpenAI().chat.completions.create;

        mockCreate.mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  question: `${level} level question`,
                  answer: `${level} level answer`,
                  category: "Technical",
                  difficulty:
                    level === "BEGINNER"
                      ? "Easy"
                      : level === "EXPERT"
                      ? "Hard"
                      : "Medium",
                }),
              },
            },
          ],
        });

        const skill = {
          name: "JavaScript",
          level,
          category: "TECHNICAL",
        };

        const result = await generateQuestionForSkill(skill, "Open-ended");
        expect(result.question).toBe(`${level} level question`);
      }
    });
  });
});
