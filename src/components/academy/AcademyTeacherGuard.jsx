import { Navigate, Outlet } from "react-router-dom";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";

export default function AcademyTeacherGuard() {
  const { initializing, isTeacher, isAdmin } = useAcademyAuth();
  if (initializing)
    return (
      <div className="grid min-h-screen place-items-center">
        Checking teacher access...
      </div>
    );
  if (!isTeacher && !isAdmin)
    return <Navigate to="/academy/dashboard" replace />;
  return <Outlet />;
}
