import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/server';

// Mocks BEFORE importing UserProfile — leaflet crashes in jsdom.
vi.mock('leaflet', () => ({
  default: {
    map: () => ({
      remove: () => {},
      setView: () => {},
      on: () => {},
    }),
    tileLayer: () => ({ addTo: () => {} }),
    divIcon: () => ({}),
    marker: () => ({
      addTo: () => ({ on: () => {}, setLatLng: () => {}, setIcon: () => {} }),
      on: () => {},
      setLatLng: () => {},
      setIcon: () => {},
    }),
  },
}));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../context/SiteConfigContext', () => ({ useSiteConfig: vi.fn() }));
vi.mock('../../context/ThemeContext', () => ({ useTheme: vi.fn() }));
vi.mock('../../context/NotificationContext', () => ({ useNotifications: vi.fn() }));

// AvatarCropModal: skip the real react-easy-crop flow and immediately confirm with a fake blob.
vi.mock('../../components/shared/AvatarCropModal', () => ({
  default: ({ open, onConfirm, onCancel }) => {
    if (!open) return null;
    return (
      <div role="dialog" aria-label="crop-mock">
        <button onClick={() => onConfirm(new Blob(['x'], { type: 'image/jpeg' }))}>
          mock-confirm
        </button>
        <button onClick={onCancel}>mock-cancel</button>
      </div>
    );
  },
}));

// MiBgWatchCard — not relevant to avatar tests; stub.
vi.mock('./MiBgWatchCard', () => ({
  default: () => null,
}));

import UserProfile from './UserProfile';
import { useAuth } from '../../context/AuthContext';
import { useSiteConfig } from '../../context/SiteConfigContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';

function setup({
  user = { _id: 'u1', username: 'cha', email: 'cha@test.local' },
  refreshUser = vi.fn(),
  updateProfile = vi.fn(),
} = {}) {
  useAuth.mockReturnValue({ user, updateProfile, refreshUser });
  useSiteConfig.mockReturnValue({ isSectionEnabled: () => true });
  useTheme.mockReturnValue({ theme: 'dark', setTheme: vi.fn() });
  useNotifications.mockReturnValue({ addToast: vi.fn() });

  return render(
    <MemoryRouter>
      <UserProfile />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // Default MSW handler — successful avatar upload returning updated user shape.
  server.use(
    http.put('/api/auth/avatar', () =>
      HttpResponse.json({
        _id: 'u1',
        username: 'cha',
        avatar: { url: 'https://mock/users/u1/avatar.webp', publicId: 'users/u1/avatar' },
      }),
    ),
    http.delete('/api/auth/avatar', () =>
      HttpResponse.json({ _id: 'u1', username: 'cha', avatar: { url: '', publicId: '' } }),
    ),
  );
});

describe('<UserProfile> — Avatar section', () => {
  it('shows "Subir avatar" when user has no avatar', () => {
    setup({ user: { _id: 'u1', username: 'cha', email: 'a@b.com', avatar: { url: '', publicId: '' } } });
    expect(screen.getByRole('button', { name: /subir avatar/i })).toBeInTheDocument();
    // No "Quitar avatar" when there is no avatar
    expect(screen.queryByRole('button', { name: /quitar avatar/i })).not.toBeInTheDocument();
  });

  it('shows "Cambiar avatar" + "Quitar avatar" when user has an avatar', () => {
    setup({
      user: { _id: 'u1', username: 'cha', email: 'a@b.com', avatar: { url: 'https://x/y.webp', publicId: 'users/u1/avatar' } },
    });
    expect(screen.getByRole('button', { name: /cambiar avatar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quitar avatar/i })).toBeInTheDocument();
  });

  it('rejects an unsupported file type before opening the crop modal', () => {
    const { container } = setup();
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText(/Solo se permiten imágenes JPG, PNG o WEBP/i)).toBeInTheDocument();
    // Crop modal should NOT open
    expect(screen.queryByRole('dialog', { name: 'crop-mock' })).not.toBeInTheDocument();
  });

  it('rejects files over 5 MB before opening the crop modal', () => {
    const { container } = setup();
    // 6 MB blob
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [big] } });
    expect(screen.getByText(/no puede superar los 5 MB/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'crop-mock' })).not.toBeInTheDocument();
  });

  it('opens the crop modal when a valid image is picked, then calls refreshUser on confirm', async () => {
    const refreshUser = vi.fn();
    const { container } = setup({ refreshUser });

    const file = new File([new Uint8Array(1024)], 'a.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    // Crop modal opens
    expect(screen.getByRole('dialog', { name: 'crop-mock' })).toBeInTheDocument();

    // Confirm the crop → triggers axios.put('/api/auth/avatar', ...)
    fireEvent.click(screen.getByRole('button', { name: 'mock-confirm' }));

    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
  });

  it('cancel from the crop modal clears the file without calling the API', () => {
    const refreshUser = vi.fn();
    const { container } = setup({ refreshUser });

    const file = new File([new Uint8Array(1024)], 'a.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByRole('dialog', { name: 'crop-mock' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'mock-cancel' }));
    expect(screen.queryByRole('dialog', { name: 'crop-mock' })).not.toBeInTheDocument();
    expect(refreshUser).not.toHaveBeenCalled();
  });

  it('"Quitar avatar" calls DELETE /api/auth/avatar after window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const refreshUser = vi.fn();
    setup({
      user: { _id: 'u1', username: 'cha', email: 'a@b.com', avatar: { url: 'https://x', publicId: 'p' } },
      refreshUser,
    });

    fireEvent.click(screen.getByRole('button', { name: /quitar avatar/i }));

    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/quitar tu avatar/i));
    confirmSpy.mockRestore();
  });

  it('"Quitar avatar" canceled via confirm does nothing', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const refreshUser = vi.fn();
    setup({
      user: { _id: 'u1', username: 'cha', email: 'a@b.com', avatar: { url: 'https://x', publicId: 'p' } },
      refreshUser,
    });

    fireEvent.click(screen.getByRole('button', { name: /quitar avatar/i }));
    expect(refreshUser).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('shows API error when upload fails', async () => {
    server.use(
      http.put('/api/auth/avatar', () =>
        HttpResponse.json({ message: 'Error al subir avatar' }, { status: 500 }),
      ),
    );
    const { container } = setup();

    const file = new File([new Uint8Array(1024)], 'a.jpg', { type: 'image/jpeg' });
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'mock-confirm' }));

    expect(await screen.findByText(/Error al subir avatar/i)).toBeInTheDocument();
  });
});

describe('UserProfile — Reconciliar todo con BGG', () => {
  const connectedUser = {
    _id: 'u1',
    username: 'cha',
    email: 'cha@test.local',
    bggUsername: 'rahdo',
    bggConnected: true,
    bggInvalid: false,
    bggConnectedAt: '2026-05-01T00:00:00Z',
    bggSync: null,
  };

  it('shows the "Reconciliar todo con BGG" button when the user is connected', () => {
    setup({ user: connectedUser });
    expect(screen.getByRole('button', { name: /reconciliar todo con bgg/i })).toBeInTheDocument();
  });

  it('does NOT show the button when the user is not connected', () => {
    setup({ user: { ...connectedUser, bggConnected: false } });
    expect(screen.queryByRole('button', { name: /reconciliar todo con bgg/i })).not.toBeInTheDocument();
  });

  it('calls POST /api/bgg/sync on click and shows a per-bucket success breakdown', async () => {
    let calledWith = null;
    server.use(
      http.post('/api/bgg/sync', async ({ request }) => {
        calledWith = request.url;
        return HttpResponse.json({
          success: true,
          inserted: 5,
          updated: 2,
          deleted: 1,
          total: 247,
          pages: 9,
          lastFullSyncAt: '2026-05-19T12:00:00Z',
        });
      }),
    );
    const refreshUser = vi.fn();
    setup({ user: connectedUser, refreshUser });

    fireEvent.click(screen.getByRole('button', { name: /reconciliar todo con bgg/i }));
    await waitFor(() => {
      expect(refreshUser).toHaveBeenCalled();
    });
    expect(calledWith).toContain('/api/bgg/sync');
    expect(
      await screen.findByText(/reconciliadas 247 partidas \(5 nuevas, 2 actualizadas, 1 borradas\)/i)
    ).toBeInTheDocument();
  });

  it('says "sin cambios" when reconcile returned 0 inserts/updates/deletes', async () => {
    server.use(
      http.post('/api/bgg/sync', () =>
        HttpResponse.json({
          success: true,
          inserted: 0, updated: 0, deleted: 0,
          total: 247, pages: 9,
          lastFullSyncAt: '2026-05-19T12:00:00Z',
        }),
      ),
    );
    setup({ user: connectedUser });
    fireEvent.click(screen.getByRole('button', { name: /reconciliar todo con bgg/i }));
    expect(await screen.findByText(/reconciliadas 247 partidas \(sin cambios\)/i)).toBeInTheDocument();
  });

  it('shows last full reconcile time + count as relative timestamp', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    setup({
      user: {
        ...connectedUser,
        bggSync: {
          lastFullSyncAt: oneHourAgo,
          lastFullSyncCount: 312,
        },
      },
    });
    expect(screen.getByText(/última reconciliación completa/i)).toBeInTheDocument();
    expect(screen.getByText(/hace 1 h · 312 partidas/i)).toBeInTheDocument();
  });

  it('shows last probe time + outcome label', () => {
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    setup({
      user: {
        ...connectedUser,
        bggSync: {
          lastFullSyncAt: '2026-05-01T00:00:00Z',
          lastFullSyncCount: 312,
          lastProbedAt: twoMinAgo,
          lastProbeOutcome: 'no_drift',
        },
      },
    });
    expect(screen.getByText(/última verificación/i)).toBeInTheDocument();
    expect(screen.getByText(/hace 2 min · ✓ sin cambios/i)).toBeInTheDocument();
  });

  it('shows reconciled outcome label when applicable', () => {
    setup({
      user: {
        ...connectedUser,
        bggSync: {
          lastFullSyncAt: new Date().toISOString(),
          lastFullSyncCount: 100,
          lastProbedAt: new Date().toISOString(),
          lastProbeOutcome: 'reconciled',
        },
      },
    });
    expect(screen.getByText(/✓ reconciliado/i)).toBeInTheDocument();
  });

  it('shows API error when sync fails', async () => {
    server.use(
      http.post('/api/bgg/sync', () =>
        HttpResponse.json({ message: 'BGG offline' }, { status: 502 }),
      ),
    );
    setup({ user: connectedUser });
    fireEvent.click(screen.getByRole('button', { name: /reconciliar todo con bgg/i }));
    expect(await screen.findByText('BGG offline')).toBeInTheDocument();
  });
});
