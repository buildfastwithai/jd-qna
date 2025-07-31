import React from "react";
import { render, screen, fireEvent, waitFor } from "../../utils/test-utils";
import { AddSkillDialog } from "@/components/ui/add-skill-dialog";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("AddSkillDialog", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("should render add skill dialog correctly", () => {
    render(
      <AddSkillDialog
        isOpen={true}
        onClose={jest.fn()}
        recordId="test-record"
      />
    );

    expect(screen.getByText(/Add New Skill/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Skill Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Level/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Category/i)).toBeInTheDocument();
  });

  it("should not render when closed", () => {
    render(
      <AddSkillDialog
        isOpen={false}
        onClose={jest.fn()}
        recordId="test-record"
      />
    );

    expect(screen.queryByText(/Add New Skill/i)).not.toBeInTheDocument();
  });

  it("should handle form input", () => {
    render(
      <AddSkillDialog
        isOpen={true}
        onClose={jest.fn()}
        recordId="test-record"
      />
    );

    const nameInput = screen.getByLabelText(/Skill Name/i);
    const levelSelect = screen.getByLabelText(/Level/i);
    const categorySelect = screen.getByLabelText(/Category/i);

    fireEvent.change(nameInput, { target: { value: "TypeScript" } });
    fireEvent.change(levelSelect, { target: { value: "INTERMEDIATE" } });
    fireEvent.change(categorySelect, { target: { value: "TECHNICAL" } });

    expect(nameInput).toHaveValue("TypeScript");
    expect(levelSelect).toHaveValue("INTERMEDIATE");
    expect(categorySelect).toHaveValue("TECHNICAL");
  });

  it("should handle form submission", async () => {
    const mockOnSkillAdded = jest.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        skill: {
          id: "new-skill",
          name: "TypeScript",
          level: "INTERMEDIATE",
          category: "TECHNICAL",
        },
      }),
    });

    render(
      <AddSkillDialog
        isOpen={true}
        onClose={jest.fn()}
        recordId="test-record"
        onSkillAdded={mockOnSkillAdded}
      />
    );

    const nameInput = screen.getByLabelText(/Skill Name/i);
    const submitButton = screen.getByRole("button", { name: /Add Skill/i });

    fireEvent.change(nameInput, { target: { value: "TypeScript" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/records/test-record/add-skill",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "TypeScript",
            level: "INTERMEDIATE",
            category: "TECHNICAL",
            priority: 1,
            requirement: "MANDATORY",
            numQuestions: 0,
          }),
        })
      );
    });

    expect(mockOnSkillAdded).toHaveBeenCalled();
  });

  it("should handle validation errors", async () => {
    render(
      <AddSkillDialog
        isOpen={true}
        onClose={jest.fn()}
        recordId="test-record"
      />
    );

    const submitButton = screen.getByRole("button", { name: /Add Skill/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Skill name is required/i)).toBeInTheDocument();
    });
  });

  it("should handle API errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(
      <AddSkillDialog
        isOpen={true}
        onClose={jest.fn()}
        recordId="test-record"
      />
    );

    const nameInput = screen.getByLabelText(/Skill Name/i);
    const submitButton = screen.getByRole("button", { name: /Add Skill/i });

    fireEvent.change(nameInput, { target: { value: "TypeScript" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Failed to add skill/i)).toBeInTheDocument();
    });
  });

  it("should show loading state", async () => {
    mockFetch.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(
      <AddSkillDialog
        isOpen={true}
        onClose={jest.fn()}
        recordId="test-record"
      />
    );

    const nameInput = screen.getByLabelText(/Skill Name/i);
    const submitButton = screen.getByRole("button", { name: /Add Skill/i });

    fireEvent.change(nameInput, { target: { value: "TypeScript" } });
    fireEvent.click(submitButton);

    expect(screen.getByText(/Adding.../i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  it("should handle dialog close", () => {
    const mockOnClose = jest.fn();

    render(
      <AddSkillDialog
        isOpen={true}
        onClose={mockOnClose}
        recordId="test-record"
      />
    );

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should reset form on successful submission", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, skill: {} }),
    });

    render(
      <AddSkillDialog
        isOpen={true}
        onClose={jest.fn()}
        recordId="test-record"
      />
    );

    const nameInput = screen.getByLabelText(/Skill Name/i);
    const submitButton = screen.getByRole("button", { name: /Add Skill/i });

    fireEvent.change(nameInput, { target: { value: "TypeScript" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(nameInput).toHaveValue("");
    });
  });
});
