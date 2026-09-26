import { Navigate, Outlet } from "react-router-dom";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";
import AcademyLoadingScreen from "./AcademyLoadingScreen";

export default function AcademyStudentGuard() {
  const { initializing, isAdmin, isTeacher } = useAcademyAuth();
  if (initializing) {
    return (
      <AcademyLoadingScreen
        title="Opening your learning space"
        subtitle="Loading your course and progress"
      />
    );
  }
  if (isAdmin) return <Navigate to="/academy/admin" replace />;
  if (isTeacher) return <Navigate to="/academy/teacher" replace />;
  return <Outlet />;
}
