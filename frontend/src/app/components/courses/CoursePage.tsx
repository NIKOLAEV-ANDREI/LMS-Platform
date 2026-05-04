import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { Award, BookOpen, CheckCircle, ClipboardList, Clock, FileText, TrendingUp, Users, Video } from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { api, Course, Progress as CourseProgress, User } from "../../utils/api";
import { formatRuCount } from "../../utils/plural";

type CoursePageLocationState = {
  openModuleId?: string;
};

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  const [course, setCourse] = useState<Course | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [openModuleId, setOpenModuleId] = useState("");

  const moduleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const openFromStateApplied = useRef(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      if (!id) return;

      const { user: userData } = await api.getSession();
      setUser(userData);

      const { course: courseData } = await api.getCourse(id);
      setCourse(courseData);

      if (userData.role === "student" && userData.enrolledCourses.includes(id)) {
        const { progress: progressData } = await api.getProgress(id);
        setProgress(progressData);
      } else {
        setProgress(null);
      }
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки курса");
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!course) return;
    try {
      await api.enrollCourse(course.id);
      toast.success("Вы записались на курс");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Ошибка записи на курс");
    }
  };

  const modules = course?.modules ?? [];
  const totalLessons = modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const isEnrolled = Boolean(user?.enrolledCourses.includes(course?.id ?? ""));
  const completedLessonsSet = useMemo(() => new Set(progress?.completedLessons ?? []), [progress?.completedLessons]);

  useEffect(() => {
    if (!modules.length) return;
    const state = (location.state ?? null) as CoursePageLocationState | null;
    const requestedModuleId = state?.openModuleId;
    if (!requestedModuleId || openFromStateApplied.current) return;

    const exists = modules.some((module) => module.id === requestedModuleId);
    if (!exists) return;

    openFromStateApplied.current = true;
    setOpenModuleId(requestedModuleId);
  }, [modules, location.state]);

  useEffect(() => {
    if (!openModuleId) return;
    const target = moduleRefs.current[openModuleId];
    if (!target) return;

    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [openModuleId]);

  if (loading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  if (!course) {
    return (
      <Layout>
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Курс не найден</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {course.imageUrl && (
          <div className="aspect-video overflow-hidden rounded-lg bg-gray-200">
            <img src={course.imageUrl} alt={course.title} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="min-w-0 space-y-2">
          <h1 className="break-words text-4xl font-bold [overflow-wrap:anywhere]">{course.title}</h1>
          <p className="break-words text-lg text-muted-foreground [overflow-wrap:anywhere]">{course.description}</p>

          <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span>{formatRuCount(course.modules.length, "модуль", "модуля", "модулей")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{formatRuCount(totalLessons, "урок", "урока", "уроков")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>{formatRuCount(course.enrolledStudents.length, "студент", "студента", "студентов")}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Преподаватель:</span>
            <span className="font-medium break-words [overflow-wrap:anywhere]">{course.teacherName}</span>
            <Link to={`/teachers/${course.teacherId}`}>
              <Button type="button" variant="outline" size="sm">
                Профиль
              </Button>
            </Link>
          </div>
        </div>

        {user?.role === "student" && !isEnrolled && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle>Предпросмотр курса</CardTitle>
              <CardDescription>
                Вы можете изучить программу курса перед записью. Для прохождения уроков нажмите кнопку ниже.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleEnroll}>Записаться на курс</Button>
            </CardContent>
          </Card>
        )}

        {isEnrolled && progress && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {progress.progress === 100 ? (
                  <>
                    <Award className="h-5 w-5 text-primary" />
                    Курс завершен!
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Ваш прогресс
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>
                  Пройдено {progress.completedLessons.length} из {totalLessons} уроков
                </span>
                <span className="font-medium">{progress.progress}%</span>
              </div>
              <Progress value={progress.progress} className="h-2" />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Программа курса</CardTitle>
            <CardDescription>Модули и уроки курса</CardDescription>
          </CardHeader>
          <CardContent>
            {course.modules.length === 0 ? (
              <div className="py-12 text-center">
                <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Программа курса еще не добавлена</p>
              </div>
            ) : (
              <Accordion
                type="single"
                collapsible
                value={openModuleId}
                onValueChange={(value) => setOpenModuleId(value)}
                className="w-full"
              >
                {course.modules.map((module, moduleIndex) => {
                  const totalModuleLessons = module.lessons.length;
                  const completedModuleLessons = module.lessons.filter((lesson) => completedLessonsSet.has(lesson.id)).length;
                  const isModuleCompleted = totalModuleLessons > 0 && completedModuleLessons === totalModuleLessons;

                  return (
                    <AccordionItem
                      key={module.id}
                      value={module.id}
                      ref={(element) => {
                        moduleRefs.current[module.id] = element;
                      }}
                    >
                      <AccordionTrigger
                        className={`min-w-0 rounded-md px-3 transition-colors ${
                          isModuleCompleted ? "bg-green-50 hover:bg-green-100" : ""
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2 text-left">
                          <span className="shrink-0 font-semibold">Модуль {moduleIndex + 1}:</span>
                          <span className="min-w-0 flex-1 truncate" title={module.title}>
                            {module.title}
                          </span>
                          <span className="shrink-0 text-sm text-muted-foreground">({module.lessons.length})</span>
                          {isModuleCompleted && <span className="shrink-0 text-xs font-semibold text-green-700">Пройден</span>}
                        </div>
                      </AccordionTrigger>

                      <AccordionContent>
                        <div className="space-y-2 pt-4">
                          {module.description && (
                            <p className="mb-4 text-sm text-muted-foreground break-words [overflow-wrap:anywhere]">
                              {module.description}
                            </p>
                          )}

                          {module.lessons.map((lesson) => {
                            const isCompleted = progress?.completedLessons.includes(lesson.id);

                            return (
                              <div
                                key={lesson.id}
                                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-gray-50"
                              >
                                {lesson.type === "text" && <FileText className="h-5 w-5 text-blue-500" />}
                                {lesson.type === "video" && <Video className="h-5 w-5 text-purple-500" />}
                                {lesson.type === "test" && <ClipboardList className="h-5 w-5 text-green-500" />}

                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-medium" title={lesson.title}>
                                    {lesson.title}
                                  </div>
                                  <div className="text-sm capitalize text-muted-foreground">{lesson.type}</div>
                                </div>

                                {isCompleted && <CheckCircle className="h-5 w-5 text-green-500" />}

                                {isEnrolled && (
                                  <Link to={`/courses/${course.id}/lessons/${lesson.id}`}>
                                    <Button size="sm">{isCompleted ? "Повторить" : "Начать"}</Button>
                                  </Link>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
