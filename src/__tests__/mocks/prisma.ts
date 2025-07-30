import { jest } from "@jest/globals";
import { mockPrisma } from "../utils/api-test-utils";

// Mock the Prisma client
jest.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

export { mockPrisma as prisma };
