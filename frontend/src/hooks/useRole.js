import { useContext } from 'react';
import { UserContext } from '../UserContext';

const useRole = () => {
  const { user } = useContext(UserContext);

  const isAdminTotal = () => user?.rol === 'admin_total';
  const isAdminBasic = () => user?.rol === 'admin_basic';
  const isMiembro = () => user?.rol === 'miembro';

  return { isAdminTotal, isAdminBasic, isMiembro };
};

export default useRole;
