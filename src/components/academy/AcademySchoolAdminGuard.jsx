import { Navigate, Outlet } from "react-router-dom";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";
import AcademyLoadingScreen from "./AcademyLoadingScreen";

export default function AcademySchoolAdminGuard() {
  const { initializing, isSchoolAdmin } = useAcademyAuth();
  if (initializing) {
    return (
      <AcademyLoadingScreen
        title="Checking school access"
        subtitle="Verifying your school administrator permissions"
      />
    );
  }
  if (!isSchoolAdmin) return <Navigate to="/academy/dashboard" replace />;
  return <Outlet />;
}
