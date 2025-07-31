import React from "react";
import { render, screen, fireEvent, waitFor } from "../utils/test-utils";
import { SkillsTable } from "@/components/SkillsTable";

describe("SkillsTable", () => {
  const mockSkills = [
    {
      id: "skill-1",
      name: "JavaScript",
      level: "INTERMEDIATE",
      category: "TECHNICAL",
      priority: 1,
      requirement: "MANDATORY",
      numQuestions: 5,
      questions: [
        {
          id: "q1",
          question: "What is JavaScript?",
          answer: "Programming language",
        },
      ],
      feedbacks: [],
    },
    {
      id: "skill-2",
      name: "React",
      level: "ADVANCED",
      category: "TECHNICAL",
      priority: 2,
      requirement: "OPTIONAL",
      numQuestions: 3,
      questions: [],
      feedbacks: [],
    },
  ];

  it("should render skills table correctly", () => {
    render(<SkillsTable skills={mockSkills} />);

    expect(screen.getByText("JavaScript")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("INTERMEDIATE")).toBeInTheDocument();
    expect(screen.getByText("ADVANCED")).toBeInTheDocument();
    expect(screen.getByText("MANDATORY")).toBeInTheDocument();
    expect(screen.getByText("OPTIONAL")).toBeInTheDocument();
  });

  it("should handle empty skills list", () => {
    render(<SkillsTable skills={[]} />);

    expect(screen.getByText(/No skills found/i)).toBeInTheDocument();
  });

  it("should handle sorting", () => {
    render(<SkillsTable skills={mockSkills} sortable={true} />);

    // Click on name header to sort
    const nameHeader = screen.getByText("Skill Name");
    fireEvent.click(nameHeader);

    // Should sort alphabetically
    const skillNames = screen.getAllByTestId("skill-name");
    expect(skillNames[0]).toHaveTextContent("JavaScript");
    expect(skillNames[1]).toHaveTextContent("React");
  });

  it("should handle filtering", () => {
    render(<SkillsTable skills={mockSkills} filterable={true} />);

    const filterInput = screen.getByPlaceholderText(/Filter skills/i);
    fireEvent.change(filterInput, { target: { value: "JavaScript" } });

    expect(screen.getByText("JavaScript")).toBeInTheDocument();
    expect(screen.queryByText("React")).not.toBeInTheDocument();
  });

  it("should handle skill selection", () => {
    const mockOnSelect = jest.fn();
    render(
      <SkillsTable
        skills={mockSkills}
        onSelect={mockOnSelect}
        selectable={true}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    expect(mockOnSelect).toHaveBeenCalledWith(mockSkills[0]);
  });

  it("should handle bulk selection", () => {
    const mockOnSelectAll = jest.fn();
    render(
      <SkillsTable
        skills={mockSkills}
        onSelectAll={mockOnSelectAll}
        selectable={true}
      />
    );

    const selectAllCheckbox = screen.getByLabelText(/Select all/i);
    fireEvent.click(selectAllCheckbox);

    expect(mockOnSelectAll).toHaveBeenCalledWith(mockSkills);
  });

  it("should show action buttons", () => {
    const mockOnEdit = jest.fn();
    const mockOnDelete = jest.fn();

    render(
      <SkillsTable
        skills={mockSkills}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        showActions={true}
      />
    );

    const editButtons = screen.getAllByLabelText(/Edit/i);
    const deleteButtons = screen.getAllByLabelText(/Delete/i);

    expect(editButtons).toHaveLength(2);
    expect(deleteButtons).toHaveLength(2);

    fireEvent.click(editButtons[0]);
    expect(mockOnEdit).toHaveBeenCalledWith(mockSkills[0]);

    fireEvent.click(deleteButtons[0]);
    expect(mockOnDelete).toHaveBeenCalledWith(mockSkills[0]);
  });

  it("should handle pagination", () => {
    const manySkills = Array.from({ length: 25 }, (_, i) => ({
      ...mockSkills[0],
      id: `skill-${i}`,
      name: `Skill ${i}`,
    }));

    render(<SkillsTable skills={manySkills} pageSize={10} />);

    expect(screen.getByText("1 of 3")).toBeInTheDocument();

    const nextButton = screen.getByLabelText(/Next page/i);
    fireEvent.click(nextButton);

    expect(screen.getByText("2 of 3")).toBeInTheDocument();
  });

  it("should show skill details in expandable rows", () => {
    render(<SkillsTable skills={mockSkills} expandable={true} />);

    const expandButton = screen.getAllByLabelText(/Expand/i)[0];
    fireEvent.click(expandButton);

    expect(screen.getByText("What is JavaScript?")).toBeInTheDocument();
  });

  it("should handle different skill levels", () => {
    const skillsWithDifferentLevels = [
      { ...mockSkills[0], level: "BEGINNER" },
      { ...mockSkills[0], level: "INTERMEDIATE" },
      { ...mockSkills[0], level: "ADVANCED" },
      { ...mockSkills[0], level: "EXPERT" },
    ];

    render(<SkillsTable skills={skillsWithDifferentLevels} />);

    expect(screen.getByText("BEGINNER")).toBeInTheDocument();
    expect(screen.getByText("INTERMEDIATE")).toBeInTheDocument();
    expect(screen.getByText("ADVANCED")).toBeInTheDocument();
    expect(screen.getByText("EXPERT")).toBeInTheDocument();
  });

  it("should handle different skill categories", () => {
    const skillsWithDifferentCategories = [
      { ...mockSkills[0], category: "TECHNICAL" },
      { ...mockSkills[0], category: "COGNITIVE" },
      { ...mockSkills[0], category: "BEHAVIORAL" },
    ];

    render(<SkillsTable skills={skillsWithDifferentCategories} />);

    expect(screen.getByText("TECHNICAL")).toBeInTheDocument();
    expect(screen.getByText("COGNITIVE")).toBeInTheDocument();
    expect(screen.getByText("BEHAVIORAL")).toBeInTheDocument();
  });

  it("should show question counts", () => {
    render(<SkillsTable skills={mockSkills} showQuestionCount={true} />);

    expect(screen.getByText("5 questions")).toBeInTheDocument();
    expect(screen.getByText("3 questions")).toBeInTheDocument();
  });

  it("should handle export functionality", () => {
    const mockOnExport = jest.fn();
    render(<SkillsTable skills={mockSkills} onExport={mockOnExport} />);

    const exportButton = screen.getByRole("button", { name: /Export/i });
    fireEvent.click(exportButton);

    expect(mockOnExport).toHaveBeenCalledWith(mockSkills);
  });
});
