import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";

export default function AcademyGuard() {
  const { user, loading } = useAcademyAuth();
  const location = useLocation();

  if (loading)
    return (
      <div className="grid min-h-screen place-items-center">
        Loading Academy...
      </div>
    );
  if (!user)
    return (
      <Navigate
        to="/academy/login"
        replace
        state={{ from: location.pathname }}
      />
    );

  return <Outlet />;
}
