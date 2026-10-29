import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import { UserProvider } from '../contexts/UserContext';

// Mock user context wrapper
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return <UserProvider>{children}</UserProvider>;
  };

  return render(ui, { wrapper: Wrapper, ...options });
}

// Helper to wait for async operations
export const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock Neon Auth client
export const mockNeonAuthClient = {
  getSession: vi.fn(),
  signIn: {
    email: vi.fn(),
  },
  signUp: {
    email: vi.fn(),
  },
  signOut: vi.fn(),
  emailOtp: {
    sendVerificationOtp: vi.fn(),
    resetPassword: vi.fn(),
  },
  token: vi.fn(),
};

// Mock team backend
export const mockTeamBackend = {
  getStatus: vi.fn(),
  loadState: vi.fn(),
  sendCommand: vi.fn(),
};

// Generate test UUID
export const generateTestId = (prefix: string) => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Date helpers
export const getTestDate = (daysOffset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString();
};

export const getTestDateShort = (daysOffset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
};
