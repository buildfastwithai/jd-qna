import { jest } from "@jest/globals";
import { createMocks } from "node-mocks-http";
import { NextRequest, NextResponse } from "next/server";

// Mock Prisma client
export const mockPrisma = {
  skillRecord: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  skill: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  question: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  feedback: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  regeneration: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  excelQuestionSet: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  excelQuestion: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  globalFeedback: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// Mock data factory functions
export const createMockSkillRecord = (overrides = {}) => ({
  id: "record-1",
  jobTitle: "Software Engineer",
  interviewLength: 60,
  rawJobDescription: "Test job description",
  reqId: null,
  userId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockSkill = (overrides = {}) => ({
  id: "skill-1",
  name: "JavaScript",
  level: "INTERMEDIATE",
  requirement: "MANDATORY",
  priority: 1,
  recordId: "record-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockQuestion = (overrides = {}) => ({
  id: "question-1",
  question: "What is JavaScript?",
  answer: "JavaScript is a programming language",
  category: "Technical",
  difficulty: "Medium",
  skillName: "JavaScript",
  skillId: "skill-1",
  recordId: "record-1",
  liked: "NONE",
  feedback: null,
  questionFormat: "Scenario",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockFeedback = (overrides = {}) => ({
  id: "feedback-1",
  content: "Great question",
  skillId: "skill-1",
  questionId: null,
  regenerationId: null,
  createdAt: new Date(),
  ...overrides,
});

export const createMockRegeneration = (overrides = {}) => ({
  id: "regeneration-1",
  reason: "Too easy",
  userFeedback: "Need harder questions",
  originalQuestionId: "question-1",
  newQuestionId: "question-2",
  skillId: "skill-1",
  liked: "NONE",
  createdAt: new Date(),
  ...overrides,
});

// Helper to create Next.js API request/response mocks
export const createApiMocks = (method: string, body?: any, query?: any) => {
  const { req, res } = createMocks({
    method,
    body,
    query,
  });
  return { req, res };
};

// Helper to mock Next.js route handlers
export const mockRouteHandler = (
  handler: Function,
  method: string,
  body?: any,
  params?: any
) => {
  const request = {
    method,
    json: async () => body || {},
    url: "http://localhost:3000/api/test",
    headers: new Headers(),
  } as any;

  return handler(request, { params: Promise.resolve(params || {}) });
};

// Reset all mocks
export const resetMocks = () => {
  Object.values(mockPrisma).forEach((model) => {
    Object.values(model).forEach((method) => {
      if (typeof method === "function" && "mockReset" in method) {
        method.mockReset();
      }
    });
  });
};
