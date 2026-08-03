import { useMemo } from "react";
import { useBggUsernamesMapQuery } from "../../queries/bgWatch";

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
// `{ bggUsernameLower → turnoceroUser }` for any players that are TurnoCero
// members. Refetches only when the set of usernames changes.
//
// `turnoceroUser` shape: { _id, username, displayName, avatar, bggUsername }
export default function useBggUserMap(plays) {
  const usernames = useMemo(() => extractBggUsernames(plays), [plays]);
  const { data } = useBggUsernamesMapQuery(usernames);
  return data ?? {};
}
