// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jspdf (via iobuffer) requires TextEncoder/TextDecoder which jsdom doesn't provide.
// Polyfill them from Node's built-in 'util' module.
const { TextEncoder, TextDecoder } = require('util');
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}

// CRA sets resetMocks: true in its internal jest config, which wipes mock
// implementations between every test. We must re-apply the matchMedia mock
// before each test so window.matchMedia(...) never returns undefined.
const mockMatchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),    // deprecated but still called by some libs
  removeListener: jest.fn(), // deprecated but still called by some libs
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

// Apply once at module load time
window.matchMedia = jest.fn().mockImplementation(mockMatchMedia);

// Re-apply before every test because CRA's resetMocks: true wipes implementations
beforeEach(() => {
  window.matchMedia = jest.fn().mockImplementation(mockMatchMedia);
});
