/**
 * Tests for authentication utilities
 * These tests verify that API authentication works correctly with different scenarios
 */

import { verifyApiAuth } from "@/lib/auth";

// Create a mock NextRequest class for testing
class MockNextRequest {
  constructor(url, options = {}) {
    this.url = url;
    this.headers = new Map();

    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        this.headers.set(key, value);
      });
    }
  }

  get(name) {
    return this.headers.get(name);
  }
}

// Mock the environment variable
const originalEnv = process.env;

describe("Auth Utils", () => {
  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe("verifyApiAuth function", () => {
    /**
     * Test 1: Missing AUTH_TOKEN environment variable
     * Should return error response when AUTH_TOKEN is not configured
     */
    it("should return error when AUTH_TOKEN is not configured", () => {
      delete process.env.AUTH_TOKEN;

      const request = new MockNextRequest("http://localhost:3000/api/test");
      const result = verifyApiAuth(request);

      expect(result).not.toBeNull();
      // Extract response data for testing
      expect(result!.status).toBe(500);
    });

    /**
     * Test 2: Missing Authorization header
     * Should return 401 error when no Authorization header is provided
     */
    it("should return 401 when Authorization header is missing", () => {
      process.env.AUTH_TOKEN = "test-token";

      const request = new MockNextRequest("http://localhost:3000/api/test");
      const result = verifyApiAuth(request);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });

    /**
     * Test 3: Invalid Authorization header format
     * Should return 401 error when Authorization header doesn't start with 'Bearer '
     */
    it("should return 401 when Authorization header format is invalid", () => {
      process.env.AUTH_TOKEN = "test-token";

      const request = new MockNextRequest("http://localhost:3000/api/test", {
        headers: { Authorization: "InvalidFormat test-token" },
      });
      const result = verifyApiAuth(request);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(401);
    });

    /**
     * Test 4: Invalid token
     * Should return 403 error when provided token doesn't match the configured token
     */
    it("should return 403 when token is invalid", () => {
      process.env.AUTH_TOKEN = "correct-token";

      const request = new MockNextRequest("http://localhost:3000/api/test", {
        headers: { Authorization: "Bearer wrong-token" },
      });
      const result = verifyApiAuth(request);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(403);
    });

    /**
     * Test 5: Valid authentication
     * Should return null (success) when valid token is provided
     */
    it("should return null when authentication is successful", () => {
      process.env.AUTH_TOKEN = "correct-token";

      const request = new MockNextRequest("http://localhost:3000/api/test", {
        headers: { Authorization: "Bearer correct-token" },
      });
      const result = verifyApiAuth(request);

      expect(result).toBeNull(); // null means authentication successful
    });
  });
});
