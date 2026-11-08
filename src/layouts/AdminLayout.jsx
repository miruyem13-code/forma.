import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  ChevronLeft,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
  Settings,
  ShoppingBag,
  Users,
  Video,
} from "lucide-react";
import { useApp } from "../hooks/useApp";
import { initials } from "../utils/format";
export default function AdminLayout() {
  const { user } = useApp();
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="eyebrow">FORMA WORKSPACE</span>
          <h2>A place to grow.</h2>
        </div>
        <nav aria-label="Admin navigation">
          {[
            [LayoutDashboard, "Overview", ""],
            [BookOpen, "Courses", "/courses"],
            [Video, "Lessons", "/lessons"],
            [FolderOpen, "Categories", "/categories"],
            [Users, "Users", "/users"],
            [ShoppingBag, "Orders", "/orders"],
            [MessageSquare, "Reviews", "/reviews"],
            [BarChart3, "Analytics", "/analytics"],
            [Settings, "Settings", "/settings"],
          ].map(([Icon, label, path]) => (
            <NavLink key={label} to={`/admin${path}`} end>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <span className="avatar">{initials(user.name)}</span>
          <div>
            <strong>{user.name}</strong>
            <small>Administrator</small>
          </div>
        </div>
        <NavLink className="text-link" to="/dashboard">
          <ChevronLeft size={16} />
          Back to learning
        </NavLink>
      </aside>
      <div className="admin-main">
        <Outlet />
      </div>
    </div>
  );
}
