import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Download, Info, Search, Star } from "lucide-react";
import { api } from "../../services/api";
import { isMock } from "../../api/client";
import { useApp } from "../../hooks/useApp";
import { useCategories } from "../../hooks/useCourses";
import {
  Badge,
  Button,
  EmptyState,
  Modal,
  PageHeading,
  QueryState,
} from "../../components/common/UI";
import { downloadText, initials } from "../../utils/format";
import { OrderTable } from "./Overview";
import { BackendCategories, BackendReviews, UserRoleEditor } from './BackendManagement';

export function AdminUsers() {
  const query = useQuery({
    queryKey: ["admin-users"],
    queryFn: api.admin.users,
  });
  const courses = useQuery({
    queryKey: ["admin-courses"],
    queryFn: api.admin.courses,
  });
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [selected, setSelected] = useState(null);
  const filtered = (query.data || []).filter(
    (user) =>
      `${user.name} ${user.email}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (role === "all" || role === user.role),
  );
  return (
    <>
      <PageHeading
        eyebrow="THE PEOPLE BEHIND THE PROGRESS"
        title="Your learning community"
        description="Find learners and explore their enrollment information."
      />
      <div className="card admin-table-card">
        <div className="admin-table-toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              placeholder="Search name or email"
              aria-label="Search users"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            aria-label="Filter by role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="all">All roles</option>
            <option value="student">Students</option>
            <option value="admin">Administrators</option>
          </select>
        </div>
        <QueryState query={query}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Enrollments</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="table-user">
                        <span className="avatar">{initials(user.name)}</span>
                        <div>
                          <strong>{user.name}</strong>
                          <small>{user.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge>{user.role}</Badge>
                    </td>
                    <td>{user.joined}</td>
                    <td>{user.enrollments?.length ?? "—"}</td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setSelected(user)}
                      >
                        View details <ArrowRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && (
            <EmptyState
              title="No matching learners"
              description="Try another search or role filter."
            />
          )}
        </QueryState>
      </div>
      {selected && (
        <Modal title="Learner details" onClose={() => setSelected(null)}>
          <div className="modal-user">
            <span className="avatar large">{initials(selected.name)}</span>
            <div>
              <h3>{selected.name}</h3>
              <p>{selected.email}</p>
            </div>
          </div>
          {isMock && <h3>Enrolled courses</h3>}
          {selected.enrollments?.length ? (
            selected.enrollments.map((item) => (
              <div className="enrollment-row" key={item.courseId}>
                <span>
                  {courses.data?.find((course) => course.id === item.courseId)
                    ?.title || item.courseId}
                </span>
                <small>
                  {item.completedLessons?.length || 0} lessons completed
                </small>
              </div>
            ))
          ) : (
            isMock && <p className="muted">No enrolled courses.</p>
          )}
          {!isMock ? <UserRoleEditor key={selected.id} user={selected} onSaved={() => setSelected(null)} /> : <div className="info-note">
            <Info size={18} />
            <span>
              Role: <strong>{selected.role}</strong>. Role changes require an
              authorized backend endpoint, which is not part of the current API
              contract.
            </span>
          </div>}
        </Modal>
      )}
    </>
  );
}
export function AdminOrders() {
  const query = useQuery({
    queryKey: ["admin-orders"],
    queryFn: api.admin.orders,
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = (query.data || []).filter(
    (order) =>
      `${order.id} ${order.user} ${order.course}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (status === "all" || order.status === status),
  );
  const exportCsv = () => {
    const cell = (value) =>
      `"${String(value)
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`;
    downloadText(
      "forma-orders.csv",
      [
        "Order,Learner,Course,Total,Status,Date",
        ...filtered.map((order) =>
          [
            order.id,
            order.user,
            order.course,
            order.total,
            order.status,
            order.date,
          ]
            .map(cell)
            .join(","),
        ),
      ].join("\r\n"),
      "text/csv",
    );
  };
  return (
    <>
      <PageHeading
        eyebrow="PURCHASE ACTIVITY"
        title="Orders"
        description={
          isMock
            ? "Illustrative records only. These do not represent real transactions."
            : "Payment and order statuses reported by your backend."
        }
        action={
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={!filtered.length}
          >
            <Download size={16} />
            Export CSV
          </Button>
        }
      />
      <div className="card admin-table-card">
        <div className="admin-table-toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search orders"
              aria-label="Search orders"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Order status"
          >
            <option value="all">All statuses</option>
            {[...new Set((query.data || []).map((order) => order.status))].map(
              (item) => (
                <option key={item}>{item}</option>
              ),
            )}
          </select>
        </div>
        <QueryState query={query}>
          <OrderTable orders={filtered} />
        </QueryState>
      </div>
    </>
  );
}
export function AdminCategories() {
  return isMock ? <DemoCategories /> : <BackendCategories />;
}
function DemoCategories() {
  const query = useCategories();
  return (
    <>
      <PageHeading
        eyebrow="MAKE DISCOVERY EASY"
        title="Categories"
        description="An overview of the topics in your course library."
      />
      <div className="info-note">
        <Info size={18} />
        Category editing needs additional backend endpoints. You can assign
        existing categories in the course editor.
      </div>
      <QueryState query={query}>
        <div className="category-page-grid">
          {query.data?.map((category) => (
            <div className="card padded" key={category.id}>
              <h2>{category.name}</h2>
              <p className="muted">{category.description}</p>
              <Badge>{category.count} courses</Badge>
              <Link
                to={`/courses?category=${category.id}`}
                className="text-link"
              >
                View catalog <ArrowRight size={16} />
              </Link>
            </div>
          ))}
        </div>
      </QueryState>
    </>
  );
}
export function AdminReviews() {
  return isMock ? <DemoReviews /> : <BackendReviews />;
}
function DemoReviews() {
  const query = useQuery({
    queryKey: ["admin-courses"],
    queryFn: api.admin.courses,
  });
  const [search, setSearch] = useState("");
  const reviews = (query.data || [])
    .flatMap((course) =>
      course.reviews.map((review) => ({ ...review, course: course.title })),
    )
    .filter((review) =>
      `${review.name} ${review.text} ${review.course}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  return (
    <>
      <PageHeading
        eyebrow="LISTEN, LEARN, IMPROVE"
        title="Learner reviews"
        description="A closer look at what your community has to say."
      />
      <div className="info-note">
        <Info size={18} />
        Review moderation requires backend endpoints. Reviews are read-only in
        this workspace.
      </div>
      <div className="search-input review-search">
        <Search size={18} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search reviews"
          aria-label="Search reviews"
        />
      </div>
      <QueryState query={query}>
        <div className="admin-reviews">
          {reviews.map((review) => (
            <article className="card padded" key={review.id}>
              <div className="review-heading">
                <strong>{review.name}</strong>
                <span className="rating">
                  <Star size={15} fill="currentColor" />
                  {review.rating}
                </span>
              </div>
              <small className="muted">{review.course}</small>
              <p>{review.text}</p>
              <small className="muted">{review.date}</small>
            </article>
          ))}
        </div>
        {!reviews.length && (
          <EmptyState
            title="No reviews found"
            description="Reviews will appear here as learners share their feedback."
          />
        )}
      </QueryState>
    </>
  );
}
export function AdminSettings() {
  const { theme, setTheme } = useApp();
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORKSPACE, YOUR WAY"
        title="Settings"
        description="Appearance and integration information for this workspace."
      />
      <section className="card padded settings-card">
        <h2>Appearance</h2>
        <p className="muted">
          Choose the theme that feels right for you. This preference is saved on
          this device.
        </p>
        <div className="theme-options">
          {["light", "dark"].map((option) => (
            <button
              className={`theme-option ${theme === option ? "selected" : ""}`}
              key={option}
              onClick={() => setTheme(option)}
              aria-pressed={theme === option}
            >
              <span className={`theme-swatch ${option}`}>
                <i />
                <i />
                <i />
              </span>
              {option} mode
            </button>
          ))}
        </div>
      </section>
      <section className="card padded settings-card">
        <h2>Integration status</h2>
        <dl className="profile-details">
          <div>
            <dt>Data source</dt>
            <dd>
              {isMock
                ? "Demo adapter · browser-local sample data"
                : "Backend API"}
            </dd>
          </div>
          <div>
            <dt>API base URL</dt>
            <dd>
              <code>
                {import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1"}
              </code>
            </dd>
          </div>
          <div>
            <dt>Authentication</dt>
            <dd>
              {isMock
                ? "Demo identity only; passwords are not stored or verified"
                : "HTTP-only session cookies via withCredentials"}
            </dd>
          </div>
          <div>
            <dt>Payments</dt>
            <dd>Unavailable · provider integration required</dd>
          </div>
        </dl>
        <p className="muted">
          Production configuration is managed through deployment environment
          variables. See the project README for the integration contract.
        </p>
      </section>
    </>
  );
}
