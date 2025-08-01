/**
 * Tests for the useIsMobile hook
 * These tests verify that the mobile detection hook works correctly with different screen sizes
 */

import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "@/hooks/use-mobile";

// Mock window.matchMedia for testing
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

describe("useIsMobile Hook", () => {
  // Clean up after each test
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Test 1: Desktop screen size detection
   * Should return false when screen width is >= 768px (desktop)
   */
  it("should return false for desktop screen sizes", () => {
    // Mock desktop screen width
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    mockMatchMedia(false); // Desktop doesn't match mobile media query

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  /**
   * Test 2: Mobile screen size detection
   * Should return true when screen width is < 768px (mobile)
   */
  it("should return true for mobile screen sizes", () => {
    // Mock mobile screen width
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 375,
    });

    mockMatchMedia(true); // Mobile matches mobile media query

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  /**
   * Test 3: Tablet screen size detection (edge case)
   * Should return false for tablet screen size (768px exactly)
   */
  it("should return false for tablet screen sizes", () => {
    // Mock tablet screen width (exactly at breakpoint)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 768,
    });

    mockMatchMedia(false); // 768px should not match mobile (< 768px)

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  /**
   * Test 4: Window resize event handling
   * Should update when window is resized from desktop to mobile
   */
  it("should update when window is resized", () => {
    // Start with desktop
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    let matchesCallback: () => void;
    const mockAddEventListener = jest.fn((event, callback) => {
      if (event === "change") {
        matchesCallback = callback;
      }
    });

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        media: "(max-width: 767px)",
        addEventListener: mockAddEventListener,
        removeEventListener: jest.fn(),
      })),
    });

    const { result } = renderHook(() => useIsMobile());

    // Initially should be false (desktop)
    expect(result.current).toBe(false);

    // Simulate resize to mobile
    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      });
      // Trigger the resize event
      if (matchesCallback) {
        matchesCallback();
      }
    });

    // Mock doesn't actually update the hook state, so this test is checking the behavior
    expect(result.current).toBe(true);
  });

  /**
   * Test 5: Hook cleanup
   * Should properly clean up event listeners when component unmounts
   */
  it("should clean up event listeners on unmount", () => {
    const mockRemoveEventListener = jest.fn();

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        media: "(max-width: 767px)",
        addEventListener: jest.fn(),
        removeEventListener: mockRemoveEventListener,
      })),
    });

    const { unmount } = renderHook(() => useIsMobile());

    // Unmount the hook
    unmount();

    // Should have called removeEventListener
    expect(mockRemoveEventListener).toHaveBeenCalled();
  });
});
