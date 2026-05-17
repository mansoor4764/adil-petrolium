// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock window.matchMedia for Jest (JSDOM does not implement it).
// Direct assignment is used instead of Object.defineProperty because JSDOM
// may already define the property as non-configurable, causing defineProperty
// to silently fail and leave matchMedia returning undefined.
window.matchMedia = jest.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),    // deprecated but still called by some libs
  removeListener: jest.fn(), // deprecated but still called by some libs
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));
