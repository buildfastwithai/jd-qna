# Testing Documentation

This document provides an overview of the testing setup and guidelines for the JD-QNA platform.

## Overview

The platform uses a comprehensive testing strategy with multiple layers:

- **Unit Tests**: Testing individual functions, components, and hooks
- **Integration Tests**: Testing API routes and component interactions
- **Mocking**: Extensive mocking of external dependencies

## Test Stack

- **Jest**: Testing framework
- **React Testing Library**: Component testing utilities
- **@testing-library/jest-dom**: DOM testing matchers
- **Supertest**: API route testing
- **MSW**: Mock Service Worker for API mocking

## Test Structure

```
src/__tests__/
├── api/                    # API route tests
│   ├── dashboard.test.ts
│   ├── records/
│   └── excel-questions/
├── components/             # Component tests
│   ├── FileUpload.test.tsx
│   └── ui/
├── hooks/                  # Custom hook tests
│   ├── useDashboard.test.ts
│   ├── use-mobile.test.ts
│   └── useRegeneration.test.ts
├── lib/                    # Utility function tests
│   ├── utils.test.ts
│   └── logger.test.ts
├── mocks/                  # Mock implementations
│   └── prisma.ts
└── utils/                  # Test utilities
    ├── test-utils.tsx
    └── api-test-utils.ts
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for CI
npm run test:ci
```

## Test Configuration

### Jest Configuration (`jest.config.js`)

- Uses Next.js Jest setup
- TypeScript support
- Module path mapping
- Coverage collection
- Test environment: jsdom

### Setup Files (`jest.setup.js`)

- Testing Library matchers
- Next.js mocks (router, image)
- Global mocks (fetch, ResizeObserver, etc.)
- Environment variables

## Writing Tests

### API Route Tests

```typescript
import { GET } from "@/app/api/route";
import { mockPrisma, resetMocks } from "../utils/api-test-utils";

describe("/api/route", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("should handle successful requests", async () => {
    mockPrisma.model.findMany.mockResolvedValue(mockData);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
```

### Component Tests

```typescript
import { render, screen, fireEvent } from "../utils/test-utils";
import { Component } from "@/components/Component";

describe("Component", () => {
  it("should render correctly", () => {
    render(<Component prop="value" />);

    expect(screen.getByText("Expected Text")).toBeInTheDocument();
  });

  it("should handle user interactions", () => {
    const mockCallback = jest.fn();
    render(<Component onAction={mockCallback} />);

    fireEvent.click(screen.getByRole("button"));
    expect(mockCallback).toHaveBeenCalled();
  });
});
```

### Hook Tests

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { useCustomHook } from "@/hooks/useCustomHook";

describe("useCustomHook", () => {
  it("should return expected values", () => {
    const { result } = renderHook(() => useCustomHook());

    expect(result.current.value).toBe(expected);
  });
});
```

## Mock Utilities

### Database Mocking

The `mockPrisma` object provides mocked Prisma client methods:

```typescript
import { mockPrisma, createMockSkillRecord } from "../utils/api-test-utils";

// Mock database responses
mockPrisma.skillRecord.findMany.mockResolvedValue([createMockSkillRecord()]);
```

### Factory Functions

Use factory functions for consistent test data:

```typescript
const mockSkill = createMockSkill({
  name: "Custom Skill",
  level: "ADVANCED",
});
```

## Best Practices

### Test Organization

1. **Group related tests**: Use `describe` blocks for logical grouping
2. **Clear test names**: Use descriptive test names that explain the scenario
3. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification

### Mocking Strategy

1. **Mock external dependencies**: Database, APIs, file system
2. **Use realistic mock data**: Create data that resembles production
3. **Reset mocks**: Clean up between tests to avoid interference

### Coverage Goals

- **API Routes**: 100% line coverage
- **Components**: 90%+ line coverage
- **Hooks**: 100% line coverage
- **Utilities**: 100% line coverage

### Testing Scenarios

Always test:

- **Happy path**: Normal successful execution
- **Error handling**: Network errors, validation errors
- **Edge cases**: Empty data, null values, boundary conditions
- **Loading states**: Async operations and loading indicators
- **User interactions**: Clicks, form submissions, navigation

## Continuous Integration

Tests run automatically on:

- Pull requests
- Main branch pushes
- Scheduled runs

Coverage reports are generated and should be reviewed for gaps.

## Troubleshooting

### Common Issues

1. **Module resolution**: Check path mappings in `jest.config.js`
2. **Async tests**: Use `waitFor` for async operations
3. **Mock cleanup**: Ensure mocks are reset between tests
4. **Environment variables**: Check setup in `jest.setup.js`

### Debug Tips

```bash
# Run specific test file
npm test -- --testNamePattern="specific test"

# Run tests with verbose output
npm test -- --verbose

# Debug mode
npm test -- --detectOpenHandles --forceExit
```
