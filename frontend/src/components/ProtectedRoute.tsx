import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getSession } from '../utils/api';

interface ProtectedRouteProps {
  allowedRole: 'admin' | 'user';
  children?: React.ReactNode;
}

const homeFor = (role: 'admin' | 'user') =>
  role === 'admin' ? '/admin/dashboard' : '/dashboard-cliente';

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRole,
  children,
}) => {
  const location = useLocation();
  const user = getSession();

  // Sem sessão válida (sem token, token expirado ou estado inconsistente):
  // getSession() já limpou o storage — aqui só mandamos para o login.
  if (!user) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  if (user.role !== allowedRole) {
    return <Navigate to={homeFor(user.role)} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
