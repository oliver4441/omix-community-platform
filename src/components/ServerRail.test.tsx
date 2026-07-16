import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServerRail } from '../components/ServerRail';

vi.mock('../utils/store', () => ({
  Store: {
    servers: [],
    isAdmin: false,
    currentServerId: 'server1',
    subscribeServers: vi.fn(),
    createServer: vi.fn(),
    deleteServer: vi.fn(),
    cleanup: vi.fn(),
  },
  SESSION_ID: 'test-session',
  getUserColor: vi.fn(() => '#5865f2'),
}));

describe('ServerRail', () => {
  it('renders without crashing', () => {
    render(<ServerRail isMobile={false} currentView="servers" onDMClick={vi.fn()} />);
    expect(screen.getByText('Omix Community')).toBeInTheDocument();
  });
});