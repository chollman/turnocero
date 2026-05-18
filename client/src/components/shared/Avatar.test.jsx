import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Avatar from './Avatar';
import { makeUser } from '../../test/factories/users';

describe('<Avatar>', () => {
  it('renders an <img> when user has avatar.url', () => {
    const user = makeUser({
      username: 'cha',
      avatar: { url: 'https://x/y.webp', publicId: 'p' },
    });
    render(<Avatar user={user} size="md" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://x/y.webp');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('renders initials when there is no avatar', () => {
    const user = makeUser({ username: 'claudio' });
    render(<Avatar user={user} size="md" />);
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('renders two-letter initials when displayName has 2+ words', () => {
    const user = makeUser({ displayName: 'Claudio Hollman', username: 'cha' });
    render(<Avatar user={user} size="md" />);
    expect(screen.getByText('CH')).toBeInTheDocument();
  });

  it('renders the GhostIcon when user is null (deleted)', () => {
    const { container } = render(<Avatar user={null} size="md" />);
    // GhostIcon is an SVG
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario eliminado')).toBeInTheDocument();
  });

  it('renders the GhostIcon when user has no _id', () => {
    render(<Avatar user={{ username: 'orphan' }} size="md" />);
    expect(screen.getByLabelText('Usuario eliminado')).toBeInTheDocument();
  });

  it('applies the deterministic brand color based on _id', () => {
    const userA = makeUser({ _id: 'abc', username: 'a' });
    const userB = makeUser({ _id: 'abc', username: 'b' });
    const { container: cA } = render(<Avatar user={userA} size="md" />);
    const { container: cB } = render(<Avatar user={userB} size="md" />);
    // Both should pick the same color since hash uses _id, not username
    expect(cA.firstChild.getAttribute('style')).toBe(cB.firstChild.getAttribute('style'));
  });

  it('renders different sizes via classNames', () => {
    const user = makeUser({ username: 'a' });
    const { container: sm } = render(<Avatar user={user} size="sm" />);
    const { container: xl } = render(<Avatar user={user} size="xl" />);
    expect(sm.firstChild.className).not.toBe(xl.firstChild.className);
  });

  it('accepts a custom className', () => {
    const user = makeUser({ username: 'a' });
    const { container } = render(<Avatar user={user} size="md" className="custom-class" />);
    expect(container.firstChild.className).toContain('custom-class');
  });

  it('tolerates legacy string avatar (auto-normalized via getUserDisplay)', () => {
    const user = makeUser({ avatar: 'https://legacy/x.jpg' });
    render(<Avatar user={user} size="md" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://legacy/x.jpg');
  });
});
