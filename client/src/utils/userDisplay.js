export const DELETED_USER_LABEL = "Usuario eliminado";

function normalizeAvatar(avatar) {
  if (typeof avatar === "string") return { url: avatar, publicId: "", color: "" };
  if (avatar && typeof avatar === "object") {
    return {
      url: avatar.url || "",
      publicId: avatar.publicId || "",
      color: avatar.color || "",
    };
  }
  return { url: "", publicId: "", color: "" };
}

export function getUserDisplay(user) {
  if (!user || !user._id) {
    return {
      name: DELETED_USER_LABEL,
      isDeleted: true,
      avatar: { url: "", publicId: "", color: "" },
    };
  }
  const name =
    user.displayName ||
    [user.nombre, user.apellido].filter(Boolean).join(" ") ||
    user.username ||
    DELETED_USER_LABEL;
  return {
    name,
    isDeleted: false,
    _id: user._id,
    username: user.username,
    displayName: user.displayName,
    avatar: normalizeAvatar(user.avatar),
  };
}
