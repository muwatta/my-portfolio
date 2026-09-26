import { Navigate, Outlet } from "react-router-dom";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";

export default function AcademyStudentGuard() {
  const { initializing, isAdmin, isTeacher } = useAcademyAuth();
  if (initializing) {
    return (
      <div className="grid min-h-screen place-items-center">
        Checking Academy access...
      </div>
    );
  }
  if (isAdmin) return <Navigate to="/academy/admin" replace />;
  if (isTeacher) return <Navigate to="/academy/teacher" replace />;
  return <Outlet />;
}
