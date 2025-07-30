import { cn } from "@/lib/utils";

describe("utils", () => {
  describe("cn", () => {
    it("should combine class names correctly", () => {
      const result = cn("class1", "class2");
      expect(result).toBe("class1 class2");
    });

    it("should handle conditional classes", () => {
      const result = cn("class1", true && "class2", false && "class3");
      expect(result).toBe("class1 class2");
    });

    it("should handle undefined and null values", () => {
      const result = cn("class1", undefined, null, "class2");
      expect(result).toBe("class1 class2");
    });

    it("should merge Tailwind CSS classes correctly", () => {
      // This test verifies that conflicting Tailwind classes are properly merged
      const result = cn("px-2 py-1", "px-4");
      expect(result).toBe("py-1 px-4");
    });

    it("should handle empty input", () => {
      const result = cn();
      expect(result).toBe("");
    });

    it("should handle arrays of classes", () => {
      const result = cn(["class1", "class2"], "class3");
      expect(result).toBe("class1 class2 class3");
    });

    it("should handle objects with boolean values", () => {
      const result = cn({
        class1: true,
        class2: false,
        class3: true,
      });
      expect(result).toBe("class1 class3");
    });

    it("should handle complex combinations", () => {
      const isActive = true;
      const isDisabled = false;
      const size = "large";

      const result = cn(
        "base-class",
        {
          "active-class": isActive,
          "disabled-class": isDisabled,
        },
        size === "large" && "large-class",
        ["array-class1", "array-class2"]
      );

      expect(result).toBe(
        "base-class active-class large-class array-class1 array-class2"
      );
    });

    it("should merge conflicting Tailwind modifiers", () => {
      const result = cn("hover:bg-red-500", "hover:bg-blue-500");
      expect(result).toBe("hover:bg-blue-500");
    });

    it("should preserve non-conflicting Tailwind classes", () => {
      const result = cn("text-lg font-bold", "text-blue-500 font-semibold");
      expect(result).toBe("text-lg text-blue-500 font-semibold");
    });
  });
});
