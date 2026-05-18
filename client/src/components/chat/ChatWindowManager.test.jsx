import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const useAuthMock = vi.fn();
const useChatMock = vi.fn();
const useSiteConfigMock = vi.fn();

vi.mock('../../context/AuthContext', () => ({ useAuth: () => useAuthMock() }));
vi.mock('../../context/ChatContext', () => ({ useChat: () => useChatMock() }));
vi.mock('../../context/SiteConfigContext', () => ({ useSiteConfig: () => useSiteConfigMock() }));
vi.mock('./ChatWindow', () => ({
  default: ({ userId, index }) => (
    <div data-testid="chat-window" data-userid={userId} data-index={index} />
  ),
}));

import ChatWindowManager from './ChatWindowManager';

function setWindowWidth(w) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
}

beforeEach(() => {
  setWindowWidth(1280);
  useAuthMock.mockReturnValue({ user: { _id: 'me' } });
  useChatMock.mockReturnValue({ openOrder: [] });
  useSiteConfigMock.mockReturnValue({ isSectionEnabled: () => true });
});

describe('<ChatWindowManager>', () => {
  it('renders nothing when no user is logged in', () => {
    useAuthMock.mockReturnValue({ user: null });
    const { container } = render(<ChatWindowManager />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when on mobile width (<960)', () => {
    setWindowWidth(800);
    const { container } = render(<ChatWindowManager />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when the dms section is disabled', () => {
    useSiteConfigMock.mockReturnValue({ isSectionEnabled: () => false });
    const { container } = render(<ChatWindowManager />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one ChatWindow per open conversation', () => {
    useChatMock.mockReturnValue({ openOrder: ['u1', 'u2', 'u3'] });
    const { container } = render(<ChatWindowManager />);
    const windows = container.querySelectorAll('[data-testid="chat-window"]');
    expect(windows.length).toBe(3);
    expect(windows[0].getAttribute('data-userid')).toBe('u1');
    expect(windows[1].getAttribute('data-index')).toBe('1');
  });

  it('renders nothing when there are no open chats', () => {
    const { container } = render(<ChatWindowManager />);
    // Returns React fragment with no children — first child should be null
    expect(container.firstChild).toBeNull();
  });
});
