import React from "react";
import { render, screen, fireEvent, waitFor } from "../../utils/test-utils";
import { QuestionLikeButtons } from "@/components/ui/question-like-buttons";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("QuestionLikeButtons", () => {
  const mockQuestion = {
    id: "q1",
    question: "What is JavaScript?",
    answer: "Programming language",
    category: "Technical",
    difficulty: "Medium",
    skillName: "JavaScript",
    liked: "NONE",
  };

  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("should render like buttons correctly", () => {
    render(<QuestionLikeButtons question={mockQuestion} />);

    expect(screen.getByLabelText(/like question/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dislike question/i)).toBeInTheDocument();
  });

  it("should show liked state", () => {
    const likedQuestion = { ...mockQuestion, liked: "LIKED" };
    render(<QuestionLikeButtons question={likedQuestion} />);

    const likeButton = screen.getByLabelText(/like question/i);
    expect(likeButton).toHaveClass("liked");
  });

  it("should show disliked state", () => {
    const dislikedQuestion = { ...mockQuestion, liked: "DISLIKED" };
    render(<QuestionLikeButtons question={dislikedQuestion} />);

    const dislikeButton = screen.getByLabelText(/dislike question/i);
    expect(dislikeButton).toHaveClass("disliked");
  });

  it("should handle like action", async () => {
    const mockOnStatusChange = jest.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(
      <QuestionLikeButtons
        question={mockQuestion}
        onStatusChange={mockOnStatusChange}
      />
    );

    const likeButton = screen.getByLabelText(/like question/i);
    fireEvent.click(likeButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/questions/${mockQuestion.id}/like`,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: expect.stringContaining("Bearer"),
          },
          body: JSON.stringify({ liked: "LIKED" }),
        })
      );
    });

    expect(mockOnStatusChange).toHaveBeenCalledWith("LIKED");
  });

  it("should handle dislike action", async () => {
    const mockOnStatusChange = jest.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(
      <QuestionLikeButtons
        question={mockQuestion}
        onStatusChange={mockOnStatusChange}
      />
    );

    const dislikeButton = screen.getByLabelText(/dislike question/i);
    fireEvent.click(dislikeButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/questions/${mockQuestion.id}/like`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ liked: "DISLIKED" }),
        })
      );
    });

    expect(mockOnStatusChange).toHaveBeenCalledWith("DISLIKED");
  });

  it("should handle toggle from liked to none", async () => {
    const likedQuestion = { ...mockQuestion, liked: "LIKED" };
    const mockOnStatusChange = jest.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(
      <QuestionLikeButtons
        question={likedQuestion}
        onStatusChange={mockOnStatusChange}
      />
    );

    const likeButton = screen.getByLabelText(/like question/i);
    fireEvent.click(likeButton);

    await waitFor(() => {
      expect(mockOnStatusChange).toHaveBeenCalledWith("NONE");
    });
  });

  it("should handle API errors gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(<QuestionLikeButtons question={mockQuestion} />);

    const likeButton = screen.getByLabelText(/like question/i);
    fireEvent.click(likeButton);

    await waitFor(() => {
      expect(screen.getByText(/Failed to update status/i)).toBeInTheDocument();
    });
  });

  it("should show loading state", async () => {
    mockFetch.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<QuestionLikeButtons question={mockQuestion} />);

    const likeButton = screen.getByLabelText(/like question/i);
    fireEvent.click(likeButton);

    expect(likeButton).toBeDisabled();
    expect(screen.getByLabelText(/dislike question/i)).toBeDisabled();
  });

  it("should handle feedback functionality", async () => {
    const mockOnFeedbackChange = jest.fn();

    render(
      <QuestionLikeButtons
        question={mockQuestion}
        onFeedbackChange={mockOnFeedbackChange}
        showFeedback={true}
      />
    );

    // Click dislike to show feedback option
    const dislikeButton = screen.getByLabelText(/dislike question/i);
    fireEvent.click(dislikeButton);

    await waitFor(() => {
      const feedbackInput = screen.getByPlaceholderText(/feedback/i);
      fireEvent.change(feedbackInput, { target: { value: "Too easy" } });

      expect(mockOnFeedbackChange).toHaveBeenCalledWith("Too easy");
    });
  });

  it("should not render when question has no ID", () => {
    const questionWithoutId = { ...mockQuestion, id: undefined };

    render(<QuestionLikeButtons question={questionWithoutId} />);

    expect(screen.queryByLabelText(/like question/i)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/dislike question/i)
    ).not.toBeInTheDocument();
  });

  it("should handle disabled state", () => {
    render(<QuestionLikeButtons question={mockQuestion} disabled={true} />);

    const likeButton = screen.getByLabelText(/like question/i);
    const dislikeButton = screen.getByLabelText(/dislike question/i);

    expect(likeButton).toBeDisabled();
    expect(dislikeButton).toBeDisabled();
  });
});
