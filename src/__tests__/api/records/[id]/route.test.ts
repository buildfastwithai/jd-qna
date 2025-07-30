import { GET } from "@/app/api/records/[id]/route";
import {
  mockPrisma,
  resetMocks,
  createMockSkillRecord,
  createMockSkill,
  createMockQuestion,
} from "../../utils/api-test-utils";
import "../../mocks/prisma";

describe("/api/records/[id]", () => {
  beforeEach(() => {
    resetMocks();
  });

  describe("GET", () => {
    it("should return record data successfully", async () => {
      const recordId = "record-1";
      const mockRecord = {
        ...createMockSkillRecord({ id: recordId }),
        skills: [
          createMockSkill({
            requirement: "MANDATORY",
            priority: 1,
          }),
          createMockSkill({
            id: "skill-2",
            name: "React",
            requirement: "OPTIONAL",
            priority: 2,
          }),
        ],
        questions: [
          {
            ...createMockQuestion(),
            skill: createMockSkill(),
          },
        ],
      };

      mockPrisma.skillRecord.findUnique.mockResolvedValue(mockRecord);

      const request = new Request("http://localhost:3000/api/records/record-1");
      const response = await GET(request, {
        params: Promise.resolve({ id: recordId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.record).toEqual(mockRecord);

      // Verify the query was called with correct parameters
      expect(mockPrisma.skillRecord.findUnique).toHaveBeenCalledWith({
        where: { id: recordId },
        include: {
          skills: {
            orderBy: [{ requirement: "asc" }, { priority: "asc" }],
          },
          questions: {
            include: {
              skill: true,
            },
          },
        },
      });
    });

    it("should return 400 when record ID is missing", async () => {
      const request = new Request("http://localhost:3000/api/records/");
      const response = await GET(request, {
        params: Promise.resolve({ id: "" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Record ID is required");
    });

    it("should return 404 when record is not found", async () => {
      const recordId = "non-existent-record";
      mockPrisma.skillRecord.findUnique.mockResolvedValue(null);

      const request = new Request(
        "http://localhost:3000/api/records/non-existent-record"
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: recordId }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Record not found");
    });

    it("should handle database errors", async () => {
      const recordId = "record-1";
      mockPrisma.skillRecord.findUnique.mockRejectedValue(
        new Error("Database error")
      );

      const request = new Request("http://localhost:3000/api/records/record-1");
      const response = await GET(request, {
        params: Promise.resolve({ id: recordId }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Database error");
    });

    it("should order skills by requirement and priority", async () => {
      const recordId = "record-1";
      mockPrisma.skillRecord.findUnique.mockResolvedValue(null);

      const request = new Request("http://localhost:3000/api/records/record-1");
      await GET(request, { params: Promise.resolve({ id: recordId }) });

      const callArgs = mockPrisma.skillRecord.findUnique.mock.calls[0][0];
      expect(callArgs.include.skills.orderBy).toEqual([
        { requirement: "asc" },
        { priority: "asc" },
      ]);
    });
  });
});
