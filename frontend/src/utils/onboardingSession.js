export const hasAssignedCommunity = (user) =>
  Boolean(user?.comunidad_id || user?.comunidadId);

export const normalizeOnboardingUser = (user = {}) => ({
  ...user,
  comunidadId: user.comunidadId || user.comunidad_id
});

export const completeOnboardingSession = async ({ data, login }) => {
  if (!data?.token || typeof login !== 'function') {
    throw new Error('Não foi possível confirmar a sessão do onboarding');
  }

  const completedUser = await login(data.token, data.user || null);

  if (!hasAssignedCommunity(completedUser)) {
    throw new Error('A comunidade não foi confirmada pelo backend');
  }

  return normalizeOnboardingUser(completedUser);
};
