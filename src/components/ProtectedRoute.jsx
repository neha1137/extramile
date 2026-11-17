import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { loading, isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="auth-loading"><div className="auth-loading-mark"/><p>Opening your Extra Mile space…</p></div>;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (allowedRoles?.length && !allowedRoles.includes(role)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return children;
}
