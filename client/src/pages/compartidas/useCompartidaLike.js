import { useEffect, useRef, useState } from "react";
import axios from "axios";

// Hook que encapsula el toggle de "me gusta" de una compartida.
//
// Reemplaza el bloque que vivía en CompartidaCard: 3 useStates (liked,
// likeCount, heartPopping) + handleLike con optimistic update + rollback
// + popping timeout. Como la UI del like aparece DOS veces en
// CompartidaCard (featured broadside y normal card), tener la lógica en
// un hook evita drift.
//
// Optimistic: actualizamos la UI antes del POST y revertimos si falla.
// Heart pop: timer 350ms de animación cuando pasa de no-liked a liked.
//
// Si el caller no tiene `user` autenticado, expone `requiresLogin: true`
// y `toggle()` no llama al server — el caller debe mostrar el prompt
// de login antes de invocar.

export function useCompartidaLike({ post, user }) {
  const [liked, setLiked] = useState(() =>
    user && post?.likes
      ? post.likes.some((l) => (l._id || l).toString() === user._id.toString())
      : false,
  );
  const [count, setCount] = useState(post?.likes?.length ?? 0);
  const [popping, setPopping] = useState(false);
  const popTimer = useRef(null);

  useEffect(
    () => () => {
      if (popTimer.current) clearTimeout(popTimer.current);
    },
    [],
  );

  const toggle = async () => {
    if (!user) return { requiresLogin: true };
    const prevLiked = liked;
    const prevCount = count;
    setLiked(!prevLiked);
    setCount(prevCount + (prevLiked ? -1 : 1));
    if (!prevLiked) {
      setPopping(true);
      if (popTimer.current) clearTimeout(popTimer.current);
      popTimer.current = setTimeout(() => setPopping(false), 350);
    }
    try {
      await axios.post(`/api/compartidas/${post._id}/like`);
      return { requiresLogin: false };
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
      return { requiresLogin: false };
    }
  };

  return {
    liked,
    count,
    popping,
    requiresLogin: !user,
    toggle,
  };
}
