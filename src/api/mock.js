import { courses, categories, demoUsers, revenue, demoOrders } from "./seed";

const KEY = "forma-demo-v1";
const fresh = () => ({
  courses: structuredClone(courses),
  users: structuredClone(demoUsers),
  session: null,
  carts: {},
  enrollments: {
    u1: [
      {
        courseId: "c1",
        completedLessons: ["c1-1", "c1-2", "c1-3"],
        certificate: null,
      },
      { courseId: "c2", completedLessons: ["c2-1"], certificate: null },
      { courseId: "c7", completedLessons: [], certificate: null },
    ],
    u2: [{ courseId: "c1", completedLessons: ["c1-1"], certificate: null }],
  },
});
let state;
try {
  state = JSON.parse(localStorage.getItem(KEY)) || fresh();
} catch {
  state = fresh();
}
const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const fail = (message, status = 400) => {
  const error = new Error(message);
  error.response = { status };
  throw error;
};
const user = () => state.users.find((item) => item.id === state.session);
const requireUser = () => user() || fail("Please sign in to continue.", 401);
const admin = () => {
  if (requireUser().role !== "admin")
    fail("Administrator access is required.", 403);
};
const findCourse = (id) =>
  state.courses.find((item) => item.id === id || item.slug === id) ||
  fail("This course could not be found.", 404);
const enrollment = (id) =>
  (state.enrollments[requireUser().id] || []).find(
    (item) => item.courseId === id,
  ) || fail("You must be enrolled to access this course.", 403);
const cartKey = () => user()?.id || "guest";
const getCart = () =>
  (state.carts[cartKey()] || [])
    .map((id) => state.courses.find((item) => item.id === id))
    .filter((item) => item?.published);
const publicCourse = (course) => ({
  ...course,
  sections: course.sections.map((section) => ({
    ...section,
    lessons: section.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      duration: lesson.duration,
      preview: !!lesson.preview,
    })),
  })),
});
function signIn(id) {
  const guest = state.carts.guest || [];
  state.session = id;
  state.carts[id] = [...new Set([...(state.carts[id] || []), ...guest])];
  state.carts.guest = [];
  return user();
}

export async function mockRequest(method, path, payload = {}) {
  await new Promise((resolve) => setTimeout(resolve, 180));
  let result;
  const parts = path.split("/").filter(Boolean);
  if (path === "/auth/me") result = user() || null;
  else if (path === "/auth/login") {
    const found = state.users.find(
      (item) => item.email.toLowerCase() === payload.email.toLowerCase(),
    );
    if (!found)
      fail(
        "Demo account not found. Register a demo profile or use a demo account below.",
      );
    result = signIn(found.id);
  } else if (path === "/auth/demo")
    result = signIn(payload.role === "admin" ? "u2" : "u1");
  else if (path === "/auth/register") {
    if (
      state.users.some(
        (item) => item.email.toLowerCase() === payload.email.toLowerCase(),
      )
    )
      fail("A demo profile with this email already exists.");
    const next = {
      id: crypto.randomUUID(),
      name: payload.name,
      email: payload.email,
      bio: "",
      role: "student",
      joined: new Date().toISOString().slice(0, 10),
    };
    state.users.push(next);
    state.enrollments[next.id] = [
      { courseId: "c1", completedLessons: [], certificate: null },
    ];
    result = signIn(next.id);
  } else if (path === "/auth/logout") {
    state.session = null;
    result = { ok: true };
  } else if (path === "/categories")
    result = categories.map((category) => ({
      ...category,
      count: state.courses.filter(
        (course) => course.published && course.category === category.id,
      ).length,
    }));
  else if (path === "/courses")
    result = state.courses
      .filter((course) => course.published)
      .map(publicCourse);
  else if (parts[0] === "courses") {
    result = findCourse(parts[1]);
    if (!result.published) fail("This course is currently unavailable.", 404);
    result = publicCourse(result);
  } else if (path === "/cart") result = getCart().map(publicCourse);
  else if (path === "/cart/items" && method === "post") {
    const course = findCourse(payload.courseId);
    if (!course.published) fail("This course is not available.");
    if (
      (state.enrollments[user()?.id] || []).some(
        (item) => item.courseId === course.id,
      )
    )
      fail("You are already enrolled in this course.");
    state.carts[cartKey()] = [
      ...new Set([...(state.carts[cartKey()] || []), course.id]),
    ];
    result = getCart().map(publicCourse);
  } else if (parts[0] === "cart" && method === "delete") {
    state.carts[cartKey()] = (state.carts[cartKey()] || []).filter(
      (id) => id !== parts[2],
    );
    result = getCart().map(publicCourse);
  } else if (path === "/users/me" && method === "get") result = requireUser();
  else if (path === "/users/me" && method === "patch") {
    const current = requireUser();
    if (
      state.users.some(
        (item) =>
          item.id !== current.id &&
          item.email.toLowerCase() === payload.email?.toLowerCase(),
      )
    )
      fail("This email is already used by another demo profile.");
    Object.assign(current, {
      name: payload.name,
      email: payload.email,
      bio: payload.bio,
    });
    result = current;
  } else if (path === "/users/me/password")
    fail(
      "Passwords are not stored in demo mode. Connect the backend to change your password.",
      501,
    );
  else if (path === "/enrollments/me")
    result = (state.enrollments[requireUser().id] || [])
      .map((item) => ({
        ...item,
        course: state.courses.find((course) => course.id === item.courseId),
      }))
      .filter((item) => item.course)
      .map((item) => ({ ...item, course: publicCourse(item.course) }));
  else if (parts[0] === "learning" && parts[1] === "courses") {
    const course = findCourse(parts[2]);
    enrollment(course.id);
    if (parts[3] === "lessons") {
      const lesson =
        course.sections
          .flatMap((section) => section.lessons)
          .find((item) => item.id === parts[4]) ||
        fail("Lesson not found.", 404);
      result = {
        ...lesson,
        description:
          "This is a demonstration lesson. The sample video lets you test playback controls; your real course content will be supplied by the backend after enrollment is verified.",
        videoUrl:
          "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        resources: [
          {
            id: "notes",
            name: "Demo lesson notes.txt",
            content: `FORMA · Demo lesson notes\n\n${lesson.title}\n\n1. Write down your main takeaway.\n2. Practice the concept in a small project.\n3. Reflect on what you would change next time.\n\nThis is sample educational content.`,
          },
        ],
      };
      if (lesson.videoUrl) result.videoUrl = lesson.videoUrl;
      if (lesson.description) result.description = lesson.description;
    } else
      result = { ...publicCourse(course), enrollment: enrollment(course.id) };
  } else if (
    parts[0] === "learning" &&
    parts[1] === "lessons" &&
    method === "patch"
  ) {
    const course =
      state.courses.find((item) =>
        item.sections.some((section) =>
          section.lessons.some((lesson) => lesson.id === parts[2]),
        ),
      ) || fail("Lesson not found.", 404);
    const record = enrollment(course.id);
    record.completedLessons = payload.completed
      ? [...new Set([...record.completedLessons, parts[2]])]
      : record.completedLessons.filter((id) => id !== parts[2]);
    result = record;
  } else if (path === "/orders" && method === "post")
    fail(
      "Checkout is unavailable in demo mode. No payment has been taken.",
      501,
    );
  else if (path === "/orders/me") {
    requireUser();
    result = [];
  } else if (parts[0] === "admin") {
    admin();
    if (path === "/admin/stats")
      result = {
        users: state.users.length,
        courses: state.courses.length,
        orders: demoOrders.length,
        revenue: demoOrders.reduce((sum, order) => sum + order.total, 0),
        chart: revenue,
      };
    else if (path === "/admin/users")
      result = state.users.map((item) => ({
        ...item,
        enrollments: state.enrollments[item.id] || [],
      }));
    else if (path === "/admin/orders") result = demoOrders;
    else if (path === "/admin/courses" && method === "get")
      result = state.courses;
    else if (path === "/admin/courses" && method === "post") {
      if (state.courses.some((item) => item.slug === payload.slug))
        fail("A course with this slug already exists.");
      const next = {
        ...payload,
        id: crypto.randomUUID(),
        students: 0,
        rating: 0,
        reviews: [],
        badge: "New",
        art: "ui",
        published: false,
        requirements: payload.requirements || [],
        outcomes: payload.outcomes || [],
        sections: payload.sections || [],
        language: "English",
        updatedAt: new Date().toISOString().slice(0, 10),
      };
      state.courses.push(next);
      result = next;
    } else if (parts[1] === "courses" && method === "patch") {
      const current = findCourse(parts[2]);
      if (
        payload.slug &&
        state.courses.some(
          (item) => item.slug === payload.slug && item.id !== current.id,
        )
      )
        fail("A course with this slug already exists.");
      Object.assign(current, payload);
      result = current;
    } else if (parts[1] === "courses" && method === "delete") {
      if (
        Object.values(state.enrollments)
          .flat()
          .some((item) => item.courseId === parts[2])
      )
        fail(
          "This course has enrolled students. Unpublish it to remove it from the catalog.",
        );
      state.courses = state.courses.filter((item) => item.id !== parts[2]);
      result = { ok: true };
    } else fail("This action requires a backend integration.", 501);
  } else fail("This endpoint is not available.", 404);
  save();
  return structuredClone(result);
}
