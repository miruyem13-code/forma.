import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BookOpen,
  DollarSign,
  ShoppingBag,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../services/api";
import { isMock } from "../../api/client";
import { money } from "../../utils/format";
import { Badge, PageHeading, QueryState } from "../../components/common/UI";

export function RevenueChart({ data }) {
  return (
    <div
      className="revenue-chart"
      role="img"
      aria-label="Monthly revenue chart. Values are also available in the table below."
    >
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6b61e8" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#6b61e8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="4 4"
            vertical={false}
            stroke="var(--border)"
          />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
            tickFormatter={(value) => money(value)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
            }}
            formatter={(value) => [money(value), "Revenue"]}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#6b61e8"
            strokeWidth={3}
            fill="url(#revenueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function OrderTable({ orders }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Learner</th>
            <th>Course</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="table-strong">{order.id}</td>
              <td>{order.user}</td>
              <td className="table-course-title">{order.course}</td>
              <td>{money(order.total)}</td>
              <td>
                <Badge className={order.status === "paid" ? "green" : ""}>
                  {order.status === "sample" ? "Demo record" : order.status}
                </Badge>
              </td>
              <td>{order.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!orders.length && <p className="table-empty">No orders to show.</p>}
    </div>
  );
}
export default function Overview({ analytics = false }) {
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: api.admin.stats,
  });
  const orders = useQuery({
    queryKey: ["admin-orders"],
    queryFn: api.admin.orders,
  });
  const courses = useQuery({
    queryKey: ["admin-courses"],
    queryFn: api.admin.courses,
  });
  return (
    <>
      <PageHeading
        eyebrow="THE BIG PICTURE"
        title={
          analytics ? "Analytics & insights" : "Welcome to your workspace."
        }
        description={
          analytics
            ? "A closer look at how your learning community is growing."
            : "Here’s what’s happening in your learning community."
        }
        action={<Badge>{isMock ? "Sample analytics" : "Live workspace"}</Badge>}
      />
      <QueryState query={stats}>
        {stats.data && (
          <>
            <div className="stats-grid">
              {[
                [Users, "Total users", stats.data.users],
                [BookOpen, "Total courses", stats.data.courses],
                [ShoppingBag, "Total orders", stats.data.orders],
                [DollarSign, "Revenue", money(stats.data.revenue)],
              ].map(([Icon, label, value]) => (
                <div className="card stat-card" key={label}>
                  <span className="stat-icon">
                    <Icon size={21} />
                  </span>
                  <div>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                </div>
              ))}
            </div>
            <div className="admin-chart-grid">
              <section className="card chart-card">
                <div className="section-heading">
                  <div>
                    <h2>Revenue over time</h2>
                    <p>
                      {isMock
                        ? "Illustrative monthly data · not actual transactions"
                        : "Monthly revenue reported by the backend"}
                    </p>
                  </div>
                  <span className="badge">6 months</span>
                </div>
                <RevenueChart data={stats.data.chart || []} />
                <details className="chart-data">
                  <summary>View chart data</summary>
                  <table>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Revenue</th>
                        <th>Students</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.data.chart?.map((row) => (
                        <tr key={row.month}>
                          <td>{row.month}</td>
                          <td>{money(row.revenue)}</td>
                          <td>{row.students}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </section>
              <section className="card popular-admin">
                <h2>Popular courses</h2>
                <QueryState query={courses}>
                  {[...(courses.data || [])]
                    .sort((a, b) => b.students - a.students)
                    .slice(0, 4)
                    .map((course, index) => (
                      <Link to={`/admin/courses/${course.id}`} key={course.id}>
                        <span>0{index + 1}</span>
                        <div>
                          <strong>{course.title}</strong>
                          <small>
                            {course.students.toLocaleString()} learners
                          </small>
                        </div>
                        <ArrowRight size={16} />
                      </Link>
                    ))}
                </QueryState>
              </section>
            </div>
          </>
        )}
      </QueryState>
      <section className="card admin-table-card">
        <div className="section-heading">
          <h2>Recent orders</h2>
          <Link to="/admin/orders" className="text-link">
            View all <ArrowRight size={15} />
          </Link>
        </div>
        <QueryState query={orders}>
          <OrderTable orders={orders.data || []} />
        </QueryState>
      </section>
    </>
  );
}
