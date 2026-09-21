import { Navigate, Outlet } from "react-router-dom";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";

export default function AcademyAdminGuard() {
  const { loading, profileLoading, isAdmin } = useAcademyAuth();
  if (loading || profileLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        Checking administrator access...
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/academy/dashboard" replace />;
  return <Outlet />;
}
