export const DELETED_USER_LABEL = 'Usuario eliminado';

export function getUserDisplay(user) {
  if (!user || !user._id) {
    return { name: DELETED_USER_LABEL, isDeleted: true };
  }
  const name =
    user.displayName ||
    [user.nombre, user.apellido].filter(Boolean).join(' ') ||
    user.username ||
    DELETED_USER_LABEL;
  return {
    name,
    isDeleted: false,
    _id: user._id,
    username: user.username,
    avatar: user.avatar,
  };
}
