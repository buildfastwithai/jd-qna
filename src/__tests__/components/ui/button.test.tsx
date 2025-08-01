/**
 * Tests for the Button component
 * These tests verify that the Button component renders correctly with different props and variants
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button Component", () => {
  /**
   * Test 1: Basic rendering
   * Should render a button with default props
   */
  it("should render a button with default props", () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole("button", { name: /click me/i });
    // Use standard Jest assertions for presence and class
    expect(button).not.toBeNull();
    expect(button.className).toContain("inline-flex"); // Should have default classes
  });

  /**
   * Test 2: Different button variants
   * Should apply correct CSS classes for different variants
   */
  it("should render different button variants correctly", () => {
    const { rerender } = render(<Button variant="default">Default</Button>);
    let button = screen.getByRole("button");
    expect(button.className).toContain("bg-primary");

    // Test destructive variant
    rerender(<Button variant="destructive">Destructive</Button>);
    button = screen.getByRole("button");
    expect(button.className).toContain("bg-destructive");

    // Test outline variant
    rerender(<Button variant="outline">Outline</Button>);
    button = screen.getByRole("button");
    expect(button.className).toContain("border");

    // Test ghost variant
    rerender(<Button variant="ghost">Ghost</Button>);
    button = screen.getByRole("button");
    expect(button.className).toContain("hover:bg-accent");
  });

  /**
   * Test 3: Different button sizes
   * Should apply correct size classes
   */
  it("should render different button sizes correctly", () => {
    const { rerender } = render(<Button size="default">Default Size</Button>);
    let button = screen.getByRole("button");
    expect(button.className).toContain("h-10");

    // Test small size
    rerender(<Button size="sm">Small</Button>);
    button = screen.getByRole("button");
    expect(button.className).toContain("h-9");

    // Test large size
    rerender(<Button size="lg">Large</Button>);
    button = screen.getByRole("button");
    expect(button.className).toContain("h-11");

    // Test icon size
    rerender(<Button size="icon">Icon</Button>);
    button = screen.getByRole("button");
    expect(button.className).toContain("h-10");
    expect(button.className).toContain("w-10");
  });

  /**
   * Test 4: Button click handling
   * Should call onClick handler when clicked
   */
  it("should handle click events", () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  /**
   * Test 5: Disabled button
   * Should not be clickable when disabled
   */
  it("should be disabled when disabled prop is true", () => {
    const handleClick = jest.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled Button
      </Button>
    );

    const button = screen.getByRole("button");
    expect(button.getAttribute("disabled")).toBe("disabled");
    expect(button.className).toContain("disabled:pointer-events-none");
    expect(button.className).toContain("disabled:opacity-50");

    // Should not call onClick when disabled
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  /**
   * Test 6: Custom className
   * Should merge custom className with default classes
   */
  it("should merge custom className with default classes", () => {
    render(<Button className="custom-class">Custom Button</Button>);

    const button = screen.getByRole("button");
    expect(button.className).toContain("custom-class");
    expect(button.className).toContain("inline-flex"); // Should still have default classes
  });

  /**
   * Test 7: Button as child (asChild prop)
   * Should render as a different element when asChild is true
   */
  it("should render as child element when asChild is true", () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );

    const link = screen.getByRole("link");
      expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe("/test");
    expect(link.className).toContain("inline-flex"); // Should still have button classes
  });

  /**
   * Test 8: Button with custom attributes
   * Should accept and apply custom HTML attributes
   */
  it("should accept custom HTML attributes", () => {
    render(
      <Button
        type="submit"
        data-testid="submit-button"
        aria-label="Submit form"
      >
        Submit
      </Button>
    );

    const button = screen.getByTestId("submit-button");
    expect(button.getAttribute("type")).toBe("submit");
    expect(button.getAttribute("aria-label")).toBe("Submit form");
  });
});
