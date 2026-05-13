import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import AvatarField from "../shared/AvatarField";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { api, Course, User } from "../../utils/api";
import { applyTextLimit, LIMITS } from "../../utils/limits";

const roleLabel: Record<User["role"], string> = {
  student: "Студент",
  teacher: "Учитель",
  admin: "Администратор",
};

const statusLabel: Record<string, string> = {
  approved: "Опубликован",
  pending: "Черновик",
  rejected: "Удален",
};

export default function AdminUserPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [deletedCourses, setDeletedCourses] = useState<Course[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [passwordDialogCourse, setPasswordDialogCourse] = useState<Course | null>(null);
  const [coursePasswordInput, setCoursePasswordInput] = useState("");
  const [savingCoursePassword, setSavingCoursePassword] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      if (!id) return;
      const [{ user: sessionUser }, data] = await Promise.all([
        api.getSession(),
        api.getAdminUserDetails(id),
      ]);
      setCurrentUserId(sessionUser.id);
      setUser(data.user);
      setCourses(data.courses || []);
      setDeletedCourses(data.deletedCourses || []);
      setForm({ name: data.user.name, email: data.user.email, password: "" });
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки пользователя");
      navigate("/admin/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const saveUser = async () => {
    if (!id) return;
    if (form.password && form.password.length < LIMITS.passwordMin) {
      toast.error(`Пароль должен содержать минимум ${LIMITS.passwordMin} символов`);
      return;
    }

    setSaving(true);
    try {
      const { user: updatedUser } = await api.updateAdminUser(id, {
        name: form.name,
        email: form.email,
        password: form.password || undefined,
      });
      setUser(updatedUser);
      setForm((prev) => ({ ...prev, password: "" }));
      toast.success("Пользователь обновлен");
    } catch (error: any) {
      toast.error(error.message || "Ошибка обновления пользователя");
    } finally {
      setSaving(false);
    }
  };

  const updateAvatar = async (avatarUrl: string) => {
    if (!id) return;
    const { user: updatedUser } = await api.updateAdminUser(id, { avatarUrl });
    setUser(updatedUser);
  };

  const removeAvatar = async () => {
    if (!id) return;
    const { user: updatedUser } = await api.updateAdminUser(id, { removeAvatar: true });
    setUser(updatedUser);
  };

  const deleteUser = async () => {
    if (!id) return;
    try {
      await api.deleteUser(id);
      toast.success("Пользователь удален");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка удаления пользователя");
    }
  };

  const restoreUser = async () => {
    if (!id) return;
    try {
      await api.restoreUser(id);
      toast.success("Пользователь восстановлен");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка восстановления пользователя");
    }
  };

  const deleteCourse = async (courseId: string) => {
    if (!window.confirm("Переместить курс в удаленные?")) return;
    try {
      await api.deleteCourseAsAdmin(courseId);
      toast.success("Курс удален");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка удаления курса");
    }
  };

  const restoreCourse = async (courseId: string) => {
    try {
      await api.restoreCourseAsAdmin(courseId);
      toast.success("Курс восстановлен");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка восстановления курса");
    }
  };

  const permanentlyDeleteCourse = async (courseId: string) => {
    if (!window.confirm("Удалить курс окончательно без возможности восстановления?")) return;
    try {
      await api.permanentlyDeleteCourseAsAdmin(courseId);
      toast.success("Курс удален окончательно");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка окончательного удаления курса");
    }
  };

  const publishCourse = async (courseId: string) => {
    try {
      await api.publishCourseAsAdmin(courseId);
      toast.success("Курс опубликован");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка публикации курса");
    }
  };

  const unpublishCourse = async (courseId: string) => {
    try {
      await api.unpublishCourseAsAdmin(courseId);
      toast.success("Курс снят с публикации");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка снятия с публикации");
    }
  };

  const toggleCoursePassword = async (course: Course) => {
    if (savingCoursePassword) return;

    if (course.hasPassword) {
      if (!window.confirm(`Снять пароль с курса "${course.title}"?`)) return;
      try {
        await api.clearCoursePasswordByAdmin(course.id);
        toast.success("Пароль курса снят");
        await loadData();
      } catch (error: any) {
        toast.error(error.message || "Ошибка снятия пароля курса");
      }
      return;
    }

    setCoursePasswordInput("");
    setPasswordDialogCourse(course);
  };

  const handleSetCoursePassword = async () => {
    if (!passwordDialogCourse || savingCoursePassword) return;

    const normalized = coursePasswordInput.trim();
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

    setSavingCoursePassword(true);
    try {
      await api.setCoursePasswordByAdmin(passwordDialogCourse.id, normalized);
      toast.success("Пароль курса установлен");
      setPasswordDialogCourse(null);
      setCoursePasswordInput("");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка установки пароля курса");
    } finally {
      setSavingCoursePassword(false);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/admin/dashboard");
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

  if (!user) {
    return (
      <Layout>
        <p className="text-muted-foreground">Пользователь не найден</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <Dialog
          open={Boolean(passwordDialogCourse)}
          onOpenChange={(open) => {
            if (!open) {
              setPasswordDialogCourse(null);
              setCoursePasswordInput("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Установить пароль курса</DialogTitle>
              <DialogDescription>
                {passwordDialogCourse ? `Курс: ${passwordDialogCourse.title}` : "Введите пароль от 4 до 10 символов."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="admin-course-password">Пароль курса</Label>
                <Input
                  id="admin-course-password"
                  type="password"
                  value={coursePasswordInput}
                  placeholder={`От ${LIMITS.courseAccessPasswordMin} до ${LIMITS.courseAccessPassword} символов`}
                  onChange={(event) =>
                    setCoursePasswordInput(
                      applyTextLimit(event.target.value, LIMITS.courseAccessPassword, "Пароль курса"),
                    )
                  }
                />
              </div>
              <Button onClick={handleSetCoursePassword} className="w-full" disabled={savingCoursePassword}>
                {savingCoursePassword ? "Сохранение..." : "Установить пароль"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div>
          <Button variant="outline" className="gap-2" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Профиль пользователя</h1>
            <p className="text-muted-foreground">Публичный ID: {user.publicId}</p>
          </div>
          <div className="flex items-center gap-2">
            {!user.blocked && user.id !== currentUserId && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Удалить пользователя</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Удалить пользователя?</AlertDialogTitle>
                    <AlertDialogDescription>Пользователь будет перемещен во вкладку удаленных.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteUser}>Удалить</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {user.blocked && (
              <Button onClick={restoreUser}>Восстановить пользователя</Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{user.name}</CardTitle>
            <CardDescription>
              <Badge variant={user.role === "admin" ? "destructive" : user.role === "teacher" ? "default" : "secondary"}>
                {roleLabel[user.role]}
              </Badge>
              {user.blocked && (
                <Badge variant="outline" className="ml-2">
                  Удален
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <AvatarField
              name={user.name}
              avatarUrl={user.avatarUrl}
              disabled={saving}
              onAvatarChange={updateAvatar}
              onAvatarRemove={removeAvatar}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="user-name">Имя</Label>
                <Input
                  id="user-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: applyTextLimit(event.target.value, LIMITS.userName, "Имя") }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, email: applyTextLimit(event.target.value, LIMITS.email, "Email") }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-password">Новый пароль</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={form.password}
                  placeholder="Минимум 6 символов"
                  minLength={LIMITS.passwordMin}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, password: applyTextLimit(event.target.value, LIMITS.password, "Пароль") }))
                  }
                />
              </div>
            </div>

            <Button onClick={saveUser} disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </CardContent>
        </Card>

        {user.role === "teacher" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Курсы учителя</CardTitle>
                <CardDescription>Активные курсы и черновики</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {courses.length === 0 ? (
                  <p className="text-muted-foreground">Курсов нет</p>
                ) : (
                  courses.map((course) => (
                    <div key={course.id} className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-semibold">{course.title}</div>
                          <div
                            className="line-clamp-4 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]"
                            title={course.description}
                          >
                            {course.description}
                          </div>
                        </div>
                        <Badge variant={course.status === "approved" ? "default" : "secondary"}>
                          {statusLabel[course.status || ""] || course.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link to={`/courses/${course.id}`}>
                          <Button variant="outline">Открыть</Button>
                        </Link>
                        <Link to={`/admin/courses/${course.id}/edit`}>
                          <Button variant="outline">Редактировать</Button>
                        </Link>
                        {course.status === "approved" ? (
                          <Button variant="secondary" onClick={() => unpublishCourse(course.id)}>
                            Снять публикацию
                          </Button>
                        ) : (
                          <Button onClick={() => publishCourse(course.id)}>Опубликовать</Button>
                        )}
                        <Button variant="outline" onClick={() => toggleCoursePassword(course)} className="gap-2">
                          {course.hasPassword ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                          {course.hasPassword ? "Снять пароль" : "Поставить пароль"}
                        </Button>
                        <Button variant="destructive" onClick={() => deleteCourse(course.id)}>
                          Удалить
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Удаленные курсы</CardTitle>
                <CardDescription>Можно восстановить</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {deletedCourses.length === 0 ? (
                  <p className="text-muted-foreground">Удаленных курсов нет</p>
                ) : (
                  deletedCourses.map((course) => (
                    <div key={course.id} className="flex items-center justify-between gap-3 rounded-lg border p-4">
                      <div className="min-w-0">
                        <div className="font-semibold">{course.title}</div>
                        <div
                          className="line-clamp-4 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]"
                          title={course.description}
                        >
                          {course.description}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={() => restoreCourse(course.id)}>Восстановить</Button>
                        <Button variant="destructive" onClick={() => permanentlyDeleteCourse(course.id)}>
                          Удалить окончательно
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
