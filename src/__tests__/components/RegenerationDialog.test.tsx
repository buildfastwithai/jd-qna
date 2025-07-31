import React from "react";
import { render, screen, fireEvent, waitFor } from "../utils/test-utils";
import { RegenerationDialog } from "@/components/RegenerationDialog";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("RegenerationDialog", () => {
  const mockQuestion = {
    id: "q1",
    question: "What is JavaScript?",
    answer: "JavaScript is a programming language",
    category: "Technical",
    difficulty: "Medium",
    skillName: "JavaScript",
    liked: "NONE",
  };

  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("should render regeneration dialog correctly", () => {
    render(
      <RegenerationDialog
        question={mockQuestion}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText(/Regenerate Question/i)).toBeInTheDocument();
    expect(screen.getByText("What is JavaScript?")).toBeInTheDocument();
    expect(screen.getByLabelText(/Feedback/i)).toBeInTheDocument();
  });

  it("should not render when closed", () => {
    render(
      <RegenerationDialog
        question={mockQuestion}
        isOpen={false}
        onClose={jest.fn()}
      />
    );

    expect(screen.queryByText(/Regenerate Question/i)).not.toBeInTheDocument();
  });

  it("should handle feedback input", () => {
    render(
      <RegenerationDialog
        question={mockQuestion}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    const feedbackTextarea = screen.getByLabelText(/Feedback/i);
    fireEvent.change(feedbackTextarea, {
      target: { value: "Make it more challenging" },
    });

    expect(feedbackTextarea).toHaveValue("Make it more challenging");
  });

  it("should handle regeneration submission", async () => {
    const mockOnRegenerate = jest.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        question: {
          ...mockQuestion,
          question: "What are the key features of JavaScript?",
          answer: "Updated answer with key features...",
        },
      }),
    });

    render(
      <RegenerationDialog
        question={mockQuestion}
        isOpen={true}
        onClose={jest.fn()}
        onRegenerate={mockOnRegenerate}
      />
    );

    const feedbackTextarea = screen.getByLabelText(/Feedback/i);
    const regenerateButton = screen.getByRole("button", {
      name: /Regenerate/i,
    });

    fireEvent.change(feedbackTextarea, {
      target: { value: "Make it more specific" },
    });
    fireEvent.click(regenerateButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/questions/${mockQuestion.id}/regenerate`,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: expect.stringContaining("Bearer"),
          },
          body: JSON.stringify({
            feedback: "Make it more specific",
          }),
        })
      );
    });

    expect(mockOnRegenerate).toHaveBeenCalled();
  });

  it("should handle regeneration without feedback", async () => {
    const mockOnRegenerate = jest.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        question: mockQuestion,
      }),
    });

    render(
      <RegenerationDialog
        question={mockQuestion}
        isOpen={true}
        onClose={jest.fn()}
        onRegenerate={mockOnRegenerate}
      />
    );

    const regenerateButton = screen.getByRole("button", {
      name: /Regenerate/i,
    });
    fireEvent.click(regenerateButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/questions/${mockQuestion.id}/regenerate`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            feedback: "",
          }),
        })
      );
    });
  });

  it("should handle API errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(
      <RegenerationDialog
        question={mockQuestion}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    const regenerateButton = screen.getByRole("button", {
      name: /Regenerate/i,
    });
    fireEvent.click(regenerateButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to regenerate question/i)
      ).toBeInTheDocument();
    });
  });

  it("should show loading state during regeneration", async () => {
    mockFetch.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(
      <RegenerationDialog
        question={mockQuestion}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    const regenerateButton = screen.getByRole("button", {
      name: /Regenerate/i,
    });
    fireEvent.click(regenerateButton);

    expect(screen.getByText(/Regenerating.../i)).toBeInTheDocument();
    expect(regenerateButton).toBeDisabled();
  });

  it("should handle dialog close", () => {
    const mockOnClose = jest.fn();

    render(
      <RegenerationDialog
        question={mockQuestion}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByLabelText(/Close/i);
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should handle cancel action", () => {
    const mockOnClose = jest.fn();

    render(
      <RegenerationDialog
        question={mockQuestion}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should handle keyboard shortcuts", () => {
    const mockOnClose = jest.fn();

    render(
      <RegenerationDialog
        question={mockQuestion}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    // Simulate Escape key press
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should display question metadata", () => {
    render(
      <RegenerationDialog
        question={mockQuestion}
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText("Technical")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
  });
});
