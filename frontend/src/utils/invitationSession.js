const PENDING_INVITATION_KEY = 'comuva.pendingInvitationPath';
const INVITATION_PATH_PATTERN = /^\/convite\/[^/?#]+$/;

export const savePendingInvitation = (path) => {
  if (!INVITATION_PATH_PATTERN.test(path || '')) return false;

  sessionStorage.setItem(PENDING_INVITATION_KEY, path);
  return true;
};

export const getPendingInvitation = () => {
  const path = sessionStorage.getItem(PENDING_INVITATION_KEY);

  if (!INVITATION_PATH_PATTERN.test(path || '')) {
    sessionStorage.removeItem(PENDING_INVITATION_KEY);
    return null;
  }

  return path;
};

export const clearPendingInvitation = () => {
  sessionStorage.removeItem(PENDING_INVITATION_KEY);
};
