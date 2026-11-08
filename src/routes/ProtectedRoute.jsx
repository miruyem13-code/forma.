import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import {
  ButtonLink,
  EmptyState,
  ErrorState,
  Skeleton,
} from "../components/common/UI";
export default function ProtectedRoute({ admin = false }) {
  const { user, session } = useApp();
  const location = useLocation();
  if (session.isPending)
    return (
      <div className="container section">
        <Skeleton />
      </div>
    );
  if (session.isError)
    return <ErrorState error={session.error} retry={session.refetch} />;
  if (!user)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  if (admin && user.role !== "admin")
    return (
      <EmptyState
        title="This space is for administrators"
        description="Your account doesn’t have access to the admin workspace."
        action={<ButtonLink to="/dashboard">Go to your dashboard</ButtonLink>}
      />
    );
  return <Outlet />;
}
