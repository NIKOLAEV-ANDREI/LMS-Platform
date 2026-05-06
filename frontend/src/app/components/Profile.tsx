import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Award, BookOpen, Calendar, Clock, Edit, Lock, Mail, Plus, Trash2, TrendingUp, Unlock, UserMinus } from "lucide-react";
import { toast } from "sonner";
import Layout from "./Layout";
import AvatarField from "./shared/AvatarField";
import CharCounter from "./shared/CharCounter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Progress } from "./ui/progress";
import { Textarea } from "./ui/textarea";
import { api, Course, Progress as CourseProgress, User } from "../utils/api";
import { applyTextLimit, LIMITS } from "../utils/limits";
import { formatRuCount } from "../utils/plural";

export default function Profile() {
  type TeacherCourseFilter = "all" | "published" | "unpublished";

  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Record<string, CourseProgress>>({});
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [unenrollingCourseId, setUnenrollingCourseId] = useState<string | null>(null);
  const [courseActionId, setCourseActionId] = useState<string | null>(null);
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [teacherCourseFilter, setTeacherCourseFilter] = useState<TeacherCourseFilter>("all");
  const [newTeacherCourse, setNewTeacherCourse] = useState({
    title: "",
    description: "",
    imageUrl: "",
  });
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { user: userData } = await api.getSession();
      setUser(userData);
      setForm({ name: userData.name, email: userData.email, password: "" });

      const { courses: allCourses } = await api.getCourses();
      if (userData.role === "student") {
        const coursesById = new Map(allCourses.map((course) => [course.id, course]));
        const enrolled = [...userData.enrolledCourses]
          .reverse()
          .map((courseId) => coursesById.get(courseId))
          .filter((course): course is Course => Boolean(course));

        setCourses(enrolled);

        const nextProgress: Record<string, CourseProgress> = {};
        for (const course of enrolled) {
          const { progress: courseProgress } = await api.getProgress(course.id);
          if (courseProgress) nextProgress[course.id] = courseProgress;
        }
        setProgress(nextProgress);
      } else if (userData.role === "teacher") {
        setCourses(allCourses.filter((course) => course.teacherId === userData.id));
      } else {
        setCourses([]);
      }
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки профиля");
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (form.password && form.password.length < LIMITS.passwordMin) {
      toast.error(`Пароль должен содержать минимум ${LIMITS.passwordMin} символов`);
      return;
    }

    setSavingProfile(true);
    try {
      const payload: { name?: string; email?: string; password?: string } = {
        name: form.name,
        email: form.email,
      };
      if (form.password.trim()) payload.password = form.password;

      const { user: updatedUser } = await api.updateMyProfile(payload);
      setUser(updatedUser);
      setForm((prev) => ({ ...prev, password: "" }));
      toast.success("Профиль обновлен");
    } catch (error: any) {
      toast.error(error.message || "Не удалось обновить профиль");
    } finally {
      setSavingProfile(false);
    }
  };

  const updateAvatar = async (avatarUrl: string) => {
    const { user: updatedUser } = await api.updateMyProfile({ avatarUrl });
    setUser(updatedUser);
  };

  const removeAvatar = async () => {
    const { user: updatedUser } = await api.updateMyProfile({ removeAvatar: true });
    setUser(updatedUser);
  };

  const handleUnenroll = async (course: Course) => {
    if (unenrollingCourseId) return;
    if ((progress[course.id]?.progress || 0) >= 100) {
      toast.error("Нельзя отписаться от завершенного курса");
      return;
    }
    if (!window.confirm(`Отписаться от курса "${course.title}"?`)) return;

    setUnenrollingCourseId(course.id);
    try {
      await api.unenrollCourse(course.id);
      toast.success("Вы отписались от курса");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Не удалось отписаться от курса");
    } finally {
      setUnenrollingCourseId(null);
    }
  };

  const handlePublishCourse = async (courseId: string) => {
    if (courseActionId) return;
    setCourseActionId(courseId);
    try {
      await api.publishCourse(courseId);
      toast.success("Курс опубликован");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка публикации курса");
    } finally {
      setCourseActionId(null);
    }
  };

  const handleUnpublishCourse = async (courseId: string) => {
    if (courseActionId) return;
    setCourseActionId(courseId);
    try {
      await api.unpublishCourse(courseId);
      toast.success("Курс снят с публикации");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка снятия курса с публикации");
    } finally {
      setCourseActionId(null);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (courseActionId) return;
    setCourseActionId(courseId);
    try {
      await api.removeCourse(courseId);
      toast.success("Курс удален");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка удаления курса");
    } finally {
      setCourseActionId(null);
    }
  };

  const handleToggleTeacherCoursePassword = async (course: Course) => {
    if (courseActionId) return;

    if (course.hasPassword) {
      if (!window.confirm(`Снять пароль с курса "${course.title}"?`)) return;
      setCourseActionId(course.id);
      try {
        await api.clearCoursePassword(course.id);
        toast.success("Пароль курса снят");
        await loadData();
      } catch (error: any) {
        toast.error(error.message || "Ошибка снятия пароля курса");
      } finally {
        setCourseActionId(null);
      }
      return;
    }

    const password = window.prompt("Введите пароль для курса (от 4 до 10 символов):", "");
    if (password === null) return;
    const normalized = password.trim();
    if (!normalized) {
      toast.error("Введите пароль курса");
      return;
    }
    if (normalized.length < LIMITS.courseAccessPasswordMin) {
      toast.error(`Пароль курса должен содержать минимум ${LIMITS.courseAccessPasswordMin} символа`);
      return;
    }
    if (normalized.length > LIMITS.courseAccessPassword) {
      toast.error(`Пароль курса не должен превышать ${LIMITS.courseAccessPassword} символов`);
      return;
    }
    setCourseActionId(course.id);
    try {
      await api.setCoursePassword(course.id, normalized);
      toast.success("Пароль курса установлен");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка установки пароля курса");
    } finally {
      setCourseActionId(null);
    }
  };

  const handleCreateTeacherCourse = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api.createCourse(newTeacherCourse.title, newTeacherCourse.description, newTeacherCourse.imageUrl);
      toast.success("Курс создан успешно");
      setTeacherDialogOpen(false);
      setNewTeacherCourse({ title: "", description: "", imageUrl: "" });
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка создания курса");
    }
  };

  const getRoleBadge = (role: User["role"]) => {
    if (role === "student") return <Badge variant="secondary">Студент</Badge>;
    if (role === "teacher") return <Badge variant="default">Учитель</Badge>;
    return <Badge variant="destructive">Администратор</Badge>;
  };

  const completedCount = Object.values(progress).filter((item) => item.progress === 100).length;
  const totalTestResults = Object.values(progress).reduce((sum, item) => sum + item.testResults.length, 0);
  const averageScore =
    totalTestResults > 0
      ? Math.round(
          Object.values(progress).reduce(
            (sum, item) => sum + item.testResults.reduce((local, result) => local + result.score, 0),
            0,
          ) / totalTestResults,
        )
      : 0;

  const totalEnrolled = courses.length;
  const avgProgress = useMemo(() => {
    if (courses.length === 0) return 0;
    const total = courses.reduce((sum, course) => sum + (progress[course.id]?.progress || 0), 0);
    return Math.round(total / courses.length);
  }, [courses, progress]);
  const completedCourses = useMemo(
    () => courses.filter((course) => (progress[course.id]?.progress || 0) === 100),
    [courses, progress],
  );
  const activeCourses = useMemo(
    () => courses.filter((course) => (progress[course.id]?.progress || 0) < 100),
    [courses, progress],
  );
  const filteredTeacherCourses = useMemo(() => {
    if (teacherCourseFilter === "published") {
      return courses.filter((course) => course.status === "approved");
    }
    if (teacherCourseFilter === "unpublished") {
      return courses.filter((course) => course.status !== "approved");
    }
    return courses;
  }, [courses, teacherCourseFilter]);

  if (loading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="py-12 text-center text-muted-foreground">Пользователь не найден</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Профиль пользователя</CardTitle>
            <CardDescription>Управление личными данными.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <AvatarField
                name={user.name}
                avatarUrl={user.avatarUrl}
                disabled={savingProfile}
                onAvatarChange={updateAvatar}
                onAvatarRemove={removeAvatar}
              />

              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold">{user.name}</h2>
                  {getRoleBadge(user.role)}
                </div>

                <div className="grid grid-cols-1 gap-3 text-sm text-muted-foreground md:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>ID: {user.id}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Имя</Label>
                <Input
                  id="profile-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: applyTextLimit(event.target.value, LIMITS.userName, "Имя") }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, email: applyTextLimit(event.target.value, LIMITS.email, "Email") }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-password">Новый пароль</Label>
                <Input
                  id="profile-password"
                  type="password"
                  placeholder="Минимум 6 символов"
                  minLength={LIMITS.passwordMin}
                  value={form.password}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, password: applyTextLimit(event.target.value, LIMITS.password, "Пароль") }))
                  }
                />
              </div>
            </div>

            <Button onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? "Сохранение..." : "Сохранить изменения"}
            </Button>
          </CardContent>
        </Card>

        {user.role === "student" && (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Записано на курсы</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalEnrolled}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Завершено курсов</CardTitle>
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

            <div className="space-y-8">
              <div>
                <div className="mb-4">
                  <h2 className="text-2xl font-semibold">Мои курсы</h2>
                  <p className="text-sm text-muted-foreground">Курсы, которые вы проходите сейчас</p>
                </div>

                {activeCourses.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">Нет активных курсов</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {activeCourses.map((course) => {
                      const courseProgress = progress[course.id];
                      return (
                        <Card key={course.id} className="relative flex h-full flex-col transition-shadow hover:shadow-lg">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleUnenroll(course)}
                            disabled={Boolean(unenrollingCourseId)}
                            className="absolute top-3 right-3 z-10 h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Отписаться от курса"
                            aria-label={`Отписаться от курса ${course.title}`}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
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
                              <Button className="w-full">Продолжить</Button>
                            </Link>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-4">
                  <h2 className="text-2xl font-semibold">Завершенные курсы</h2>
                  <p className="text-sm text-muted-foreground">Курсы, которые вы прошли полностью</p>
                </div>

                {completedCourses.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Award className="mb-4 h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">Пока нет завершенных курсов</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {completedCourses.map((course) => {
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
                              <Button className="w-full">Просмотреть</Button>
                            </Link>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {totalTestResults > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Средний балл по тестам</CardTitle>
                  <CardDescription>Результаты по всем пройденным тестам</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{averageScore}%</div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {user.role === "teacher" && (
          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">Мои курсы</h2>
                <p className="text-sm text-muted-foreground">Все курсы, которые вы преподаете</p>
              </div>

              <Dialog open={teacherDialogOpen} onOpenChange={setTeacherDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Создать курс
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Создать новый курс</DialogTitle>
                    <DialogDescription>Заполните информацию о курсе. Модули и уроки можно добавить после создания.</DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleCreateTeacherCourse} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="teacher-course-title">Название курса</Label>
                      <Input
                        id="teacher-course-title"
                        value={newTeacherCourse.title}
                        onChange={(event) =>
                          setNewTeacherCourse((prev) => ({
                            ...prev,
                            title: applyTextLimit(event.target.value, LIMITS.courseTitle, "Название курса"),
                          }))
                        }
                        required
                      />
                      <CharCounter value={newTeacherCourse.title} max={LIMITS.courseTitle} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="teacher-course-description">Описание</Label>
                      <Textarea
                        id="teacher-course-description"
                        value={newTeacherCourse.description}
                        onChange={(event) =>
                          setNewTeacherCourse((prev) => ({
                            ...prev,
                            description: applyTextLimit(event.target.value, LIMITS.courseDescription, "Описание курса"),
                          }))
                        }
                        rows={4}
                        required
                      />
                      <CharCounter value={newTeacherCourse.description} max={LIMITS.courseDescription} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="teacher-course-image">URL изображения (необязательно)</Label>
                      <Input
                        id="teacher-course-image"
                        type="url"
                        value={newTeacherCourse.imageUrl}
                        onChange={(event) =>
                          setNewTeacherCourse((prev) => ({
                            ...prev,
                            imageUrl: applyTextLimit(event.target.value, LIMITS.imageUrl, "URL изображения"),
                          }))
                        }
                      />
                    </div>

                    <Button type="submit" className="w-full">
                      Создать курс
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={teacherCourseFilter === "all" ? "default" : "outline"}
                onClick={() => setTeacherCourseFilter("all")}
              >
                Все
              </Button>
              <Button
                type="button"
                size="sm"
                variant={teacherCourseFilter === "published" ? "default" : "outline"}
                onClick={() => setTeacherCourseFilter("published")}
              >
                Опубликованные
              </Button>
              <Button
                type="button"
                size="sm"
                variant={teacherCourseFilter === "unpublished" ? "default" : "outline"}
                onClick={() => setTeacherCourseFilter("unpublished")}
              >
                Сняты с публикации
              </Button>
            </div>

            {filteredTeacherCourses.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {teacherCourseFilter === "all"
                      ? "У вас пока нет созданных курсов"
                      : teacherCourseFilter === "published"
                        ? "Нет опубликованных курсов"
                        : "Нет курсов, снятых с публикации"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredTeacherCourses.map((course) => (
                  <Card key={course.id} className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
                    <CardHeader className="min-w-0 bg-[#27A5E7] pb-4 text-white">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="course-header-icon-button h-8 w-8"
                          title={course.hasPassword ? "Снять пароль курса" : "Установить пароль курса"}
                          onClick={() => handleToggleTeacherCoursePassword(course)}
                          disabled={Boolean(courseActionId)}
                        >
                          {course.hasPassword ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="course-header-icon-button course-header-icon-button-danger h-8 w-8">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Удалить курс?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Курс, его модули и уроки будут удалены без возможности восстановления.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Отмена</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteCourse(course.id)}>Удалить</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

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
                        className="line-clamp-2 min-h-14 break-words text-white/90 [overflow-wrap:anywhere]"
                        title={course.description}
                      >
                        {course.description}
                      </CardDescription>

                      <div>
                        {course.status === "approved" ? (
                          <Badge className="border border-white/80 bg-white text-[#1B6FA0] hover:bg-white">Опубликован</Badge>
                        ) : (
                          <Badge className="border border-white/35 bg-black/25 text-white hover:bg-black/25">Черновик</Badge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="mt-auto flex flex-1 flex-col justify-end gap-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Студенты</div>
                          <div className="font-medium">{course.enrolledStudents.length}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Модули</div>
                          <div className="font-medium">{course.modules.length}</div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Link to={`/courses/${course.id}/edit`} className="flex-1">
                          <Button variant="outline" className="h-11 w-full gap-2">
                            <Edit className="h-4 w-4" />
                            Редактировать
                          </Button>
                        </Link>
                        <Link to={`/courses/${course.id}`} className="flex-1">
                          <Button className="h-11 w-full">Просмотр</Button>
                        </Link>
                      </div>

                      {course.status === "approved" ? (
                        <Button
                          variant="secondary"
                          className="h-11 w-full"
                          onClick={() => handleUnpublishCourse(course.id)}
                          disabled={Boolean(courseActionId)}
                        >
                          Снять с публикации
                        </Button>
                      ) : (
                        <Button
                          className="h-11 w-full"
                          onClick={() => handlePublishCourse(course.id)}
                          disabled={Boolean(courseActionId)}
                        >
                          Опубликовать курс
                        </Button>
                      )}

                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
