import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Shield,
  ShoppingBag,
  Sun,
  User,
  X,
} from "lucide-react";
import { useApp } from "../../hooks/useApp";
import { initials } from "../../utils/format";
import { isMock } from "../../api/client";

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Forma home">
      <span className="logo-mark">
        <i />
        <i />
        <i />
      </span>
      forma<span className="logo-period">.</span>
    </Link>
  );
}
export default function Header() {
  const { user, cart, theme, setTheme, logout } = useApp();
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);
  const navigate = useNavigate();
  const search = (event) => {
    event.preventDefault();
    navigate(
      `/courses?q=${encodeURIComponent(new FormData(event.currentTarget).get("q"))}`,
    );
    setMenu(false);
  };
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      {isMock && (
        <div className="demo-banner">
          <span>
            <span className="status-dot" />
            Demo workspace · Explore freely. No real payments.
          </span>
          <Link to="/login">
            Try a demo account <ArrowUpRight size={12} />
          </Link>
        </div>
      )}
      <header className="site-header">
        <div className="header-inner">
          <Logo />
          <nav className="desktop-nav" aria-label="Main navigation">
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/courses">Courses</NavLink>
            <NavLink to="/categories">Categories</NavLink>
            <NavLink to="/my-learning">My Learning</NavLink>
          </nav>
          <form className="header-search" onSubmit={search}>
            <Search size={17} />
            <input
              name="q"
              aria-label="Search courses"
              placeholder="What do you want to learn?"
            />
          </form>
          <div className="header-actions">
            <button
              className="icon-button theme-toggle"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <Link
              className="icon-button cart-icon"
              to="/cart"
              aria-label={`Shopping cart, ${cart.length} courses`}
            >
              <ShoppingBag size={20} />
              {cart.length > 0 && (
                <span className="cart-badge">{cart.length}</span>
              )}
            </Link>
            {user ? (
              <div className="profile-menu">
                <button
                  className="avatar-button"
                  onClick={() => setProfile(!profile)}
                  aria-expanded={profile}
                  aria-label="Account menu"
                >
                  <span className="avatar">{initials(user.name)}</span>
                  <ChevronDown size={14} />
                </button>
                {profile && (
                  <>
                    <button
                      className="menu-backdrop"
                      aria-label="Close account menu"
                      onClick={() => setProfile(false)}
                    />
                    <div className="dropdown">
                      <div className="dropdown-identity">
                        <strong>{user.name}</strong>
                        <small>{user.email}</small>
                      </div>
                      {[
                        [LayoutDashboard, "Dashboard", "/dashboard"],
                        [User, "My profile", "/profile"],
                        ...(user.role === "admin"
                          ? [[Shield, "Admin workspace", "/admin"]]
                          : []),
                      ].map(([Icon, label, to]) => (
                        <Link
                          key={to}
                          to={to}
                          onClick={() => setProfile(false)}
                        >
                          <Icon size={16} />
                          {label}
                        </Link>
                      ))}
                      <button
                        onClick={() => {
                          setProfile(false);
                          logout();
                        }}
                      >
                        <LogOut size={16} />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <Link className="login-link" to="/login">
                  Log in
                </Link>
                <Link className="btn btn-primary header-signup" to="/register">
                  Get started <ArrowUpRight size={15} />
                </Link>
              </>
            )}
            <button
              className="icon-button mobile-toggle"
              onClick={() => setMenu(!menu)}
              aria-label="Toggle navigation"
              aria-expanded={menu}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {[
              ["Home", "/"],
              ["Courses", "/courses"],
              ["Categories", "/categories"],
              ["My Learning", "/my-learning"],
              ["Dashboard", "/dashboard"],
              ["Profile", "/profile"],
              ...(!user ? [["Log in", "/login"], ["Create account", "/register"]] : []),
            ].map(([label, to]) => (
              <Link key={to} to={to} onClick={() => setMenu(false)}>
                {label}
              </Link>
            ))}
            <form className="search-input" onSubmit={search}>
              <Search size={17} />
              <input
                name="q"
                placeholder="Search courses"
                aria-label="Search courses"
              />
              <button type="submit" aria-label="Submit search">
                <ArrowUpRight size={18} />
              </button>
            </form>
          </nav>
        )}
      </header>
    </>
  );
}
