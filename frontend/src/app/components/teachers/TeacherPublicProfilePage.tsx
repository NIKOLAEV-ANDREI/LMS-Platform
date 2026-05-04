import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { BookOpen, Clock, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { api, Course, User } from "../../utils/api";
import { formatRuCount } from "../../utils/plural";

export default function TeacherPublicProfilePage() {
  const { id } = useParams<{ id: string }>();

  const [viewer, setViewer] = useState<User | null>(null);
  const [teacherName, setTeacherName] = useState("Преподаватель");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherAvatarUrl, setTeacherAvatarUrl] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    try {
      const [{ user }, profile] = await Promise.all([api.getSession(), api.getTeacherPublicProfile(id)]);
      setViewer(user);
      setTeacherName(profile.teacher.name || "Преподаватель");
      setTeacherEmail(profile.teacher.email || "");
      setTeacherAvatarUrl(profile.teacher.avatarUrl || "");
      setCourses(profile.courses);
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки профиля преподавателя");
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

  const isStudent = viewer?.role === "student";
  const enrolledSet = new Set(viewer?.enrolledCourses || []);

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
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border bg-muted">
                {teacherAvatarUrl ? (
                  <img src={teacherAvatarUrl} alt={teacherName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <UserRound className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <CardTitle className="break-words text-2xl [overflow-wrap:anywhere]">{teacherName}</CardTitle>
                <CardDescription>Публичный профиль преподавателя</CardDescription>
                {teacherEmail && (
                  <a
                    href={`mailto:${teacherEmail}`}
                    className="mt-2 inline-flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    {teacherEmail}
                  </a>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        <div>
          <h2 className="mb-4 text-2xl font-semibold">Опубликованные курсы</h2>
          {courses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">У преподавателя пока нет опубликованных курсов</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => {
                const isEnrolled = enrolledSet.has(course.id);

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

                        {isStudent && !isEnrolled && (
                          <Button onClick={() => handleEnroll(course.id)} className="flex-1">
                            Записаться
                          </Button>
                        )}

                        {isStudent && isEnrolled && (
                          <Link to={`/courses/${course.id}`} className="flex-1">
                            <Button className="w-full">Открыть</Button>
                          </Link>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
