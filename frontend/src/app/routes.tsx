import { createBrowserRouter } from "react-router";
import Root from "./components/Root";
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import StudentDashboard from "./components/dashboards/StudentDashboard";
import TeacherDashboard from "./components/dashboards/TeacherDashboard";
import AdminDashboard from "./components/dashboards/AdminDashboard";
import AdminUserPage from "./components/dashboards/AdminUserPage";
import Profile from "./components/Profile";
import CoursePage from "./components/courses/CoursePage";
import CourseEditor from "./components/courses/CourseEditor";
import LessonViewer from "./components/courses/LessonViewer";
import NotFound from "./components/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Login },
      { path: "register", Component: Register },
      { path: "student/dashboard", Component: StudentDashboard },
      { path: "teacher/dashboard", Component: TeacherDashboard },
      { path: "admin/dashboard", Component: AdminDashboard },
      { path: "admin/users/:id", Component: AdminUserPage },
      { path: "admin/courses/:id/edit", Component: CourseEditor },
      { path: "profile", Component: Profile },
      { path: "courses/:id", Component: CoursePage },
      { path: "courses/:id/edit", Component: CourseEditor },
      { path: "courses/:courseId/lessons/:lessonId", Component: LessonViewer },
      { path: "*", Component: NotFound },
    ],
  },
]);
