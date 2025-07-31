import React from "react";
import { render, screen, fireEvent, waitFor } from "../utils/test-utils";
import { SkillRecordEditor } from "@/components/SkillRecordEditor";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("SkillRecordEditor", () => {
  const mockSkillRecord = {
    id: "record-1",
    jobTitle: "Software Developer",
    jobDescription: "Full stack developer position",
    interviewLength: 60,
    skills: [
      {
        id: "skill-1",
        name: "JavaScript",
        level: "INTERMEDIATE",
        category: "TECHNICAL",
        priority: 1,
        requirement: "MANDATORY",
        numQuestions: 5,
        questions: [],
        feedbacks: [],
      },
    ],
    questions: [],
    globalFeedback: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("should render skill record editor correctly", () => {
    render(<SkillRecordEditor skillRecord={mockSkillRecord} />);

    expect(screen.getByText("Software Developer")).toBeInTheDocument();
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
    expect(screen.getByText("INTERMEDIATE")).toBeInTheDocument();
    expect(screen.getByText("TECHNICAL")).toBeInTheDocument();
  });

  it("should handle skill editing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<SkillRecordEditor skillRecord={mockSkillRecord} />);

    // Find and click edit button for skill
    const editButton = screen.getByLabelText(/Edit skill/i);
    fireEvent.click(editButton);

    // Should show edit form
    expect(screen.getByLabelText(/Skill Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Level/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Category/i)).toBeInTheDocument();
  });

  it("should handle adding new skill", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        skill: { id: "new-skill", name: "React" },
      }),
    });

    render(<SkillRecordEditor skillRecord={mockSkillRecord} />);

    const addSkillButton = screen.getByRole("button", { name: /Add Skill/i });
    fireEvent.click(addSkillButton);

    // Should show add skill dialog
    expect(screen.getByText(/Add New Skill/i)).toBeInTheDocument();
  });

  it("should handle skill deletion", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<SkillRecordEditor skillRecord={mockSkillRecord} />);

    const deleteButton = screen.getByLabelText(/Delete skill/i);
    fireEvent.click(deleteButton);

    // Should show confirmation dialog
    expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: /Delete/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/records/${mockSkillRecord.id}/skills/skill-1`,
        expect.objectContaining({
          method: "DELETE",
        })
      );
    });
  });

  it("should handle question generation", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        questions: [
          {
            id: "q1",
            question: "What is JavaScript?",
            answer: "Programming language",
          },
        ],
      }),
    });

    render(<SkillRecordEditor skillRecord={mockSkillRecord} />);

    const generateButton = screen.getByRole("button", {
      name: /Generate Questions/i,
    });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/records/${mockSkillRecord.id}/generate-questions`,
        expect.objectContaining({
          method: "POST",
        })
      );
    });
  });

  it("should handle global feedback", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<SkillRecordEditor skillRecord={mockSkillRecord} />);

    const feedbackButton = screen.getByRole("button", {
      name: /Global Feedback/i,
    });
    fireEvent.click(feedbackButton);

    // Should show feedback dialog
    expect(screen.getByText(/Global Feedback/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Feedback/i)).toBeInTheDocument();

    const feedbackInput = screen.getByLabelText(/Feedback/i);
    const submitButton = screen.getByRole("button", {
      name: /Submit Feedback/i,
    });

    fireEvent.change(feedbackInput, {
      target: { value: "Good questions overall" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/records/${mockSkillRecord.id}/global-feedback`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ feedback: "Good questions overall" }),
        })
      );
    });
  });

  it("should handle auto-generation", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        skills: [{ id: "auto-skill", name: "Auto Generated Skill" }],
      }),
    });

    render(<SkillRecordEditor skillRecord={mockSkillRecord} />);

    const autoGenButton = screen.getByRole("button", {
      name: /Auto Generate/i,
    });
    fireEvent.click(autoGenButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/records/${mockSkillRecord.id}/auto-generate`,
        expect.objectContaining({
          method: "POST",
        })
      );
    });
  });

  it("should handle error states", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(<SkillRecordEditor skillRecord={mockSkillRecord} />);

    const generateButton = screen.getByRole("button", {
      name: /Generate Questions/i,
    });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to generate questions/i)
      ).toBeInTheDocument();
    });
  });

  it("should show loading states", async () => {
    mockFetch.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<SkillRecordEditor skillRecord={mockSkillRecord} />);

    const generateButton = screen.getByRole("button", {
      name: /Generate Questions/i,
    });
    fireEvent.click(generateButton);

    expect(screen.getByText(/Generating.../i)).toBeInTheDocument();
    expect(generateButton).toBeDisabled();
  });

  it("should handle skill priority changes", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<SkillRecordEditor skillRecord={mockSkillRecord} />);

    // Find priority control and change it
    const priorityInput = screen.getByDisplayValue("1");
    fireEvent.change(priorityInput, { target: { value: "2" } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it("should handle requirement changes", async () => {
    render(<SkillRecordEditor skillRecord={mockSkillRecord} />);

    // Should show requirement options
    expect(screen.getByText("MANDATORY")).toBeInTheDocument();

    // Test requirement toggle functionality
    const requirementButton = screen.getByText("MANDATORY");
    fireEvent.click(requirementButton);

    // Should change to OPTIONAL or show dropdown
    await waitFor(() => {
      expect(screen.getByText("OPTIONAL")).toBeInTheDocument();
    });
  });
});
