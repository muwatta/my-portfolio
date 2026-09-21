import { Navigate, Outlet } from "react-router-dom";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";

export default function AcademyTeacherGuard() {
  const { loading, profileLoading, isTeacher } = useAcademyAuth();
  if (loading || profileLoading)
    return (
      <div className="grid min-h-screen place-items-center">
        Checking teacher access...
      </div>
    );
  if (!isTeacher) return <Navigate to="/academy/dashboard" replace />;
  return <Outlet />;
}
