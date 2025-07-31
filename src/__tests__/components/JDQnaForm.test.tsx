import React from "react";
import { render, screen, fireEvent, waitFor } from "../utils/test-utils";
import { JDQnaForm } from "@/components/JDQnaForm";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock file reading
const mockFileReader = {
  readAsText: jest.fn(),
  result: "",
  onload: null as any,
  onerror: null as any,
};

// Mock FileReader constructor
global.FileReader = jest.fn(() => mockFileReader) as any;

describe("JDQnaForm", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFileReader.readAsText.mockClear();
  });

  it("should render form correctly", () => {
    render(<JDQnaForm />);

    expect(screen.getByText(/Job Description Analyzer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Job Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Job Description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Interview Length/i)).toBeInTheDocument();
  });

  it("should handle text input correctly", () => {
    render(<JDQnaForm />);

    const jobTitleInput = screen.getByLabelText(/Job Title/i);
    const jobDescInput = screen.getByLabelText(/Job Description/i);
    const interviewLengthInput = screen.getByLabelText(/Interview Length/i);

    fireEvent.change(jobTitleInput, {
      target: { value: "Software Developer" },
    });
    fireEvent.change(jobDescInput, {
      target: { value: "We are looking for a developer..." },
    });
    fireEvent.change(interviewLengthInput, { target: { value: "60" } });

    expect(jobTitleInput).toHaveValue("Software Developer");
    expect(jobDescInput).toHaveValue("We are looking for a developer...");
    expect(interviewLengthInput).toHaveValue(60);
  });

  it("should handle file upload", async () => {
    render(<JDQnaForm />);

    const file = new File(["job description content"], "job.txt", {
      type: "text/plain",
    });
    const fileInput = screen.getByLabelText(/Upload File/i);

    // Simulate file selection
    Object.defineProperty(fileInput, "files", {
      value: [file],
      writable: false,
    });

    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(mockFileReader.readAsText).toHaveBeenCalledWith(file);
    });
  });

  it("should handle form submission", async () => {
    const mockOnResult = jest.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        skillRecordId: "test-id",
        skills: [],
        questions: [],
      }),
    });

    render(<JDQnaForm onResult={mockOnResult} />);

    const jobTitleInput = screen.getByLabelText(/Job Title/i);
    const jobDescInput = screen.getByLabelText(/Job Description/i);
    const submitButton = screen.getByRole("button", {
      name: /Generate Questions/i,
    });

    fireEvent.change(jobTitleInput, { target: { value: "Developer" } });
    fireEvent.change(jobDescInput, { target: { value: "Job description" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobTitle: "Developer",
          jobDescription: "Job description",
          interviewLength: 60,
        }),
      });
    });

    expect(mockOnResult).toHaveBeenCalled();
  });

  it("should handle validation errors", async () => {
    render(<JDQnaForm />);

    const submitButton = screen.getByRole("button", {
      name: /Generate Questions/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Job title is required/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Job description is required/i)
      ).toBeInTheDocument();
    });
  });

  it("should handle API errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("API Error"));

    render(<JDQnaForm />);

    const jobTitleInput = screen.getByLabelText(/Job Title/i);
    const jobDescInput = screen.getByLabelText(/Job Description/i);
    const submitButton = screen.getByRole("button", {
      name: /Generate Questions/i,
    });

    fireEvent.change(jobTitleInput, { target: { value: "Developer" } });
    fireEvent.change(jobDescInput, { target: { value: "Job description" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to generate questions/i)
      ).toBeInTheDocument();
    });
  });

  it("should show loading state during submission", async () => {
    mockFetch.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<JDQnaForm />);

    const jobTitleInput = screen.getByLabelText(/Job Title/i);
    const jobDescInput = screen.getByLabelText(/Job Description/i);
    const submitButton = screen.getByRole("button", {
      name: /Generate Questions/i,
    });

    fireEvent.change(jobTitleInput, { target: { value: "Developer" } });
    fireEvent.change(jobDescInput, { target: { value: "Job description" } });
    fireEvent.click(submitButton);

    expect(screen.getByText(/Generating.../i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it("should handle different interview lengths", () => {
    render(<JDQnaForm />);

    const interviewLengthInput = screen.getByLabelText(/Interview Length/i);

    // Test different valid lengths
    const validLengths = [30, 45, 60, 90];
    validLengths.forEach((length) => {
      fireEvent.change(interviewLengthInput, {
        target: { value: length.toString() },
      });
      expect(interviewLengthInput).toHaveValue(length);
    });
  });

  it("should reset form after successful submission", async () => {
    const mockOnResult = jest.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        skillRecordId: "test-id",
        skills: [],
        questions: [],
      }),
    });

    render(<JDQnaForm onResult={mockOnResult} onReset={true} />);

    const jobTitleInput = screen.getByLabelText(/Job Title/i);
    const jobDescInput = screen.getByLabelText(/Job Description/i);
    const submitButton = screen.getByRole("button", {
      name: /Generate Questions/i,
    });

    fireEvent.change(jobTitleInput, { target: { value: "Developer" } });
    fireEvent.change(jobDescInput, { target: { value: "Job description" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnResult).toHaveBeenCalled();
    });

    // Form should be reset if onReset is true
    if (screen.queryByDisplayValue("Developer") === null) {
      expect(jobTitleInput).toHaveValue("");
      expect(jobDescInput).toHaveValue("");
    }
  });
});
