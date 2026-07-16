import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Firebase
vi.mock('./utils/firebase', () => ({
  db: {
    collection: vi.fn(),
    doc: vi.fn(),
    enablePersistence: vi.fn(),
  },
  firebase: {
    firestore: {
      FieldValue: {
        serverTimestamp: vi.fn(),
      },
      Timestamp: vi.fn(),
    },
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock navigator.standalone
Object.defineProperty(navigator, 'standalone', {
  writable: true,
  value: false,
});