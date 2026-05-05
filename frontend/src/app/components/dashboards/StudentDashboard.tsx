import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Award, BookOpen, Clock, Lock, TrendingUp, Unlock } from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { api, Course, LessonSubmission, Progress as CourseProgress, User } from "../../utils/api";
import { LIMITS } from "../../utils/limits";
import { formatRuCount } from "../../utils/plural";

type SubmissionReviewUpdate = {
  key: string;
  courseId: string;
  courseTitle: string;
  lessonTitle: string;
  fileName: string;
  status: "approved" | "rejected";
  reviewedAt: string;
};

type ReviewedSubmissionsSnapshot = {
  updates: SubmissionReviewUpdate[];
  newlyApproved: number;
  newlyRejected: number;
};

export default function StudentDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Record<string, CourseProgress>>({});
  const [reviewUpdates, setReviewUpdates] = useState<SubmissionReviewUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData(true);

    const refreshTimer = window.setInterval(() => {
      loadData(false);
    }, 30000);

    return () => {
      window.clearInterval(refreshTimer);
    };
  }, []);

  const loadData = async (withLoginNotification = false) => {
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

      const submissionSnapshot = await collectReviewedSubmissionsSnapshot(userData.id, enrolled);
      setReviewUpdates(submissionSnapshot.updates);

      if (withLoginNotification) {
        if (submissionSnapshot.newlyApproved > 0) {
          toast.success(`Принято: ${formatRuCount(submissionSnapshot.newlyApproved, "работа", "работы", "работ")}`);
        }
        if (submissionSnapshot.newlyRejected > 0) {
          toast.error(`Отклонено: ${formatRuCount(submissionSnapshot.newlyRejected, "работа", "работы", "работ")}`);
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  const collectReviewedSubmissionsSnapshot = async (
    studentId: string,
    enrolled: Course[],
  ): Promise<ReviewedSubmissionsSnapshot> => {
    const storageKey = `lms:student:submission-status:${studentId}`;
    let previousStatuses: Record<string, string> = {};
    try {
      previousStatuses = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (!previousStatuses || typeof previousStatuses !== "object" || Array.isArray(previousStatuses)) {
        previousStatuses = {};
      }
    } catch {
      previousStatuses = {};
    }

    const allSubmissions: LessonSubmission[] = [];
    const submissionResults = await Promise.all(
      enrolled.map(async (course) => {
        try {
          return await api.getMyCourseSubmissions(course.id);
        } catch {
          return { submissions: [] as LessonSubmission[] };
        }
      }),
    );
    for (const result of submissionResults) {
      allSubmissions.push(...result.submissions);
    }

    const currentStatuses: Record<string, string> = {};
    const reviewUpdatesList: SubmissionReviewUpdate[] = [];
    let newlyApproved = 0;
    let newlyRejected = 0;

    const courseTitleById = new Map(enrolled.map((course) => [course.id, course.title]));
    const lessonTitleByCourseLesson = new Map<string, string>();
    for (const course of enrolled) {
      for (const module of course.modules) {
        for (const lesson of module.lessons) {
          lessonTitleByCourseLesson.set(`${course.id}:${lesson.id}`, lesson.title);
        }
      }
    }

    for (const submission of allSubmissions) {
      const key = `${submission.courseId}:${submission.id}`;
      currentStatuses[key] = submission.status;

      if (submission.status !== "approved" && submission.status !== "rejected") {
        continue;
      }

      if (previousStatuses[key] !== submission.status) {
        if (submission.status === "approved") {
          newlyApproved += 1;
        } else {
          newlyRejected += 1;
        }
      }

      reviewUpdatesList.push({
        key,
        courseId: submission.courseId,
        courseTitle: courseTitleById.get(submission.courseId) || `Курс #${submission.courseId}`,
        lessonTitle:
          lessonTitleByCourseLesson.get(`${submission.courseId}:${submission.lessonId}`) || `Урок #${submission.lessonId}`,
        fileName: submission.fileName || "Без названия",
        status: submission.status,
        reviewedAt: submission.reviewedAt || submission.updatedAt || submission.createdAt || "",
      });
    }

    reviewUpdatesList.sort((a, b) => {
      const aTime = Date.parse(a.reviewedAt || "");
      const bTime = Date.parse(b.reviewedAt || "");
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
    });

    localStorage.setItem(storageKey, JSON.stringify(currentStatuses));
    return {
      updates: reviewUpdatesList.slice(0, 5),
      newlyApproved,
      newlyRejected,
    };
  };

  const handleEnroll = async (course: Course) => {
    try {
      let accessPassword = "";
      if (course.hasPassword) {
        const entered = window.prompt("Этот курс защищен паролем. Введите пароль:", "");
        if (entered === null) return;
        accessPassword = entered.trim();
        if (!accessPassword) {
          toast.error("Введите пароль курса");
          return;
        }
        if (accessPassword.length < LIMITS.courseAccessPasswordMin) {
          toast.error(`Пароль курса должен содержать минимум ${LIMITS.courseAccessPasswordMin} символа`);
          return;
        }
        if (accessPassword.length > LIMITS.courseAccessPassword) {
          toast.error(`Пароль курса не должен превышать ${LIMITS.courseAccessPassword} символов`);
          return;
        }
      }
      await api.enrollCourse(course.id, accessPassword);
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

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle>Обновлен статус проверки работ</CardTitle>
            <CardDescription>Показаны 5 последних проверенных работ.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {reviewUpdates.length === 0 ? (
              <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
                Пока нет обновлений по проверке ваших работ.
              </div>
            ) : (
              reviewUpdates.map((update) => (
                <div key={update.key} className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium" title={update.courseTitle}>
                      Курс: {update.courseTitle}
                    </p>
                    <p className="truncate text-sm text-muted-foreground" title={update.fileName}>
                      Работа: {update.fileName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground" title={update.lessonTitle}>
                      Урок: {update.lessonTitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {update.status === "approved" ? (
                      <Badge className="bg-green-600">Принято</Badge>
                    ) : (
                      <Badge variant="destructive">Отклонено</Badge>
                    )}
                    <Link to={`/courses/${update.courseId}`}>
                      <Button size="sm" variant="outline">
                        Перейти к курсу
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

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
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {course.hasPassword ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                        <span>{course.hasPassword ? "С паролем" : "Без пароля"}</span>
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
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {course.hasPassword ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                      <span>{course.hasPassword ? "С паролем" : "Без пароля"}</span>
                    </div>

                    <div className="flex gap-2">
                      <Link to={`/courses/${course.id}`} className="flex-1">
                        <Button className="h-11 w-full">Просмотреть</Button>
                      </Link>
                      <Button onClick={() => handleEnroll(course)} className="h-11 flex-1">
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
