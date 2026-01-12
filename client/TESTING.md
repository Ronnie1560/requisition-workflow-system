# PCM Requisition System - Testing Guide

**Date:** January 12, 2026  
**Status:** ✅ Testing Infrastructure Configured

---

## 📋 Overview

This guide covers the automated testing setup for the PCM Requisition System. The project uses **Vitest** with **React Testing Library** for comprehensive testing.

---

## 🛠️ Testing Stack

| Tool | Purpose | Version |
|------|---------|---------|
| Vitest | Test runner (Vite-native) | ^4.0.16 |
| @testing-library/react | React component testing | Latest |
| @testing-library/jest-dom | DOM matchers | Latest |
| @testing-library/user-event | User interaction simulation | Latest |
| jsdom | Browser environment simulation | Latest |
| @vitest/coverage-v8 | Code coverage reporting | Latest |

---

## 🚀 Quick Start

### Running Tests

```bash
# Run all tests once
npm run test:run

# Run tests in watch mode (development)
npm run test:watch

# Run tests with UI dashboard
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Interactive test mode
npm test
```

---

## 📁 Project Structure

```
client/
├── src/
│   ├── test/
│   │   ├── setup.js              # Test environment setup
│   │   ├── utils.jsx             # Test utilities and helpers
│   │   └── mocks/
│   │       └── supabase.js       # Supabase client mock
│   │
│   ├── components/
│   │   └── notifications/
│   │       └── Toast.test.jsx    # Component tests
│   │
│   ├── hooks/
│   │   └── useOrganizationSettings.test.js
│   │
│   ├── services/
│   │   └── api/
│   │       └── requisitions.test.js
│   │
│   └── utils/
│       ├── logger.test.js        # Utility tests
│       └── formatters.test.js    # Formatter tests
│
├── coverage/                     # Coverage reports (generated)
└── vite.config.js               # Vitest configuration
```

---

## 📝 Test File Naming

Test files should be named using one of these patterns:
- `*.test.js` / `*.test.jsx`
- `*.spec.js` / `*.spec.jsx`

Place test files:
- **Co-located**: Next to the file being tested (recommended)
- **Centralized**: In a `__tests__` folder within each directory

---

## 🎯 Writing Tests

### Basic Test Structure

```javascript
import { describe, it, expect } from 'vitest'

describe('MyComponent', () => {
  it('should render correctly', () => {
    // Arrange
    const props = { title: 'Hello' }
    
    // Act
    const result = myFunction(props)
    
    // Assert
    expect(result).toBe('expected value')
  })
})
```

### Testing React Components

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MyComponent from './MyComponent'

describe('MyComponent', () => {
  it('should render title', () => {
    render(<MyComponent title="Hello" />)
    
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('should handle click events', async () => {
    const handleClick = vi.fn()
    render(<MyComponent onClick={handleClick} />)
    
    fireEvent.click(screen.getByRole('button'))
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### Testing Hooks

```javascript
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useMyHook } from './useMyHook'

describe('useMyHook', () => {
  it('should return initial state', () => {
    const { result } = renderHook(() => useMyHook())
    
    expect(result.current.value).toBe('initial')
  })

  it('should update state', async () => {
    const { result } = renderHook(() => useMyHook())
    
    act(() => {
      result.current.setValue('new value')
    })
    
    await waitFor(() => {
      expect(result.current.value).toBe('new value')
    })
  })
})
```

---

## 🧪 Mocking

### Mocking Supabase

```javascript
import { vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: '1', name: 'Test' },
        error: null
      })
    }))
  }
}))
```

### Mocking API Calls

```javascript
import { vi } from 'vitest'
import * as api from '../services/api/requisitions'

vi.spyOn(api, 'getRequisitions').mockResolvedValue({
  data: [{ id: '1', title: 'Test Requisition' }],
  error: null
})
```

---

## 📊 Coverage

### Viewing Coverage Reports

After running `npm run test:coverage`:

1. **Terminal**: Summary displayed in console
2. **HTML Report**: Open `coverage/index.html` in browser
3. **JSON**: Available at `coverage/coverage-final.json`

### Coverage Thresholds (Recommended)

Add to `vite.config.js` for enforcement:

```javascript
test: {
  coverage: {
    thresholds: {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60
    }
  }
}
```

---

## ✅ Current Test Status

### Test Summary (January 12, 2026)

| Category | Tests | Status |
|----------|-------|--------|
| Utilities (logger.js) | 16 | ✅ Passing |
| Utilities (formatters.js) | 24 | ✅ Passing |
| Hooks (useOrganizationSettings) | 7 | ✅ Passing |
| Components (Toast) | 9 | ✅ Passing |
| API Services (requisitions) | 16 | ✅ Passing |
| **Total** | **72** | ✅ **All Passing** |

### Coverage Summary

- **Statements**: ~37%
- **Branches**: ~27%
- **Functions**: ~46%
- **Lines**: ~39%

---

## 🎯 Testing Best Practices

### 1. Test Behavior, Not Implementation
```javascript
// ✅ Good: Tests observable behavior
expect(screen.getByText('Welcome')).toBeInTheDocument()

// ❌ Avoid: Testing internal state
expect(component.state.isLoading).toBe(false)
```

### 2. Use Descriptive Test Names
```javascript
// ✅ Good
it('should display error message when form is submitted with empty fields')

// ❌ Avoid
it('handles errors')
```

### 3. Follow AAA Pattern
```javascript
it('should calculate total correctly', () => {
  // Arrange
  const items = [{ price: 100 }, { price: 200 }]
  
  // Act
  const total = calculateTotal(items)
  
  // Assert
  expect(total).toBe(300)
})
```

### 4. Clean Up After Tests
```javascript
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
```

---

## 🔧 Configuration

### vite.config.js

```javascript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
})
```

---

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library Cheatsheet](https://testing-library.com/docs/react-testing-library/cheatsheet)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)

---

## 🚧 Future Enhancements

1. **E2E Testing**: Add Playwright or Cypress for end-to-end tests
2. **Visual Regression**: Add Storybook + Chromatic for UI testing
3. **CI/CD Integration**: Add GitHub Actions workflow for automated testing
4. **Performance Testing**: Add Lighthouse CI for performance benchmarks
