import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API } from '../../api/endpoints';

// Collect unique lowercased BGG usernames from the players of a list of plays.
export function extractBggUsernames(plays) {
  if (!Array.isArray(plays)) return [];
  const set = new Set();
  for (const play of plays) {
    for (const p of play?.players || []) {
      if (p?.username) set.add(String(p.username).toLowerCase());
    }
  }
  return [...set];
}

// Given a list of BG Watch plays, returns a memoized map of
// `{ bggUsernameLower → turnoceroUser }` for any players that are Turnocero
// members. Refetches only when the set of usernames changes.
//
// `turnoceroUser` shape: { _id, username, displayName, avatar, bggUsername }
export default function useBggUserMap(plays) {
  const usernames = useMemo(() => extractBggUsernames(plays), [plays]);
  // Stable key so React only re-runs the effect when the set actually changes.
  const usernamesKey = useMemo(() => usernames.slice().sort().join(','), [usernames]);
  const [userMap, setUserMap] = useState({});

  useEffect(() => {
    if (usernames.length === 0) {
      setUserMap({});
      return;
    }
    let cancelled = false;
    axios.post(API.users.BY_BGG_USERNAMES, { usernames })
      .then(({ data }) => {
        if (cancelled || !Array.isArray(data)) return;
        const map = {};
        for (const u of data) {
          if (u.bggUsername) map[u.bggUsername.toLowerCase()] = u;
        }
        setUserMap(map);
      })
      .catch(() => {
        if (!cancelled) setUserMap({});
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usernamesKey]);

  return userMap;
}
