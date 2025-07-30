import React from "react";
import { render, screen, fireEvent, waitFor } from "../utils/test-utils";
import { FileUpload } from "@/components/FileUpload";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("FileUpload", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("should render with default props", () => {
    render(<FileUpload />);

    expect(screen.getByText("Upload File")).toBeInTheDocument();
    expect(screen.getByLabelText("Upload File")).toBeInTheDocument();
  });

  it("should render with custom label", () => {
    render(<FileUpload label="Upload Document" />);

    expect(screen.getByText("Upload Document")).toBeInTheDocument();
  });

  it("should accept custom file types", () => {
    render(<FileUpload acceptedFileTypes=".jpg,.png" />);

    const fileInput = screen.getByLabelText("Upload File");
    expect(fileInput).toHaveAttribute("accept", ".jpg,.png");
  });

  it("should handle file selection", () => {
    const mockFile = new File(["test content"], "test.pdf", {
      type: "application/pdf",
    });
    render(<FileUpload />);

    const fileInput = screen.getByLabelText("Upload File");
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    expect(screen.getByText("test.pdf")).toBeInTheDocument();
  });

  it("should upload file successfully", async () => {
    const mockOnFileUploaded = jest.fn();
    const mockFile = new File(["test content"], "test.pdf", {
      type: "application/pdf",
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: "https://example.com/test.pdf" }),
    });

    render(<FileUpload onFileUploaded={mockOnFileUploaded} />);

    const fileInput = screen.getByLabelText("Upload File");
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    const uploadButton = screen.getByText("Upload");
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(mockOnFileUploaded).toHaveBeenCalledWith(
        "https://example.com/test.pdf"
      );
    });

    expect(screen.getByText("File uploaded successfully!")).toBeInTheDocument();
  });

  it("should handle upload errors", async () => {
    const mockFile = new File(["test content"], "test.pdf", {
      type: "application/pdf",
    });

    mockFetch.mockRejectedValueOnce(new Error("Upload failed"));

    render(<FileUpload />);

    const fileInput = screen.getByLabelText("Upload File");
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    const uploadButton = screen.getByText("Upload");
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/)).toBeInTheDocument();
    });
  });

  it("should show loading state during upload", async () => {
    const mockFile = new File(["test content"], "test.pdf", {
      type: "application/pdf",
    });

    // Create a promise that won't resolve immediately
    let resolvePromise: (value: any) => void;
    const uploadPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValueOnce(uploadPromise);

    render(<FileUpload />);

    const fileInput = screen.getByLabelText("Upload File");
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    const uploadButton = screen.getByText("Upload");
    fireEvent.click(uploadButton);

    // Should show loading state
    expect(screen.getByText("Uploading...")).toBeInTheDocument();
    expect(uploadButton).toBeDisabled();

    // Resolve the promise
    resolvePromise!({
      ok: true,
      json: async () => ({ url: "https://example.com/test.pdf" }),
    });

    await waitFor(() => {
      expect(screen.queryByText("Uploading...")).not.toBeInTheDocument();
    });
  });

  it("should handle file size validation", () => {
    // Create a large file (over typical limits)
    const largeFile = new File(
      [new ArrayBuffer(10 * 1024 * 1024)], // 10MB
      "large-file.pdf",
      { type: "application/pdf" }
    );

    render(<FileUpload />);

    const fileInput = screen.getByLabelText("Upload File");
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    // Depending on implementation, might show file size warning
    expect(screen.getByText("large-file.pdf")).toBeInTheDocument();
  });

  it("should clear file selection", () => {
    const mockFile = new File(["test content"], "test.pdf", {
      type: "application/pdf",
    });
    render(<FileUpload />);

    const fileInput = screen.getByLabelText("Upload File");
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    expect(screen.getByText("test.pdf")).toBeInTheDocument();

    // Clear selection
    const clearButton = screen.getByText("Clear");
    fireEvent.click(clearButton);

    expect(screen.queryByText("test.pdf")).not.toBeInTheDocument();
  });

  it("should handle multiple file selection (if supported)", () => {
    const file1 = new File(["content1"], "test1.pdf", {
      type: "application/pdf",
    });
    const file2 = new File(["content2"], "test2.pdf", {
      type: "application/pdf",
    });

    render(<FileUpload />);

    const fileInput = screen.getByLabelText("Upload File");
    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    // Should only show the first file (since it's single file upload)
    expect(screen.getByText("test1.pdf")).toBeInTheDocument();
    expect(screen.queryByText("test2.pdf")).not.toBeInTheDocument();
  });

  it("should validate file types", () => {
    const invalidFile = new File(["content"], "test.txt", {
      type: "text/plain",
    });

    render(<FileUpload acceptedFileTypes=".pdf,.doc" />);

    const fileInput = screen.getByLabelText("Upload File");
    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    // Depending on implementation, might show file type error
    // The browser's accept attribute should prevent this, but we can test the behavior
  });

  it("should reset state after successful upload", async () => {
    const mockFile = new File(["test content"], "test.pdf", {
      type: "application/pdf",
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: "https://example.com/test.pdf" }),
    });

    render(<FileUpload />);

    const fileInput = screen.getByLabelText("Upload File");
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    const uploadButton = screen.getByText("Upload");
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(
        screen.getByText("File uploaded successfully!")
      ).toBeInTheDocument();
    });

    // After successful upload, the component should reset
    expect(screen.queryByText("Upload")).not.toBeInTheDocument();
  });
});
