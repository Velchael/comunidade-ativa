import { useContext } from 'react';
import { UserContext } from '../UserContext';
import {
  canManageCommunity,
  isAdminTotalGlobal
} from '../utils/permissions';

const useRole = () => {
  const { user } = useContext(UserContext);

  const isAdminTotal = () => isAdminTotalGlobal(user);
  const isAdminBasic = () => canManageCommunity(user) && !isAdminTotalGlobal(user);
  const isMiembro = () => !isAdminTotal() && !isAdminBasic();

  return { isAdminTotal, isAdminBasic, isMiembro };
};

export default useRole;
