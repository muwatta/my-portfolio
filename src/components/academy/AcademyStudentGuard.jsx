import { Navigate, Outlet } from "react-router-dom";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";

export default function AcademyStudentGuard() {
  const { loading, profileLoading, isAdmin, isTeacher } = useAcademyAuth();
  if (loading || profileLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        Checking Academy access...
      </div>
    );
  }
  if (isAdmin || isTeacher) return <Navigate to="/academy/admin" replace />;
  return <Outlet />;
}
