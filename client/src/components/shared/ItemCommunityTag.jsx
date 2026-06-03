import { useContext } from "react";
import { CommunityContext } from "../../context/CommunityContext";
import CommunityBadge from "./CommunityBadge";

// Etiqueta de comunidad para un item del feed combinado (mesa, evento, torneo,
// compartida, etc). Se muestra SOLO cuando el usuario está viendo más de una
// comunidad a la vez — si ve una sola, no hay nada que distinguir.
//
// Lee el CommunityContext con useContext (no useCommunity()) para ser null-safe:
// las cards renderizadas en tests sin <CommunityProvider> devuelven null en vez
// de tirar. `communityId` puede venir como ObjectId crudo o como objeto poblado.
export default function ItemCommunityTag({ communityId, className }) {
  const ctx = useContext(CommunityContext);
  if (!ctx) return null;
  const { effectiveViewing, communityById } = ctx;
  if (!communityId) return null;
  if ((effectiveViewing?.length || 0) <= 1) return null;
  const id = String(communityId?._id || communityId);
  const community = communityById?.get(id);
  if (!community) return null;
  return <CommunityBadge community={community} className={className} />;
}
