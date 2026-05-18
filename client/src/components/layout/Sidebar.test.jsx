import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../context/NotificationContext', () => ({ useNotifications: vi.fn() }));
vi.mock('../../context/SiteConfigContext', () => ({ useSiteConfig: vi.fn() }));

import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useSiteConfig } from '../../context/SiteConfigContext';

function setup({
  user = { _id: 'u1', username: 'cha', bggUsername: '' },
  isActuallyAdmin = false,
  logout = vi.fn(),
  unreadCount = 0,
  adminChatUnread = 0,
  sections = {},
  pathname = '/',
} = {}) {
  useAuth.mockReturnValue({ user, isActuallyAdmin, logout });
  useNotifications.mockReturnValue({ unreadCount, adminChatUnread });
  useSiteConfig.mockReturnValue({
    isSectionEnabled: (k) => sections[k] ?? true,
  });
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe('<Sidebar>', () => {
  it('renders the TurnoCero brand + user chip', () => {
    setup();
    expect(screen.getByText('TurnoCero')).toBeInTheDocument();
    expect(screen.getByText('cha')).toBeInTheDocument();
  });

  it('shows the notifications bell with unread badge when count > 0', () => {
    setup({ unreadCount: 5 });
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('caps the bell badge at "9+" when above 9', () => {
    setup({ unreadCount: 42 });
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('hides admin-only items from non-admins', () => {
    setup({ isActuallyAdmin: false });
    expect(screen.queryByRole('link', { name: /panel admin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /base de datos/i })).not.toBeInTheDocument();
  });

  it('shows admin-only items to actual admins', () => {
    setup({ isActuallyAdmin: true });
    expect(screen.getByRole('link', { name: /panel admin/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /base de datos/i })).toBeInTheDocument();
  });

  it('hides sections whose SiteConfig flag is false', () => {
    setup({ sections: { eventos: false } });
    expect(screen.queryByRole('link', { name: /^eventos$/i })).not.toBeInTheDocument();
  });

  it('shows "Activá BG Watch" CTA for users without bggUsername (when bgwatch enabled)', () => {
    setup({ user: { _id: 'u1', username: 'cha' }, sections: { bgwatch: true } });
    expect(screen.getByRole('link', { name: /activ[aá] bg watch/i })).toBeInTheDocument();
  });

  it('shows BG Watch link when user has bggUsername', () => {
    setup({
      user: { _id: 'u1', username: 'cha', bggUsername: 'CarcaFan' },
      sections: { bgwatch: true },
    });
    expect(screen.getByRole('link', { name: /bg watch/i })).toHaveAttribute(
      'href', '/bg-watch/CarcaFan',
    );
  });

  it('marks the active nav item based on pathname', () => {
    setup({ pathname: '/eventos' });
    const eventos = screen.getByRole('link', { name: /^eventos$/i });
    expect(eventos.className).toMatch(/active/i);
  });

  it('shows the adminChat badge when admin has unread admin chat messages', () => {
    setup({ isActuallyAdmin: true, adminChatUnread: 3 });
    // The badge text "3" should be in DOM (next to the chat-admin nav item).
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });
});
