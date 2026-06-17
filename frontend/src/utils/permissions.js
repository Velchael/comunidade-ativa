export const isAdminTotalGlobal = (user) =>
  user?.rol_global === 'admin_total' || user?.rol === 'admin_total';

export const isLocalAdminBasic = (user) =>
  user?.rol_comunidad === 'admin_basic';

export const isLocalModerator = (user) =>
  user?.rol_comunidad === 'moderador';

export const isCommunityOwner = (user) =>
  user?.is_owner === true;

export const canManageCommunity = (user) =>
  isAdminTotalGlobal(user) ||
  isCommunityOwner(user) ||
  isLocalAdminBasic(user) ||
  user?.can_manage_comunidad === true;

export const canViewCommunityMembers = (user) =>
  isAdminTotalGlobal(user) ||
  isCommunityOwner(user) ||
  isLocalAdminBasic(user);

export const hasLocalModerationTools = (user) =>
  isAdminTotalGlobal(user) ||
  isCommunityOwner(user) ||
  isLocalAdminBasic(user) ||
  isLocalModerator(user);
