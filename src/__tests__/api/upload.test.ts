import { POST } from "@/app/api/upload/route";
import { NextRequest } from "next/server";

// Mock the S3 client
jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn(),
}));

describe("/api/upload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should handle file upload successfully", async () => {
    const mockFile = new File(["file content"], "test.pdf", {
      type: "application/pdf",
    });
    const formData = new FormData();
    formData.append("file", mockFile);

    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.fileUrl).toBeDefined();
  });

  it("should handle missing file", async () => {
    const formData = new FormData();
    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("No file provided");
  });

  it("should handle invalid file type", async () => {
    const mockFile = new File(["file content"], "test.exe", {
      type: "application/exe",
    });
    const formData = new FormData();
    formData.append("file", mockFile);

    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Invalid file type");
  });

  it("should handle file size limit", async () => {
    const largeContent = "x".repeat(10 * 1024 * 1024); // 10MB
    const mockFile = new File([largeContent], "large.pdf", {
      type: "application/pdf",
    });
    const formData = new FormData();
    formData.append("file", mockFile);

    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain("File too large");
  });

  it("should handle S3 upload errors", async () => {
    // Mock S3 to throw error
    const { S3Client } = require("@aws-sdk/client-s3");
    S3Client.mockImplementation(() => ({
      send: jest.fn().mockRejectedValue(new Error("S3 Error")),
    }));

    const mockFile = new File(["file content"], "test.pdf", {
      type: "application/pdf",
    });
    const formData = new FormData();
    formData.append("file", mockFile);

    const request = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Upload failed");
  });

  it("should generate unique file names", async () => {
    const mockFile1 = new File(["content1"], "test.pdf", {
      type: "application/pdf",
    });
    const mockFile2 = new File(["content2"], "test.pdf", {
      type: "application/pdf",
    });

    const formData1 = new FormData();
    formData1.append("file", mockFile1);

    const formData2 = new FormData();
    formData2.append("file", mockFile2);

    const request1 = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData1,
    });

    const request2 = new NextRequest("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData2,
    });

    const response1 = await POST(request1);
    const response2 = await POST(request2);

    const data1 = await response1.json();
    const data2 = await response2.json();

    expect(data1.fileUrl).not.toBe(data2.fileUrl);
  });

  it("should handle different file types", async () => {
    const fileTypes = [
      { name: "test.pdf", type: "application/pdf" },
      { name: "test.doc", type: "application/msword" },
      {
        name: "test.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      { name: "test.txt", type: "text/plain" },
    ];

    for (const fileType of fileTypes) {
      const mockFile = new File(["content"], fileType.name, {
        type: fileType.type,
      });
      const formData = new FormData();
      formData.append("file", mockFile);

      const request = new NextRequest("http://localhost:3000/api/upload", {
        method: "POST",
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    }
  });
});
