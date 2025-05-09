import React, { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "./button";
import { Spinner } from "./spinner";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerProps {
  file: string | File;
  onDownload?: () => void;
}

export function PDFViewer({ file, onDownload }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
  }

  function nextPage() {
    if (pageNumber < (numPages || 1)) {
      setPageNumber(pageNumber + 1);
    }
  }

  function prevPage() {
    if (pageNumber > 1) {
      setPageNumber(pageNumber - 1);
    }
  }

  function zoomIn() {
    setScale((prev) => Math.min(2, prev + 0.1));
  }

  function zoomOut() {
    setScale((prev) => Math.max(0.5, prev - 0.1));
  }

  return (
    <div className="flex flex-col items-center">
      <div className="bg-muted rounded-lg p-4 mb-4 flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={prevPage}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {pageNumber} of {numPages || "-"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={nextPage}
            disabled={pageNumber >= (numPages || 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          {onDownload && (
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="h-4 w-4 mr-1" /> Download
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-auto max-h-[800px] w-full flex justify-center bg-white">
        {loading && (
          <div className="flex items-center justify-center min-h-[400px]">
            <Spinner size="lg" />
          </div>
        )}
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<Spinner size="lg" />}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>
      </div>
    </div>
  );
}
