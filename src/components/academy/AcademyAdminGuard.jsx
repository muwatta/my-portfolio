import { Navigate, Outlet } from "react-router-dom";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";

export default function AcademyAdminGuard() {
  const { initializing, isAdmin } = useAcademyAuth();
  if (initializing) {
    return (
      <div className="grid min-h-screen place-items-center">
        Checking administrator access...
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/academy/dashboard" replace />;
  return <Outlet />;
}
