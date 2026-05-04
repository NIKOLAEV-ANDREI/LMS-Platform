import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { BookOpen, Edit, Lock, Plus, Trash2, TrendingUp, Unlock, Users } from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
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
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import CharCounter from "../shared/CharCounter";
import { api, Course, User } from "../../utils/api";
import { applyTextLimit, LIMITS } from "../../utils/limits";

export default function TeacherDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: "",
    description: "",
    imageUrl: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { user: userData } = await api.getSession();
      setUser(userData);

      const { courses: allCourses } = await api.getCourses();
      setCourses(allCourses.filter((course) => course.teacherId === userData.id));
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api.createCourse(newCourse.title, newCourse.description, newCourse.imageUrl);
      toast.success("Курс создан успешно");
      setDialogOpen(false);
      setNewCourse({ title: "", description: "", imageUrl: "" });
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка создания курса");
    }
  };

  const handlePublishCourse = async (courseId: string) => {
    try {
      await api.publishCourse(courseId);
      toast.success("Курс опубликован");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка публикации курса");
    }
  };

  const handleUnpublishCourse = async (courseId: string) => {
    try {
      await api.unpublishCourse(courseId);
      toast.success("Курс снят с публикации");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка снятия курса с публикации");
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      await api.removeCourse(courseId);
      toast.success("Курс удален");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка удаления курса");
    }
  };

  const handleToggleCoursePassword = async (course: Course) => {
    if (course.hasPassword) {
      if (!window.confirm(`Снять пароль с курса "${course.title}"?`)) return;
      try {
        await api.clearCoursePassword(course.id);
        toast.success("Пароль курса снят");
        await loadData();
      } catch (error: any) {
        toast.error(error.message || "Ошибка снятия пароля курса");
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
    try {
      await api.setCoursePassword(course.id, normalized);
      toast.success("Пароль курса установлен");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка установки пароля курса");
    }
  };

  const recentCourses = useMemo(
    () =>
      [...courses]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3),
    [courses],
  );
  const totalStudents = courses.reduce((sum, course) => sum + course.enrolledStudents.length, 0);
  const totalModules = courses.reduce((sum, course) => sum + course.modules.length, 0);

  if (loading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-bold [overflow-wrap:anywhere]">Добро пожаловать, {user?.name}!</h1>
            <p className="mt-1 text-muted-foreground">Управление вашими курсами</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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

              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Название курса</Label>
                  <Input
                    id="title"
                    value={newCourse.title}
                    onChange={(event) =>
                      setNewCourse((prev) => ({
                        ...prev,
                        title: applyTextLimit(event.target.value, LIMITS.courseTitle, "Название курса"),
                      }))
                    }
                    required
                  />
                  <CharCounter value={newCourse.title} max={LIMITS.courseTitle} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    value={newCourse.description}
                    onChange={(event) =>
                      setNewCourse((prev) => ({
                        ...prev,
                        description: applyTextLimit(event.target.value, LIMITS.courseDescription, "Описание курса"),
                      }))
                    }
                    rows={4}
                    required
                  />
                  <CharCounter value={newCourse.description} max={LIMITS.courseDescription} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imageUrl">URL изображения (необязательно)</Label>
                  <Input
                    id="imageUrl"
                    type="url"
                    value={newCourse.imageUrl}
                    onChange={(event) =>
                      setNewCourse((prev) => ({
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Всего курсов</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{courses.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Всего студентов</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStudents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Всего модулей</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalModules}</div>
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
          {courses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">У вас пока нет курсов</p>
                <p className="mt-1 text-sm text-muted-foreground">Нажмите кнопку "Создать курс", чтобы начать</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {recentCourses.map((course) => (
                <Card key={course.id} className="flex h-full flex-col transition-shadow hover:shadow-lg">
                  <CardHeader className="min-w-0 pb-4">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={course.hasPassword ? "Снять пароль курса" : "Установить пароль курса"}
                        onClick={() => handleToggleCoursePassword(course)}
                      >
                        {course.hasPassword ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
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
                      className="line-clamp-2 min-h-14 break-words [overflow-wrap:anywhere]"
                      title={course.description}
                    >
                      {course.description}
                    </CardDescription>

                    <div>
                      {course.status === "approved" ? <Badge>Опубликован</Badge> : <Badge variant="secondary">Черновик</Badge>}
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

                    {course.status !== "approved" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button className="h-11 w-full">Опубликовать курс</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Опубликовать курс?</AlertDialogTitle>
                            <AlertDialogDescription>
                              После публикации курс появится у студентов в каталоге.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handlePublishCourse(course.id)}>Опубликовать</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {course.status === "approved" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="secondary" className="h-11 w-full">
                            Снять с публикации
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Снять курс с публикации?</AlertDialogTitle>
                            <AlertDialogDescription>
                              После этого курс перестанет отображаться студентам в каталоге.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleUnpublishCourse(course.id)}>
                              Снять с публикации
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
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
