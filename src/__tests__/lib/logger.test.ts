import { getLogger, configure } from "@/lib/logger";

// Mock log4js
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  fatal: jest.fn(),
};

const mockGetLogger = jest.fn(() => mockLogger);
const mockConfigure = jest.fn();

jest.mock("log4js", () => ({
  getLogger: mockGetLogger,
  configure: mockConfigure,
}));

describe("logger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getLogger", () => {
    it("should create a logger with the specified category", () => {
      const logger = getLogger("test-category");

      expect(mockGetLogger).toHaveBeenCalledWith("test-category");
      expect(logger).toBeDefined();
    });

    it("should return the same logger instance for the same category", () => {
      const logger1 = getLogger("same-category");
      const logger2 = getLogger("same-category");

      expect(logger1).toBe(logger2);
    });

    it("should create different loggers for different categories", () => {
      mockGetLogger
        .mockReturnValueOnce({ ...mockLogger, category: "cat1" })
        .mockReturnValueOnce({ ...mockLogger, category: "cat2" });

      const logger1 = getLogger("category1");
      const logger2 = getLogger("category2");

      expect(mockGetLogger).toHaveBeenCalledWith("category1");
      expect(mockGetLogger).toHaveBeenCalledWith("category2");
      expect(logger1).not.toBe(logger2);
    });

    it("should handle logger options", () => {
      const options = { level: "debug" };
      getLogger("test-category", options);

      // The logger should be created with the category
      expect(mockGetLogger).toHaveBeenCalledWith("test-category");
    });

    it("should cache loggers to avoid recreation", () => {
      // First call
      getLogger("cached-category");

      // Second call
      getLogger("cached-category");

      // Should only call mockGetLogger once due to caching
      expect(mockGetLogger).toHaveBeenCalledTimes(1);
    });
  });

  describe("logger methods", () => {
    let logger: any;

    beforeEach(() => {
      logger = getLogger("test-logger");
    });

    it("should have info method", () => {
      logger.info("test message", { data: "test" });

      expect(mockLogger.info).toHaveBeenCalledWith("test message", {
        data: "test",
      });
    });

    it("should have warn method", () => {
      logger.warn("warning message");

      expect(mockLogger.warn).toHaveBeenCalledWith("warning message");
    });

    it("should have error method", () => {
      const error = new Error("test error");
      logger.error("error message", error);

      expect(mockLogger.error).toHaveBeenCalledWith("error message", error);
    });

    it("should have debug method", () => {
      logger.debug("debug message");

      expect(mockLogger.debug).toHaveBeenCalledWith("debug message");
    });

    it("should have trace method", () => {
      logger.trace("trace message");

      expect(mockLogger.trace).toHaveBeenCalledWith("trace message");
    });

    it("should have fatal method", () => {
      logger.fatal("fatal message");

      expect(mockLogger.fatal).toHaveBeenCalledWith("fatal message");
    });
  });

  describe("configure", () => {
    it("should call log4js configure with provided config", () => {
      const config = {
        appenders: {
          console: { type: "console" },
        },
        categories: {
          default: { appenders: ["console"], level: "info" },
        },
      };

      configure(config);

      expect(mockConfigure).toHaveBeenCalledWith(config);
    });

    it("should handle empty configuration", () => {
      configure();

      expect(mockConfigure).toHaveBeenCalledWith(undefined);
    });
  });

  describe("logger instance methods", () => {
    it("should handle multiple arguments in log methods", () => {
      const logger = getLogger("multi-arg-test");

      logger.info("message", "arg1", "arg2", { key: "value" });

      expect(mockLogger.info).toHaveBeenCalledWith("message", "arg1", "arg2", {
        key: "value",
      });
    });

    it("should handle objects and primitives", () => {
      const logger = getLogger("object-test");

      const obj = { user: "john", id: 123 };
      logger.error("User error", obj, "additional info");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "User error",
        obj,
        "additional info"
      );
    });
  });
});
