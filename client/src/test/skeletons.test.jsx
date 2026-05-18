import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import DatabaseSkeleton from '../pages/admin/DatabaseSkeleton';
import CompartidaSkeleton from '../pages/compartidas/CompartidaSkeleton';
import EventoSkeleton from '../pages/eventos/EventoSkeleton';
import FeedCardSkeleton from '../pages/me/FeedCardSkeleton';
import TableDetailSkeleton from '../pages/tables/TableDetailSkeleton';
import TorneoSkeleton from '../pages/torneos/TorneoSkeleton';
import ProfileSkeleton from '../pages/users/ProfileSkeleton';
import UsersListSkeleton from '../pages/users/UsersListSkeleton';

describe('Skeleton components — smoke render', () => {
  it.each([
    ['DatabaseSkeleton', DatabaseSkeleton],
    ['CompartidaSkeleton', CompartidaSkeleton],
    ['EventoSkeleton', EventoSkeleton],
    ['FeedCardSkeleton', FeedCardSkeleton],
    ['TableDetailSkeleton', TableDetailSkeleton],
    ['TorneoSkeleton', TorneoSkeleton],
    ['ProfileSkeleton', ProfileSkeleton],
    ['UsersListSkeleton', UsersListSkeleton],
  ])('<%s> renders without crashing', (_name, Skel) => {
    const { container } = render(<Skel />);
    expect(container.firstChild).toBeTruthy();
  });
});
