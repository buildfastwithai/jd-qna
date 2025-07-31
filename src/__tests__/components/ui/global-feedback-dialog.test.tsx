import React from "react";
import { render, screen, fireEvent, waitFor } from "../../utils/test-utils";
import { GlobalFeedbackDialog } from "@/components/ui/global-feedback-dialog";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("GlobalFeedbackDialog", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("should render global feedback dialog correctly", () => {
    render(
      <GlobalFeedbackDialog
        isOpen={true}
        onClose={jest.fn()}
        recordId="test-record"
      />
    );

    expect(screen.getByText(/Global Feedback/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Overall feedback/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Rating/i)).toBeInTheDocument();
  });

  it("should not render when closed", () => {
    render(
      <GlobalFeedbackDialog
        isOpen={false}
        onClose={jest.fn()}
        recordId="test-record"
      />
    );

    expect(screen.queryByText(/Global Feedback/i)).not.toBeInTheDocument();
  });

  it("should handle feedback input", () => {
    render(
      <GlobalFeedbackDialog
        isOpen={true}
        onClose={jest.fn()}
        recordId="test-record"
      />
    );

    const feedbackTextarea = screen.getByLabelText(/Overall feedback/i);
    const ratingInput = screen.getByLabelText(/Rating/i);

    fireEvent.change(feedbackTextarea, {
      target: { value: "Good questions overall" },
    });
    fireEvent.change(ratingInput, { target: { value: "4" } });

    expect(feedbackTextarea).toHaveValue("Good questions overall");
    expect(ratingInput).toHaveValue("4");
  });

  it("should handle form submission", async () => {
    const mockOnSubmit = jest.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(
      <GlobalFeedbackDialog
        isOpen={true}
        onClose={jest.fn()}
        recordId="test-record"
        onSubmit={mockOnSubmit}
      />
    );

    const feedbackTextarea = screen.getByLabelText(/Overall feedback/i);
    const submitButton = screen.getByRole("button", { name: /Submit/i });

    fireEvent.change(feedbackTextarea, {
      target: { value: "Excellent questions" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/records/test-record/global-feedback",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            feedback: "Excellent questions",
            rating: 5,
          }),
        })
      );
    });

    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it("should handle validation errors", async () => {
    render(
      <GlobalFeedbackDialog
        isOpen={true}
        onClose={jest.fn()}
        recordId="test-record"
      />
    );

    const submitButton = screen.getByRole("button", { name: /Submit/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Feedback is required/i)).toBeInTheDocument();
    });
  });

  it("should handle API errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(
      <GlobalFeedbackDialog
        isOpen={true}
        onClose={jest.fn()}
        recordId="test-record"
      />
    );

    const feedbackTextarea = screen.getByLabelText(/Overall feedback/i);
    const submitButton = screen.getByRole("button", { name: /Submit/i });

    fireEvent.change(feedbackTextarea, {
      target: { value: "Test feedback" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to submit feedback/i)
      ).toBeInTheDocument();
    });
  });

  it("should show loading state", async () => {
    mockFetch.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(
      <GlobalFeedbackDialog
        isOpen={true}
        onClose={jest.fn()}
        recordId="test-record"
      />
    );

    const feedbackTextarea = screen.getByLabelText(/Overall feedback/i);
    const submitButton = screen.getByRole("button", { name: /Submit/i });

    fireEvent.change(feedbackTextarea, {
      target: { value: "Test feedback" },
    });
    fireEvent.click(submitButton);

    expect(screen.getByText(/Submitting.../i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it("should handle dialog close", () => {
    const mockOnClose = jest.fn();

    render(
      <GlobalFeedbackDialog
        isOpen={true}
        onClose={mockOnClose}
        recordId="test-record"
      />
    );

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should handle rating changes", () => {
    render(
      <GlobalFeedbackDialog
        isOpen={true}
        onClose={jest.fn()}
        recordId="test-record"
      />
    );

    const ratingInputs = screen.getAllByRole("radio");
    fireEvent.click(ratingInputs[3]); // Rating 4

    expect(ratingInputs[3]).toBeChecked();
  });

  it("should display existing feedback for editing", () => {
    const existingFeedback = {
      feedback: "Previous feedback",
      rating: 3,
    };

    render(
      <GlobalFeedbackDialog
        isOpen={true}
        onClose={jest.fn()}
        recordId="test-record"
        initialFeedback={existingFeedback}
      />
    );

    const feedbackTextarea = screen.getByLabelText(/Overall feedback/i);
    expect(feedbackTextarea).toHaveValue("Previous feedback");

    const ratingInput = screen.getByDisplayValue("3");
    expect(ratingInput).toBeChecked();
  });
});
