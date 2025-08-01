/**
 * Tests for the FileUpload component
 * These tests verify file upload functionality including success, error, and loading states
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FileUpload } from "@/components/FileUpload";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("FileUpload Component", () => {
  // Reset mocks before each test
  beforeEach(() => {
    mockFetch.mockClear();
  });

  /**
   * Test 1: Basic component rendering
   * Should render the file upload component with default props
   */
  it("should render file upload component with default props", () => {
    render(<FileUpload />);

    // Should show upload label
    expect(screen.getByText("Upload File")).toBeTruthy();

    // Should show accepted file types
    expect(screen.getByText(".pdf, .doc, .docx files")).toBeTruthy();

    // Should have file input (hidden)
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();
  });

  /**
   * Test 2: Custom props rendering
   * Should render with custom label and accepted file types
   */
  it("should render with custom props", () => {
    render(<FileUpload label="Choose Document" acceptedFileTypes=".txt,.md" />);

    expect(screen.getByText("Choose Document")).toBeTruthy();
    expect(screen.getByText(".txt, .md files")).toBeTruthy();
  });

  /**
   * Test 3: File selection without upload (no file selected)
   * Should handle when no file is selected
   */
  it("should handle when no file is selected", async () => {
    render(<FileUpload />);

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    // Simulate selecting no file
    fireEvent.change(fileInput, { target: { files: [] } });

    // Should not show loading state
    expect(screen.queryByText("Uploading...")).not.toBeTruthy();
  });

  /**
   * Test 4: Successful file upload
   * Should handle successful file upload and call onFileUploaded callback
   */
  it("should handle successful file upload", async () => {
    const mockOnFileUploaded = jest.fn();
    const mockFile = new File(["test content"], "test.pdf", {
      type: "application/pdf",
    });

    // Mock successful API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ file: { url: "https://example.com/test.pdf" } }),
    });

    render(<FileUpload onFileUploaded={mockOnFileUploaded} />);

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    // Simulate file selection
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Should show loading state
    expect(screen.getByText("Uploading...")).toBeTruthy();

    // Wait for upload to complete
    await waitFor(() => {
      expect(mockOnFileUploaded).toHaveBeenCalledWith(
        "https://example.com/test.pdf"
      );
    });

    // Should hide loading state
    expect(screen.queryByText("Uploading...")).not.toBeTruthy();
  });

  /**
   * Test 5: Failed file upload (network error)
   * Should display error message when upload fails
   */
  it("should handle upload failure and show error message", async () => {
    const mockFile = new File(["test content"], "test.pdf", {
      type: "application/pdf",
    });

    // Mock failed API response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Upload failed" }),
    });

    render(<FileUpload />);

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    // Simulate file selection
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText("Upload failed")).toBeTruthy();
    });

    // Should hide loading state
    expect(screen.queryByText("Uploading...")).not.toBeTruthy();
  });

  /**
   * Test 6: Network error during upload
   * Should handle network errors gracefully
   */
  it("should handle network errors during upload", async () => {
    const mockFile = new File(["test content"], "test.pdf", {
      type: "application/pdf",
    });

    // Mock network error
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(<FileUpload />);

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    // Simulate file selection
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeTruthy();
    });

    // Should hide loading state
    expect(screen.queryByText("Uploading...")).not.toBeTruthy();
  });

  /**
   * Test 7: Input disabled during upload
   * Should disable file input while upload is in progress
   */
  it("should disable input during upload", async () => {
    const mockFile = new File(["test content"], "test.pdf", {
      type: "application/pdf",
    });

    // Mock slow API response
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({
                  file: { url: "https://example.com/test.pdf" },
                }),
              }),
            100
          )
        )
    );

    render(<FileUpload />);

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    // Simulate file selection
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Input should be disabled during upload
    expect(fileInput.disabled).toBe(true);

    // Wait for upload to complete
    await waitFor(
      () => {
        expect(fileInput.disabled).toBe(false);
      },
      { timeout: 200 }
    );
  });
});
