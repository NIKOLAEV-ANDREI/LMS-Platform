import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import Layout from "../Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
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
import { api, User } from "../../utils/api";
import { Users, BookOpen, ShieldCheck, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type UsersTab = "active" | "deleted";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersTab, setUsersTab] = useState<UsersTab>("active");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { users: allUsers } = await api.getAllUsers();
      const { courses: allCourses } = await api.getCourses();
      setUsers(allUsers);
      setCourses(allCourses);
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "student" | "teacher" | "admin") => {
    try {
      await api.updateUserRole(userId, newRole);
      toast.success("Роль пользователя изменена");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка изменения роли");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await api.deleteUser(userId);
      toast.success("Пользователь удален");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка удаления пользователя");
    }
  };

  const handleRestoreUser = async (userId: string) => {
    try {
      await api.restoreUser(userId);
      toast.success("Пользователь восстановлен");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка восстановления пользователя");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  const activeUsers = users.filter((u) => !u.blocked);
  const deletedUsers = users.filter((u) => u.blocked);
  const usersInTable = usersTab === "active" ? activeUsers : deletedUsers;

  const studentCount = activeUsers.filter((u) => u.role === "student").length;
  const teacherCount = activeUsers.filter((u) => u.role === "teacher").length;
  const adminCount = activeUsers.filter((u) => u.role === "admin").length;
  const roleLabel: Record<"student" | "teacher" | "admin", string> = {
    student: "Студент",
    teacher: "Учитель",
    admin: "Администратор",
  };
  const roleVariant: Record<"student" | "teacher" | "admin", "secondary" | "default" | "destructive"> = {
    student: "secondary",
    teacher: "default",
    admin: "destructive",
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Панель администратора</h1>
          <p className="text-muted-foreground mt-1">Управление пользователями и системой</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
            <CardTitle>Управление пользователями</CardTitle>
            <CardDescription>Нажмите на строку пользователя, чтобы открыть его страницу</CardDescription>
            <div className="flex gap-2">
              <Button variant={usersTab === "active" ? "default" : "outline"} onClick={() => setUsersTab("active")}>
                Активные
              </Button>
              <Button variant={usersTab === "deleted" ? "default" : "outline"} onClick={() => setUsersTab("deleted")}>
                Удаленные
              </Button>
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
                {usersInTable.map((user) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/admin/users/${user.id}`)}
                  >
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select value={user.role} onValueChange={(value) => handleRoleChange(user.id, value as any)}>
                        <SelectTrigger className="w-[150px]">
                          <Badge variant={roleVariant[user.role]}>
                            {roleLabel[user.role]}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Студент</SelectItem>
                          <SelectItem value="teacher">Учитель</SelectItem>
                          <SelectItem value="admin">Администратор</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString("ru-RU")}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
                                Пользователь будет перемещен в удаленные.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Отмена</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>Удалить</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => handleRestoreUser(user.id)}>
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
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
                <span className="text-2xl font-bold">{courses.reduce((sum, c) => sum + c.modules.length, 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Всего уроков:</span>
                <span className="text-2xl font-bold">
                  {courses.reduce((sum, c) => sum + c.modules.reduce((s: number, m: any) => s + m.lessons.length, 0), 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
