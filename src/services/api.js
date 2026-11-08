import { client, isMock } from "../api/client";
import { backendApi } from './backend';

async function request(method, path, data) {
  // Keep the import behind a build-time condition so real builds omit demo data.
  if (import.meta.env.VITE_USE_MOCKS === "true")
    return (await import("../api/mock")).mockRequest(method, path, data);
  const response = await client.request({ method, url: path, data });
  return response.data &&
    typeof response.data === "object" &&
    "data" in response.data
    ? response.data.data
    : response.data;
}
const demoApi = {
  auth: {
    me: () => request("get", "/auth/me"),
    login: (data) => request("post", "/auth/login", data),
    register: (data) => request("post", "/auth/register", data),
    logout: () => request("post", "/auth/logout"),
    demo: (role) => {
      if (!isMock) throw new Error("Demo access is disabled.");
      return request("post", "/auth/demo", { role });
    },
  },
  courses: {
    list: () => request("get", "/courses"),
    get: (slug) => request("get", `/courses/${encodeURIComponent(slug)}`),
  },
  categories: () => request("get", "/categories"),
  cart: {
    get: () => request("get", "/cart"),
    add: (courseId) => request("post", "/cart/items", { courseId }),
    remove: (courseId) =>
      request("delete", `/cart/items/${encodeURIComponent(courseId)}`),
  },
  profile: {
    get: () => request("get", "/users/me"),
    update: (data) => request("patch", "/users/me", data),
    password: (data) => request("patch", "/users/me/password", data),
  },
  learning: {
    enrollments: () => request("get", "/enrollments/me"),
    course: (id) =>
      request("get", `/learning/courses/${encodeURIComponent(id)}`),
    lesson: (id, lessonId) =>
      request(
        "get",
        `/learning/courses/${encodeURIComponent(id)}/lessons/${encodeURIComponent(lessonId)}`,
      ),
    progress: (id, completed) =>
      request("patch", `/learning/lessons/${encodeURIComponent(id)}/progress`, {
        completed,
      }),
  },
  orders: {
    create: (data) => request("post", "/orders", data),
    mine: () => request("get", "/orders/me"),
  },
  admin: {
    stats: () => request("get", "/admin/stats"),
    courses: () => request("get", "/admin/courses"),
    createCourse: (data) => request("post", "/admin/courses", data),
    updateCourse: (id, data) =>
      request("patch", `/admin/courses/${encodeURIComponent(id)}`, data),
    deleteCourse: (id) =>
      request("delete", `/admin/courses/${encodeURIComponent(id)}`),
    users: () => request("get", "/admin/users"),
    orders: () => request("get", "/admin/orders"),
  },
};
export const api = isMock ? demoApi : backendApi;
