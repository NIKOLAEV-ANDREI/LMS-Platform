import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Award, BookOpen, Clock, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { api, Course, Progress as CourseProgress, User } from "../../utils/api";
import { formatRuCount } from "../../utils/plural";

export default function StudentDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Record<string, CourseProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { user: userData } = await api.getSession();
      setUser(userData);

      const { courses: allCourses } = await api.getCourses();
      const coursesById = new Map(allCourses.map((course) => [course.id, course]));
      const enrolled = [...userData.enrolledCourses]
        .reverse()
        .map((courseId) => coursesById.get(courseId))
        .filter((course): course is Course => Boolean(course));
      const available = allCourses.filter((course) => !userData.enrolledCourses.includes(course.id));

      setEnrolledCourses(enrolled);
      setAvailableCourses(available);

      const progressData: Record<string, CourseProgress> = {};
      for (const course of enrolled) {
        const { progress: courseProgress } = await api.getProgress(course.id);
        if (courseProgress) {
          progressData[course.id] = courseProgress;
        }
      }
      setProgress(progressData);
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (courseId: string) => {
    try {
      await api.enrollCourse(courseId);
      toast.success("Вы успешно записались на курс");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка записи на курс");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  const completedCount = Object.values(progress).filter((item) => item.progress === 100).length;
  const avgProgress =
    enrolledCourses.length > 0
      ? Math.round(Object.values(progress).reduce((sum, item) => sum + (item?.progress || 0), 0) / enrolledCourses.length)
      : 0;
  const recentEnrolledCourses = enrolledCourses.slice(0, 3);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-bold [overflow-wrap:anywhere]">Добро пожаловать, {user?.name}!</h1>
          <p className="mt-1 text-muted-foreground">Ваши курсы и прогресс обучения</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Активные курсы</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{enrolledCourses.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Завершено</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Средний прогресс</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgProgress}%</div>
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-2xl font-semibold leading-tight">Мои курсы</h2>
            <Link to="/profile" aria-label="Перейти к моим курсам в профиле">
              <Button
                variant="ghost"
                size="icon"
                className="relative top-px h-9 w-10 rounded-md text-foreground hover:bg-primary hover:text-white"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-6 w-6 bg-current"
                  style={{
                    WebkitMaskImage: "url('/icons/right-arrow.svg')",
                    maskImage: "url('/icons/right-arrow.svg')",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                  }}
                />
              </Button>
            </Link>
          </div>
          {enrolledCourses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Вы еще не записались ни на один курс</p>
                <p className="mt-1 text-sm text-muted-foreground">Выберите курс из доступных ниже</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {recentEnrolledCourses.map((course) => {
                const courseProgress = progress[course.id];
                return (
                  <Card key={course.id} className="flex h-full flex-col transition-shadow hover:shadow-lg">
                    <CardHeader className="min-w-0 pb-4">
                      {course.imageUrl && (
                        <div className="mb-4 aspect-video overflow-hidden rounded-lg bg-gray-200">
                          <img src={course.imageUrl} alt={course.title} className="h-full w-full object-cover" />
                        </div>
                      )}

                      <CardTitle
                        className="line-clamp-1 min-h-7 text-lg leading-tight break-words [overflow-wrap:anywhere]"
                        title={course.title}
                      >
                        {course.title}
                      </CardTitle>
                      <CardDescription
                        className="line-clamp-2 min-h-14 break-words [overflow-wrap:anywhere]"
                        title={course.description}
                      >
                        {course.description}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="mt-auto flex flex-1 flex-col justify-end gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Прогресс</span>
                          <span className="font-medium">{courseProgress?.progress || 0}%</span>
                        </div>
                        <Progress value={courseProgress?.progress || 0} />
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{formatRuCount(course.modules.length, "модуль", "модуля", "модулей")}</span>
                      </div>

                      <Link to={`/courses/${course.id}`} className="block">
                        <Button className="w-full">{courseProgress?.progress === 100 ? "Просмотреть" : "Продолжить"}</Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-2xl font-semibold">Доступные курсы</h2>
          {availableCourses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Доступных курсов больше нет</p>
                <p className="mt-1 text-sm text-muted-foreground">Вы уже подписались на все курсы</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {availableCourses.map((course) => (
                <Card key={course.id} className="flex h-full flex-col transition-shadow hover:shadow-lg">
                  <CardHeader className="min-w-0 pb-4">
                    {course.imageUrl && (
                      <div className="mb-4 aspect-video overflow-hidden rounded-lg bg-gray-200">
                        <img src={course.imageUrl} alt={course.title} className="h-full w-full object-cover" />
                      </div>
                    )}

                    <CardTitle
                      className="line-clamp-1 min-h-7 text-lg leading-tight break-words [overflow-wrap:anywhere]"
                      title={course.title}
                    >
                      {course.title}
                    </CardTitle>
                    <CardDescription
                      className="line-clamp-2 min-h-14 break-words [overflow-wrap:anywhere]"
                      title={course.description}
                    >
                      {course.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="mt-auto flex flex-1 flex-col justify-end gap-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="shrink-0 text-muted-foreground">Преподаватель</span>
                      <span className="min-w-0 truncate font-medium" title={course.teacherName}>
                        {course.teacherName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{formatRuCount(course.modules.length, "модуль", "модуля", "модулей")}</span>
                    </div>

                    <div className="flex gap-2">
                      <Link to={`/courses/${course.id}`} className="flex-1">
                        <Button variant="outline" className="w-full">
                          Просмотреть
                        </Button>
                      </Link>
                      <Button onClick={() => handleEnroll(course.id)} className="flex-1">
                        Записаться
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
