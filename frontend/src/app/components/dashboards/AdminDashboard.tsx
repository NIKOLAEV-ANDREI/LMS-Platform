import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { BookOpen, Plus, RotateCcw, ShieldCheck, Trash2, Users } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { api, Course, User } from "../../utils/api";
import { applyTextLimit, LIMITS } from "../../utils/limits";

type UsersTab = "active" | "deleted";
type RoleFilter = "all" | "student" | "teacher" | "admin";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [usersTab, setUsersTab] = useState<UsersTab>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "student" as "student" | "teacher" | "admin",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [{ user: sessionUser }, { users: allUsers }, { courses: allCourses }] = await Promise.all([
        api.getSession(),
        api.getAllUsers(),
        api.getCourses(),
      ]);
      setCurrentUserId(sessionUser.id);
      setUsers(allUsers);
      setCourses(allCourses);
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "student" | "teacher" | "admin") => {
    if (userId === currentUserId) {
      toast.error("Свою роль менять нельзя");
      return;
    }
    try {
      await api.updateUserRole(userId, newRole);
      toast.success("Роль пользователя изменена");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка изменения роли");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await api.deleteUser(userId);
      toast.success("Пользователь удален");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка удаления пользователя");
    }
  };

  const handleRestoreUser = async (userId: string) => {
    try {
      await api.restoreUser(userId);
      toast.success("Пользователь восстановлен");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка восстановления пользователя");
    }
  };

  const resetCreateUserForm = () => {
    setNewUser({
      name: "",
      email: "",
      password: "",
      role: "student",
    });
  };

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newUser.name.trim();
    const email = newUser.email.trim();
    const password = newUser.password.trim();

    if (!name || !email || !password) {
      toast.error("Заполните все поля");
      return;
    }
    if (password.length < LIMITS.passwordMin) {
      toast.error(`Пароль должен содержать минимум ${LIMITS.passwordMin} символов`);
      return;
    }

    try {
      setCreatingUser(true);
      await api.createUserAsAdmin({
        name,
        email,
        password,
        role: newUser.role,
      });
      toast.success("Пользователь создан");
      setCreateDialogOpen(false);
      resetCreateUserForm();
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка создания пользователя");
    } finally {
      setCreatingUser(false);
    }
  };

  const activeUsers = users.filter((user) => !user.blocked);
  const deletedUsers = users.filter((user) => user.blocked);

  const usersInTable = useMemo(() => {
    const source = usersTab === "active" ? activeUsers : deletedUsers;
    const normalizedQuery = searchQuery.trim().toLowerCase();

    let filtered = source;
    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    if (normalizedQuery) {
      filtered = filtered.filter((user) => {
        const byName = user.name.toLowerCase().includes(normalizedQuery);
        const byEmail = user.email.toLowerCase().includes(normalizedQuery);
        return byName || byEmail;
      });
    }
    return filtered;
  }, [activeUsers, deletedUsers, roleFilter, searchQuery, usersTab]);

  const studentCount = activeUsers.filter((user) => user.role === "student").length;
  const teacherCount = activeUsers.filter((user) => user.role === "teacher").length;
  const adminCount = activeUsers.filter((user) => user.role === "admin").length;

  const roleLabel: Record<User["role"], string> = {
    student: "Студент",
    teacher: "Учитель",
    admin: "Администратор",
  };

  const roleVariant: Record<User["role"], "secondary" | "default" | "destructive"> = {
    student: "secondary",
    teacher: "default",
    admin: "destructive",
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

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <div>
            <h1 className="text-3xl font-bold">Панель администратора</h1>
            <p className="mt-1 text-muted-foreground">Управление пользователями и системой</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Всего пользователей</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeUsers.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Студенты</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{studentCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Учителя</CardTitle>
              <BookOpen className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teacherCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Администраторы</CardTitle>
              <ShieldCheck className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminCount}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Управление пользователями</CardTitle>
                <CardDescription>Нажмите на строку пользователя, чтобы открыть его страницу</CardDescription>
              </div>

              <Dialog
                open={createDialogOpen}
                onOpenChange={(open) => {
                  setCreateDialogOpen(open);
                  if (!open) resetCreateUserForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Создать пользователя
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Новый пользователь</DialogTitle>
                    <DialogDescription>Администратор может создать студента, учителя или администратора.</DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="admin-create-user-name">Имя</Label>
                      <Input
                        id="admin-create-user-name"
                        value={newUser.name}
                        onChange={(event) =>
                          setNewUser((prev) => ({
                            ...prev,
                            name: applyTextLimit(event.target.value, LIMITS.userName, "Имя"),
                          }))
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="admin-create-user-email">Email</Label>
                      <Input
                        id="admin-create-user-email"
                        type="email"
                        value={newUser.email}
                        onChange={(event) =>
                          setNewUser((prev) => ({
                            ...prev,
                            email: applyTextLimit(event.target.value, LIMITS.email, "Email"),
                          }))
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="admin-create-user-password">Пароль</Label>
                      <Input
                        id="admin-create-user-password"
                        type="password"
                        placeholder={`Минимум ${LIMITS.passwordMin} символов`}
                        value={newUser.password}
                        onChange={(event) =>
                          setNewUser((prev) => ({
                            ...prev,
                            password: applyTextLimit(event.target.value, LIMITS.password, "Пароль"),
                          }))
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="admin-create-user-role">Роль</Label>
                      <Select
                        value={newUser.role}
                        onValueChange={(value) => setNewUser((prev) => ({ ...prev, role: value as typeof prev.role }))}
                      >
                        <SelectTrigger id="admin-create-user-role">
                          <SelectValue placeholder="Выберите роль" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Студент</SelectItem>
                          <SelectItem value="teacher">Учитель</SelectItem>
                          <SelectItem value="admin">Администратор</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={creatingUser}>
                        Отмена
                      </Button>
                      <Button type="submit" disabled={creatingUser}>
                        {creatingUser ? "Создание..." : "Создать"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant={usersTab === "active" ? "default" : "outline"} onClick={() => setUsersTab("active")}>
                Активные
              </Button>
              <Button variant={usersTab === "deleted" ? "default" : "outline"} onClick={() => setUsersTab("deleted")}>
                Удаленные
              </Button>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Поиск по имени или email"
                className="md:max-w-sm"
              />
              <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
                <SelectTrigger className="w-full md:w-[260px]">
                  <SelectValue placeholder="Фильтр по ролям" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все роли</SelectItem>
                  <SelectItem value="student">Только студенты</SelectItem>
                  <SelectItem value="teacher">Только учителя</SelectItem>
                  <SelectItem value="admin">Только администраторы</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Дата регистрации</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {usersInTable.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Пользователи не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  usersInTable.map((user) => (
                    <TableRow
                      key={user.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/admin/users/${user.publicId || user.id}`)}
                    >
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        {user.id === currentUserId ? (
                          <span className="text-xs text-muted-foreground">Свою роль менять нельзя</span>
                        ) : null}
                        <Select
                          value={user.role}
                          onValueChange={(value) => handleRoleChange(user.publicId || user.id, value as "student" | "teacher" | "admin")}
                          disabled={user.id === currentUserId}
                        >
                          <SelectTrigger className="w-[150px]">
                            <Badge variant={roleVariant[user.role]}>{roleLabel[user.role]}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Студент</SelectItem>
                            <SelectItem value="teacher">Учитель</SelectItem>
                            <SelectItem value="admin">Администратор</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString("ru-RU")}</TableCell>
                      <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                        {usersTab === "active" ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Удалить пользователя?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Пользователь будет перемещен во вкладку удаленных.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Отмена</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteUser(user.publicId || user.id)}>Удалить</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => handleRestoreUser(user.publicId || user.id)}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Статистика курсов</CardTitle>
            <CardDescription>Обзор всех курсов в системе</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Всего курсов:</span>
                <span className="text-2xl font-bold">{courses.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Всего модулей:</span>
                <span className="text-2xl font-bold">{courses.reduce((sum, course) => sum + course.modules.length, 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Всего уроков:</span>
                <span className="text-2xl font-bold">
                  {courses.reduce((sum, course) => sum + course.modules.reduce((moduleSum, module) => moduleSum + module.lessons.length, 0), 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
