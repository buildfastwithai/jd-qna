import { renderHook, waitFor } from "@testing-library/react";
import { useDashboard } from "@/hooks/useDashboard";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("useDashboard", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("should fetch dashboard data successfully", async () => {
    const mockData = {
      success: true,
      skillRecords: [],
      statistics: {
        totalRecords: 5,
        totalSkills: 10,
        totalQuestions: 25,
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useDashboard());

    // Initially loading should be true
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);

    // Wait for the fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBe(null);
    expect(mockFetch).toHaveBeenCalledWith("/api/dashboard", {
      method: "GET",
      headers: {
        Authorization: "Bearer test-auth-token",
      },
    });
  });

  it("should handle fetch errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe("Network error");
  });

  it("should handle HTTP errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe("Failed to fetch dashboard data");
  });

  it("should refetch data when refetch is called", async () => {
    const mockData = { success: true, data: "test" };
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Clear mock to verify refetch calls
    mockFetch.mockClear();

    // Call refetch
    result.current.refetch();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  it("should handle non-Error exceptions", async () => {
    mockFetch.mockRejectedValueOnce("String error");

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("An error occurred");
  });

  it("should reset error state on successful refetch", async () => {
    // First call fails
    mockFetch.mockRejectedValueOnce(new Error("First error"));

    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(result.current.error).toBe("First error");
    });

    // Second call succeeds
    const mockData = { success: true };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    result.current.refetch();

    await waitFor(() => {
      expect(result.current.error).toBe(null);
      expect(result.current.data).toEqual(mockData);
    });
  });
});
