// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// Mock window.matchMedia (needed for useIsMobile hook)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}

  observe() {
    return null;
  }

  disconnect() {
    return null;
  }

  unobserve() {
    return null;
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}

  observe() {
    return null;
  }

  disconnect() {
    return null;
  }

  unobserve() {
    return null;
  }
};

// Mock fetch for API tests
global.fetch = jest.fn();

// Mock Next.js Request and Response for Edge Runtime API testing
global.Request = class Request {
  constructor(input, init) {
    this.url = typeof input === "string" ? input : input.url;
    this.method = init?.method || "GET";
    this.headers = new Map();

    if (init?.headers) {
      if (init.headers instanceof Map) {
        this.headers = new Map(init.headers);
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => this.headers.set(key, value));
      } else {
        Object.entries(init.headers).forEach(([key, value]) =>
          this.headers.set(key, value)
        );
      }
    }
  }

  get(name) {
    return this.headers.get(name);
  }
};

global.Response = class Response {
  constructor(body, init) {
    this.body = body;
    this.status = init?.status || 200;
    this.statusText = init?.statusText || "OK";
    this.headers = new Map();

    if (init?.headers) {
      Object.entries(init.headers).forEach(([key, value]) =>
        this.headers.set(key, value)
      );
    }
  }

  static json(data, init) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
  }
};
