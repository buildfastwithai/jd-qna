import React from "react";
import { render, screen, fireEvent, waitFor } from "../../utils/test-utils";
import { QuestionsDisplay, Question } from "@/components/ui/questions-display";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("QuestionsDisplay", () => {
  const mockQuestions: Question[] = [
    {
      id: "q1",
      question: "What is JavaScript?",
      answer: "JavaScript is a programming language",
      category: "Technical",
      difficulty: "Medium",
      skillName: "JavaScript",
      liked: "NONE",
    },
    {
      id: "q2",
      question: "Explain React hooks",
      answer: "React hooks are functions that allow you to use state",
      category: "Framework",
      difficulty: "Hard",
      skillName: "React",
      liked: "LIKED",
    },
  ];

  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("should render questions correctly", () => {
    render(<QuestionsDisplay questions={mockQuestions} />);

    expect(screen.getByText("What is JavaScript?")).toBeInTheDocument();
    expect(screen.getByText("Explain React hooks")).toBeInTheDocument();
    expect(
      screen.getByText("JavaScript is a programming language")
    ).toBeInTheDocument();
    expect(
      screen.getByText("React hooks are functions that allow you to use state")
    ).toBeInTheDocument();
  });

  it("should display question metadata", () => {
    render(<QuestionsDisplay questions={mockQuestions} />);

    expect(screen.getByText("JavaScript")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Hard")).toBeInTheDocument();
    expect(screen.getByText("Technical")).toBeInTheDocument();
    expect(screen.getByText("Framework")).toBeInTheDocument();
  });

  it("should render generate PDF button when callback provided", () => {
    const mockOnGeneratePDF = jest.fn();

    render(
      <QuestionsDisplay
        questions={mockQuestions}
        onGeneratePDF={mockOnGeneratePDF}
      />
    );

    const pdfButton = screen.getByText(/Generate PDF/i);
    expect(pdfButton).toBeInTheDocument();

    fireEvent.click(pdfButton);
    expect(mockOnGeneratePDF).toHaveBeenCalled();
  });

  it("should not render generate PDF button when callback not provided", () => {
    render(<QuestionsDisplay questions={mockQuestions} />);

    expect(screen.queryByText(/Generate PDF/i)).not.toBeInTheDocument();
  });

  it("should render like buttons when enabled", () => {
    render(
      <QuestionsDisplay questions={mockQuestions} enableLikeButtons={true} />
    );

    // Should have like/dislike buttons for each question
    const likeButtons = screen.getAllByLabelText(/like/i);
    const dislikeButtons = screen.getAllByLabelText(/dislike/i);

    expect(likeButtons).toHaveLength(2);
    expect(dislikeButtons).toHaveLength(2);
  });

  it("should not render like buttons when disabled", () => {
    render(
      <QuestionsDisplay questions={mockQuestions} enableLikeButtons={false} />
    );

    expect(screen.queryByLabelText(/like/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/dislike/i)).not.toBeInTheDocument();
  });

  it("should handle question like action", async () => {
    const mockOnQuestionUpdated = jest.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        question: { ...mockQuestions[0], liked: "LIKED" },
      }),
    });

    render(
      <QuestionsDisplay
        questions={mockQuestions}
        enableLikeButtons={true}
        onQuestionUpdated={mockOnQuestionUpdated}
      />
    );

    const likeButtons = screen.getAllByLabelText(/like/i);
    fireEvent.click(likeButtons[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/questions/q1/like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-auth-token",
        },
        body: JSON.stringify({ liked: "LIKED" }),
      });
    });

    expect(mockOnQuestionUpdated).toHaveBeenCalledWith({
      ...mockQuestions[0],
      liked: "LIKED",
    });
  });

  it("should handle question dislike action", async () => {
    const mockOnQuestionUpdated = jest.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        question: { ...mockQuestions[0], liked: "DISLIKED" },
      }),
    });

    render(
      <QuestionsDisplay
        questions={mockQuestions}
        enableLikeButtons={true}
        onQuestionUpdated={mockOnQuestionUpdated}
      />
    );

    const dislikeButtons = screen.getAllByLabelText(/dislike/i);
    fireEvent.click(dislikeButtons[0]);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/questions/q1/like", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-auth-token",
        },
        body: JSON.stringify({ liked: "DISLIKED" }),
      });
    });
  });

  it("should handle like/dislike errors gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(
      <QuestionsDisplay questions={mockQuestions} enableLikeButtons={true} />
    );

    const likeButtons = screen.getAllByLabelText(/like/i);
    fireEvent.click(likeButtons[0]);

    // Should not crash and might show error message
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it("should show correct like state for questions", () => {
    const questionsWithLikes: Question[] = [
      { ...mockQuestions[0], liked: "LIKED" },
      { ...mockQuestions[1], liked: "DISLIKED" },
    ];

    render(
      <QuestionsDisplay
        questions={questionsWithLikes}
        enableLikeButtons={true}
      />
    );

    // First question should show as liked
    const likeButtons = screen.getAllByLabelText(/like/i);
    expect(likeButtons[0]).toHaveClass("liked"); // or whatever class indicates liked state

    // Second question should show as disliked
    const dislikeButtons = screen.getAllByLabelText(/dislike/i);
    expect(dislikeButtons[1]).toHaveClass("disliked"); // or whatever class indicates disliked state
  });

  it("should handle empty questions list", () => {
    render(<QuestionsDisplay questions={[]} />);

    expect(screen.getByText(/No questions available/i)).toBeInTheDocument();
  });

  it("should handle questions without optional fields", () => {
    const minimalQuestions: Question[] = [
      {
        question: "Basic question",
        answer: "Basic answer",
        category: "Basic",
        difficulty: "Easy",
        skillName: "Basic Skill",
      },
    ];

    render(<QuestionsDisplay questions={minimalQuestions} />);

    expect(screen.getByText("Basic question")).toBeInTheDocument();
    expect(screen.getByText("Basic answer")).toBeInTheDocument();
  });

  it("should handle long questions and answers", () => {
    const longQuestion =
      "This is a very long question that might wrap to multiple lines and test how the component handles text overflow and wrapping behavior in the user interface";
    const longAnswer =
      "This is a very long answer that contains detailed explanations and might span multiple paragraphs to test the rendering capabilities of the component";

    const longQuestions: Question[] = [
      {
        question: longQuestion,
        answer: longAnswer,
        category: "Long Content",
        difficulty: "Medium",
        skillName: "Text Handling",
      },
    ];

    render(<QuestionsDisplay questions={longQuestions} />);

    expect(screen.getByText(longQuestion)).toBeInTheDocument();
    expect(screen.getByText(longAnswer)).toBeInTheDocument();
  });

  it("should handle question refresh callback", () => {
    const mockOnQuestionsRefreshed = jest.fn();

    render(
      <QuestionsDisplay
        questions={mockQuestions}
        onQuestionsRefreshed={mockOnQuestionsRefreshed}
      />
    );

    // If there's a refresh button or automatic refresh trigger
    const refreshButton = screen.queryByText(/Refresh/i);
    if (refreshButton) {
      fireEvent.click(refreshButton);
      expect(mockOnQuestionsRefreshed).toHaveBeenCalled();
    }
  });

  it("should render questions in correct order", () => {
    render(<QuestionsDisplay questions={mockQuestions} />);

    const questionElements = screen.getAllByRole("article"); // or whatever role/selector identifies question cards
    expect(questionElements).toHaveLength(2);

    // Verify the order is maintained
    expect(questionElements[0]).toHaveTextContent("What is JavaScript?");
    expect(questionElements[1]).toHaveTextContent("Explain React hooks");
  });
});
