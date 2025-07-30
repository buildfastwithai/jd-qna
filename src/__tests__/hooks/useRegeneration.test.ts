import { renderHook, waitFor } from "@testing-library/react";
import { useRegeneration } from "@/hooks/useRegeneration";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("useRegeneration", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe("regenerateQuestion", () => {
    it("should regenerate question successfully", async () => {
      const mockResponse = {
        success: true,
        question: { id: "new-question-1", question: "New question" },
        regeneration: { id: "regen-1", reason: "Too easy" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useRegeneration());

      expect(result.current.isRegenerating).toBe(false);

      const regenerationParams = {
        questionId: "question-1",
        reason: "TOO_EASY",
        userFeedback: "Need harder questions",
      };

      let regenerationResult: any;
      await waitFor(async () => {
        regenerationResult = await result.current.regenerateQuestion(
          regenerationParams
        );
      });

      expect(result.current.isRegenerating).toBe(false);
      expect(result.current.error).toBe(null);
      expect(regenerationResult).toEqual({
        question: mockResponse.question,
        regeneration: mockResponse.regeneration,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/questions/question-1/regenerate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-auth-token",
          },
          body: JSON.stringify({
            reason: "TOO_EASY",
            userFeedback: "Need harder questions",
          }),
        }
      );
    });

    it("should handle regeneration errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: "Regeneration failed" }),
      });

      const { result } = renderHook(() => useRegeneration());

      const regenerationParams = {
        questionId: "question-1",
        reason: "TOO_EASY",
        userFeedback: "Test feedback",
      };

      await expect(
        result.current.regenerateQuestion(regenerationParams)
      ).rejects.toThrow("Regeneration failed");

      expect(result.current.isRegenerating).toBe(false);
      expect(result.current.error).toBe("Regeneration failed");
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useRegeneration());

      const regenerationParams = {
        questionId: "question-1",
        reason: "TOO_EASY",
        userFeedback: "Test feedback",
      };

      await expect(
        result.current.regenerateQuestion(regenerationParams)
      ).rejects.toThrow("Network error");

      expect(result.current.error).toBe("Network error");
    });

    it("should set loading state during regeneration", async () => {
      // Create a promise that we can resolve manually
      let resolvePromise: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(fetchPromise);

      const { result } = renderHook(() => useRegeneration());

      const regenerationParams = {
        questionId: "question-1",
        reason: "TOO_EASY",
        userFeedback: "Test feedback",
      };

      // Start regeneration
      const regeneratePromise =
        result.current.regenerateQuestion(regenerationParams);

      // Check loading state
      await waitFor(() => {
        expect(result.current.isRegenerating).toBe(true);
      });

      // Resolve the fetch
      resolvePromise!({
        ok: true,
        json: async () => ({ success: true, question: {}, regeneration: {} }),
      });

      await regeneratePromise;

      expect(result.current.isRegenerating).toBe(false);
    });
  });

  describe("updateRegenerationFeedback", () => {
    it("should update regeneration feedback successfully", async () => {
      const mockResponse = {
        success: true,
        regeneration: { id: "regen-1", liked: "LIKED" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useRegeneration());

      const feedbackParams = {
        regenerationId: "regen-1",
        liked: "LIKED" as const,
        userFeedback: "Great improvement",
      };

      let updateResult: any;
      await waitFor(async () => {
        updateResult = await result.current.updateRegenerationFeedback(
          feedbackParams
        );
      });

      expect(result.current.isUpdatingFeedback).toBe(false);
      expect(result.current.error).toBe(null);
      expect(updateResult).toEqual(mockResponse.regeneration);

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/regenerations/regen-1/feedback",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-auth-token",
          },
          body: JSON.stringify({
            liked: "LIKED",
            userFeedback: "Great improvement",
          }),
        }
      );
    });

    it("should handle feedback update errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: "Update failed" }),
      });

      const { result } = renderHook(() => useRegeneration());

      const feedbackParams = {
        regenerationId: "regen-1",
        liked: "LIKED" as const,
      };

      await expect(
        result.current.updateRegenerationFeedback(feedbackParams)
      ).rejects.toThrow("Update failed");

      expect(result.current.error).toBe("Update failed");
    });

    it("should set loading state during feedback update", async () => {
      let resolvePromise: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(fetchPromise);

      const { result } = renderHook(() => useRegeneration());

      const feedbackParams = {
        regenerationId: "regen-1",
        liked: "LIKED" as const,
      };

      const updatePromise =
        result.current.updateRegenerationFeedback(feedbackParams);

      await waitFor(() => {
        expect(result.current.isUpdatingFeedback).toBe(true);
      });

      resolvePromise!({
        ok: true,
        json: async () => ({ success: true, regeneration: {} }),
      });

      await updatePromise;

      expect(result.current.isUpdatingFeedback).toBe(false);
    });
  });

  it("should handle non-Error exceptions", async () => {
    mockFetch.mockRejectedValueOnce("String error");

    const { result } = renderHook(() => useRegeneration());

    const params = {
      questionId: "q1",
      reason: "TOO_EASY",
      userFeedback: "test",
    };

    await expect(result.current.regenerateQuestion(params)).rejects.toThrow(
      "An error occurred"
    );

    expect(result.current.error).toBe("An error occurred");
  });
});
