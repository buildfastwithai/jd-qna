import React from "react";
import { render, screen, fireEvent, waitFor } from "../utils/test-utils";
import { RegenerationFeedback } from "@/components/RegenerationFeedback";

describe("RegenerationFeedback", () => {
  const mockFeedbackData = [
    {
      id: "feedback-1",
      questionId: "q1",
      originalQuestion: "What is JavaScript?",
      regeneratedQuestion: "What are the key features of JavaScript?",
      feedback: "Make it more specific",
      timestamp: new Date().toISOString(),
      rating: 4,
    },
    {
      id: "feedback-2",
      questionId: "q2",
      originalQuestion: "Explain React",
      regeneratedQuestion: "How does React virtual DOM work?",
      feedback: "Focus on technical details",
      timestamp: new Date().toISOString(),
      rating: 5,
    },
  ];

  it("should render feedback list correctly", () => {
    render(<RegenerationFeedback feedbackData={mockFeedbackData} />);

    expect(screen.getByText("What is JavaScript?")).toBeInTheDocument();
    expect(
      screen.getByText("What are the key features of JavaScript?")
    ).toBeInTheDocument();
    expect(screen.getByText("Make it more specific")).toBeInTheDocument();
    expect(screen.getByText("Explain React")).toBeInTheDocument();
  });

  it("should handle empty feedback data", () => {
    render(<RegenerationFeedback feedbackData={[]} />);

    expect(screen.getByText(/No feedback data available/i)).toBeInTheDocument();
  });

  it("should show feedback ratings", () => {
    render(
      <RegenerationFeedback
        feedbackData={mockFeedbackData}
        showRatings={true}
      />
    );

    expect(screen.getByText("4/5")).toBeInTheDocument();
    expect(screen.getByText("5/5")).toBeInTheDocument();
  });

  it("should handle feedback filtering", () => {
    render(
      <RegenerationFeedback feedbackData={mockFeedbackData} filterable={true} />
    );

    const filterInput = screen.getByPlaceholderText(/Filter feedback/i);
    fireEvent.change(filterInput, { target: { value: "JavaScript" } });

    expect(screen.getByText("What is JavaScript?")).toBeInTheDocument();
    expect(screen.queryByText("Explain React")).not.toBeInTheDocument();
  });

  it("should handle sorting by timestamp", () => {
    render(
      <RegenerationFeedback feedbackData={mockFeedbackData} sortable={true} />
    );

    const sortButton = screen.getByLabelText(/Sort by date/i);
    fireEvent.click(sortButton);

    // Should sort feedback items
    const feedbackItems = screen.getAllByTestId("feedback-item");
    expect(feedbackItems).toHaveLength(2);
  });

  it("should handle feedback expansion", () => {
    render(
      <RegenerationFeedback feedbackData={mockFeedbackData} expandable={true} />
    );

    const expandButton = screen.getAllByLabelText(/Expand/i)[0];
    fireEvent.click(expandButton);

    // Should show detailed view
    expect(screen.getByText(/Original Question/i)).toBeInTheDocument();
    expect(screen.getByText(/Regenerated Question/i)).toBeInTheDocument();
  });

  it("should handle feedback export", () => {
    const mockOnExport = jest.fn();
    render(
      <RegenerationFeedback
        feedbackData={mockFeedbackData}
        onExport={mockOnExport}
      />
    );

    const exportButton = screen.getByRole("button", { name: /Export/i });
    fireEvent.click(exportButton);

    expect(mockOnExport).toHaveBeenCalledWith(mockFeedbackData);
  });

  it("should show average rating", () => {
    render(
      <RegenerationFeedback feedbackData={mockFeedbackData} showStats={true} />
    );

    expect(screen.getByText(/Average Rating: 4.5/i)).toBeInTheDocument();
  });

  it("should handle feedback deletion", async () => {
    const mockOnDelete = jest.fn();
    render(
      <RegenerationFeedback
        feedbackData={mockFeedbackData}
        onDelete={mockOnDelete}
      />
    );

    const deleteButton = screen.getAllByLabelText(/Delete/i)[0];
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith(mockFeedbackData[0]);
  });
});
