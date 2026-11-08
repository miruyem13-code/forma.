import { Component, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  AlertCircle,
  BookOpen,
  LoaderCircle,
  X,
} from "lucide-react";

export function Button({
  children,
  variant = "primary",
  loading,
  disabled,
  className = "",
  ...props
}) {
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      disabled={loading || disabled}
      {...props}
    >
      {loading && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function ButtonLink({
  children,
  to,
  variant = "primary",
  className = "",
  ...props
}) {
  return (
    <Link className={`btn btn-${variant} ${className}`} to={to} {...props}>
      {children}
    </Link>
  );
}
export function Badge({ children, className = "" }) {
  return <span className={`badge ${className}`}>{children}</span>;
}
export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  description,
  to,
  linkText = "Explore all courses",
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {to && (
        <Link to={to} className="text-link">
          {linkText}
          <ArrowRight size={17} />
        </Link>
      )}
    </div>
  );
}
export function Skeleton({ cards = 4 }) {
  return (
    <div className="course-grid" aria-label="Loading content" role="status">
      {Array.from({ length: cards }, (_, i) => (
        <div className="card skeleton-card" key={i}>
          <div className="skeleton skeleton-cover" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
          <div className="skeleton skeleton-line" />
        </div>
      ))}
    </div>
  );
}
export function ErrorState({ error, retry }) {
  return (
    <div className="empty-state" role="alert">
      <div className="empty-icon">
        <AlertCircle />
      </div>
      <h2>Let’s try that again</h2>
      <p>{error?.message || "We couldn’t load this content."}</p>
      {retry && <Button onClick={retry}>Try again</Button>}
      <Link to="/" className="text-link">
        Back to home <ArrowRight size={16} />
      </Link>
    </div>
  );
}
export function EmptyState({
  title = "A fresh start",
  description,
  action,
  icon: Icon = BookOpen,
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={28} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function QueryState({ query, children }) {
  if (query.isPending) return <Skeleton />;
  if (query.isError)
    return <ErrorState error={query.error} retry={query.refetch} />;
  return children;
}
export function Progress({ value }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label="Course progress"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${value}%` }} />
    </div>
  );
}
export function Field({ label, error, children, hint }) {
  return (
    <div className="field">
      <label>
        {label}
        {children}
      </label>
      {hint && <small>{hint}</small>}
      {error && (
        <span className="field-error" role="alert">
          {error.message || error}
        </span>
      )}
    </div>
  );
}
export function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="modal-title"
      onClick={(event) => {
        if (event.target === ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
          type="button"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <div className="container section">
        <div className="empty-state" role="alert">
          <div className="empty-icon"><AlertCircle /></div>
          <h2>Let’s start fresh.</h2>
          <p>An unexpected error occurred. Reload the page to try again.</p>
          <Button onClick={() => window.location.reload()}>Reload page</Button>
          <a className="text-link" href="/">Back to home <ArrowRight size={16} /></a>
        </div>
      </div>
    ) : (
      this.props.children
    );
  }
}
