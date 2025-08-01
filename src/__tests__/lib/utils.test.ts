/**
 * Tests for utility functions
 * These tests check basic functionality of common utility functions used throughout the app
 */

import { cn } from "@/lib/utils";

describe("Utils", () => {
  describe("cn function", () => {
    /**
     * Test 1: Basic className merging
     * The cn function should merge multiple CSS class names correctly
     */
    it("should merge class names correctly", () => {
      const result = cn("btn", "btn-primary", "rounded");
      expect(result).toContain("btn");
      expect(result).toContain("btn-primary");
      expect(result).toContain("rounded");
    });

    /**
     * Test 2: Handle conditional classes
     * The cn function should handle conditional classes and filter out falsy values
     */
    it("should handle conditional classes", () => {
      const isActive = true;
      const isDisabled = false;
      const result = cn("btn", isActive && "active", isDisabled && "disabled");

      expect(result).toContain("btn");
      expect(result).toContain("active");
      expect(result).not.toContain("disabled");
    });

    /**
     * Test 3: Handle empty and undefined values
     * The cn function should gracefully handle empty strings, null, and undefined values
     */
    it("should handle empty and undefined values", () => {
      const result = cn("btn", "", null, undefined, "primary");
      expect(result).toContain("btn");
      expect(result).toContain("primary");
      expect(result).toBeTruthy();
    });

    /**
     * Test 4: Handle conflicting Tailwind classes
     * The cn function should properly merge conflicting Tailwind CSS classes
     */
    it("should handle conflicting tailwind classes", () => {
      const result = cn("px-2 py-1", "px-4");
      // Should prioritize the last class (px-4) over conflicting ones (px-2)
      expect(result).toContain("px-4");
      expect(result).toContain("py-1");
    });
  });
});
