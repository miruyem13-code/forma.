import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider } from "./contexts/AppContext";
import { ErrorBoundary, Skeleton } from "./components/common/UI";
import PublicLayout from "./layouts/PublicLayout";
import ProtectedRoute from "./routes/ProtectedRoute";
import Home from "./pages/public/Home";

const Catalog = lazy(() => import("./pages/public/Catalog"));
const Categories = lazy(() =>
  import("./pages/public/Catalog").then((module) => ({
    default: module.Categories,
  })),
);
const CourseDetail = lazy(() => import("./pages/public/CourseDetail"));
const Cart = lazy(() => import("./pages/public/Cart"));
const Auth = lazy(() => import("./pages/auth/Auth"));
const Dashboard = lazy(() => import("./pages/student/Learning"));
const MyLearning = lazy(() =>
  import("./pages/student/Learning").then((module) => ({
    default: module.MyLearning,
  })),
);
const Player = lazy(() => import("./pages/student/Player"));
const Profile = lazy(() => import("./pages/student/Profile"));
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const Overview = lazy(() => import("./pages/admin/Overview"));
const AdminCourses = lazy(() => import("./pages/admin/Courses"));
const CourseEditor = lazy(() =>
  import("./pages/admin/Courses").then((module) => ({
    default: module.CourseEditor,
  })),
);
const management = (name) =>
  lazy(() =>
    import("./pages/admin/Management").then((module) => ({
      default: module[name],
    })),
  );
const AdminUsers = management("AdminUsers");
const AdminOrders = management("AdminOrders");
const AdminCategories = management("AdminCategories");
const AdminReviews = management("AdminReviews");
const AdminSettings = management("AdminSettings");
const Info = lazy(() => import("./pages/public/Info"));
const NotFound = lazy(() =>
  import("./pages/public/Info").then((module) => ({
    default: module.NotFound,
  })),
);
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      retry: (count, error) =>
        count < 1 && ![401, 403, 404].includes(error.response?.status),
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppProvider>
            <Suspense
              fallback={
                <div className="container section">
                  <Skeleton />
                </div>
              }
            >
              <Routes>
                <Route element={<PublicLayout />}>
                  <Route index element={<Home />} />
                  <Route path="courses" element={<Catalog />} />
                  <Route path="categories" element={<Categories />} />
                  <Route path="courses/:slug" element={<CourseDetail />} />
                  <Route path="cart" element={<Cart />} />
                  <Route path="login" element={<Auth key="login" />} />
                  <Route
                    path="register"
                    element={<Auth key="register" register />}
                  />
                  <Route path="privacy" element={<Info type="privacy" />} />
                  <Route path="terms" element={<Info type="terms" />} />
                  <Route path="help" element={<Info type="help" />} />
                  <Route element={<ProtectedRoute />}>
                    <Route path="checkout" element={<Cart checkout />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="my-learning" element={<MyLearning />} />
                    <Route
                      path="learn/:courseId/:lessonId"
                      element={<Player />}
                    />
                    <Route path="profile" element={<Profile />} />
                    <Route
                      path="profile/edit"
                      element={<Profile view="edit" />}
                    />
                    <Route
                      path="profile/security"
                      element={<Profile view="security" />}
                    />
                  </Route>
                  <Route element={<ProtectedRoute admin />}>
                    <Route path="admin" element={<AdminLayout />}>
                      <Route index element={<Overview />} />
                      <Route path="courses" element={<AdminCourses />} />
                      <Route path="courses/new" element={<CourseEditor />} />
                      <Route path="courses/:id" element={<CourseEditor />} />
                      <Route
                        path="lessons"
                        element={<AdminCourses lessons />}
                      />
                      <Route path="users" element={<AdminUsers />} />
                      <Route path="orders" element={<AdminOrders />} />
                      <Route path="categories" element={<AdminCategories />} />
                      <Route path="reviews" element={<AdminReviews />} />
                      <Route
                        path="analytics"
                        element={<Overview analytics />}
                      />
                      <Route path="settings" element={<AdminSettings />} />
                      <Route path="*" element={<NotFound />} />
                    </Route>
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </AppProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
