import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import Layout from "../Layout";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { api, Course, Module, Lesson } from "../../utils/api";
import { Plus, BookOpen, FileText, Video, ClipboardList, Trash2, Pencil, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import CharCounter from "../shared/CharCounter";
import { applyTextLimit, LIMITS } from "../../utils/limits";

type ModuleMode = "create" | "edit";

export default function CourseEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminMode = location.pathname.startsWith("/admin/courses/");
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [courseSaving, setCourseSaving] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: "", description: "" });

  const [moduleDialog, setModuleDialog] = useState(false);
  const [moduleMode, setModuleMode] = useState<ModuleMode>("create");
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [moduleForm, setModuleForm] = useState({ title: "", description: "" });

  const [lessonDialog, setLessonDialog] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({
    title: "",
    type: "text" as "text" | "video" | "test",
    requiresReview: false,
  });

  useEffect(() => {
    loadCourse();
  }, [id]);

  const loadCourse = async () => {
    try {
      if (!id) return;
      const { course: courseData } = await api.getCourse(id);
      setCourse(courseData);
      setCourseForm({ title: courseData.title, description: courseData.description });
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки курса");
      navigate(isAdminMode ? "/admin/dashboard" : "/teacher/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModule = () => {
    setModuleMode("create");
    setEditingModuleId(null);
    setModuleForm({ title: "", description: "" });
    setModuleDialog(true);
  };

  const openEditModule = (module: Module) => {
    setModuleMode("edit");
    setEditingModuleId(module.id);
    setModuleForm({ title: module.title, description: module.description || "" });
    setModuleDialog(true);
  };

  const submitModule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!id) return;
      if (moduleMode === "create") {
        if (isAdminMode) {
          await api.addModuleAsAdmin(id, moduleForm.title, moduleForm.description);
        } else {
          await api.addModule(id, moduleForm.title, moduleForm.description);
        }
        toast.success("Модуль добавлен");
      } else {
        if (!editingModuleId) return;
        if (isAdminMode) {
          await api.updateModuleAsAdmin(id, editingModuleId, moduleForm.title, moduleForm.description);
        } else {
          await api.updateModule(id, editingModuleId, moduleForm.title, moduleForm.description);
        }
        toast.success("Модуль обновлен");
      }
      setModuleDialog(false);
      await loadCourse();
    } catch (error: any) {
      toast.error(error.message || "Ошибка сохранения модуля");
    }
  };

  const removeModule = async (module: Module) => {
    if (!id) return;
    if (!window.confirm(`Удалить модуль \"${module.title}\" вместе со всеми уроками?`)) return;

    try {
      if (isAdminMode) {
        await api.deleteModuleAsAdmin(id, module.id);
      } else {
        await api.deleteModule(id, module.id);
      }
      toast.success("Модуль удален");
      await loadCourse();
    } catch (error: any) {
      toast.error(error.message || "Ошибка удаления модуля");
    }
  };

  const openCreateLesson = (moduleId: string) => {
    setSelectedModuleId(moduleId);
    setLessonForm({ title: "", type: "text", requiresReview: false });
    setLessonDialog(true);
  };

  const openEditLesson = (lesson: Lesson) => {
    const editPath = isAdminMode
      ? `/admin/courses/${id}/lessons/${lesson.id}/edit`
      : `/courses/${id}/lessons/${lesson.id}/edit`;
    navigate(editPath);
  };

  const submitLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!id || !selectedModuleId) return;

      const lessonData: Partial<Lesson> = {
        title: lessonForm.title,
        type: lessonForm.type,
        content: "",
        videoUrl: "",
        requiresReview: lessonForm.type !== "test" && lessonForm.requiresReview,
      };

      if (lessonForm.type === "test") {
        lessonData.test = {
          questions: [
            {
              id: `q-${Date.now()}`,
              type: "single",
              question: "Новый вопрос",
              options: ["Вариант 1", "Вариант 2"],
              correctAnswer: 0,
            },
          ],
        };
      }

      if (isAdminMode) {
        await api.addLessonAsAdmin(id, selectedModuleId, lessonData);
      } else {
        await api.addLesson(id, selectedModuleId, lessonData);
      }
      toast.success("Урок добавлен");

      setLessonDialog(false);
      await loadCourse();
    } catch (error: any) {
      toast.error(error.message || "Ошибка сохранения урока");
    }
  };

  const removeLesson = async (moduleId: string, lesson: Lesson) => {
    if (!id) return;
    if (!window.confirm(`Удалить урок \"${lesson.title}\"?`)) return;

    try {
      if (isAdminMode) {
        await api.deleteLessonAsAdmin(id, moduleId, lesson.id);
      } else {
        await api.deleteLesson(id, moduleId, lesson.id);
      }
      toast.success("Урок удален");
      await loadCourse();
    } catch (error: any) {
      toast.error(error.message || "Ошибка удаления урока");
    }
  };

  const saveCourse = async () => {
    if (!id) return;
    setCourseSaving(true);
    try {
      if (isAdminMode) {
        await api.updateCourseAsAdmin(id, courseForm.title, courseForm.description);
      } else {
        await api.updateCourseAsTeacher(id, courseForm.title, courseForm.description);
      }
      toast.success("Курс обновлен");
      await loadCourse();
    } catch (error: any) {
      toast.error(error.message || "Ошибка обновления курса");
    } finally {
      setCourseSaving(false);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(isAdminMode ? "/admin/dashboard" : "/teacher/dashboard");
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

  if (!course) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Курс не найден</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <Button variant="outline" className="gap-2" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
        </div>

        <div className="flex justify-between items-center">
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-bold [overflow-wrap:anywhere]">{courseForm.title || course.title}</h1>
            <p className="text-muted-foreground mt-1">Редактор курса</p>
          </div>
          <Button variant="outline" onClick={() => navigate(`/courses/${id}`)}>
            Просмотр курса
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Данные курса</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="course-title">Название курса</Label>
              <Input
                id="course-title"
                value={courseForm.title}
                onChange={(e) =>
                  setCourseForm((prev) => ({
                    ...prev,
                    title: applyTextLimit(e.target.value, LIMITS.courseTitle, "Название курса"),
                  }))
                }
              />
              <CharCounter value={courseForm.title} max={LIMITS.courseTitle} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-description">Описание курса</Label>
              <Textarea
                id="course-description"
                rows={4}
                value={courseForm.description}
                onChange={(e) =>
                  setCourseForm((prev) => ({
                    ...prev,
                    description: applyTextLimit(e.target.value, LIMITS.courseDescription, "Описание курса"),
                  }))
                }
              />
              <CharCounter value={courseForm.description} max={LIMITS.courseDescription} />
            </div>
            <Button onClick={saveCourse} disabled={courseSaving}>
              {courseSaving ? "Сохранение..." : "Сохранить курс"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Модули и уроки</CardTitle>
            <Dialog open={moduleDialog} onOpenChange={setModuleDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={openCreateModule}>
                  <Plus className="h-4 w-4" />
                  Добавить модуль
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{moduleMode === "create" ? "Добавить модуль" : "Редактировать модуль"}</DialogTitle>
                  <DialogDescription>
                    {moduleMode === "create" ? "Создайте новый модуль для курса" : "Обновите данные модуля"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={submitModule} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="module-title">Название модуля</Label>
                    <Input
                      id="module-title"
                      value={moduleForm.title}
                      onChange={(e) =>
                        setModuleForm({
                          ...moduleForm,
                          title: applyTextLimit(e.target.value, LIMITS.moduleTitle, "Название модуля"),
                        })
                      }
                      required
                    />
                    <CharCounter value={moduleForm.title} max={LIMITS.moduleTitle} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="module-desc">Описание</Label>
                    <Textarea
                      id="module-desc"
                      value={moduleForm.description}
                      onChange={(e) =>
                        setModuleForm({
                          ...moduleForm,
                          description: applyTextLimit(e.target.value, LIMITS.moduleDescription, "Описание модуля"),
                        })
                      }
                      rows={3}
                    />
                    <CharCounter value={moduleForm.description} max={LIMITS.moduleDescription} />
                  </div>
                  <Button type="submit" className="w-full">
                    {moduleMode === "create" ? "Добавить модуль" : "Сохранить изменения"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>

          <CardContent>
            {course.modules.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Модули еще не добавлены</p>
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {course.modules.map((module, moduleIndex) => (
                  <AccordionItem key={module.id} value={module.id}>
                    <div className="flex items-center gap-2">
                      <AccordionTrigger className="flex-1 min-w-0">
                        <div className="flex min-w-0 items-center gap-2 text-left">
                          <span className="shrink-0 font-semibold">Модуль {moduleIndex + 1}:</span>
                          <span className="min-w-0 flex-1 truncate" title={module.title}>
                            {module.title}
                          </span>
                          <span className="shrink-0 text-sm text-muted-foreground">({module.lessons.length} урок.)</span>
                        </div>
                      </AccordionTrigger>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModule(module)}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeModule(module)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        {module.description && (
                          <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                            {module.description}
                          </p>
                        )}

                        <div className="space-y-2">
                          {module.lessons.map((lesson) => (
                            <div key={lesson.id} className="flex items-center gap-3 p-3 border rounded-lg">
                              {lesson.type === "text" && <FileText className="h-5 w-5 text-blue-500" />}
                              {lesson.type === "video" && <Video className="h-5 w-5 text-purple-500" />}
                              {lesson.type === "test" && <ClipboardList className="h-5 w-5 text-green-500" />}

                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{lesson.title}</div>
                                <div className="text-sm text-muted-foreground capitalize">{lesson.type}</div>
                              </div>

                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditLesson(lesson)}
                                  className="h-8 w-8"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeLesson(module.id, lesson)}
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <Button
                          onClick={() => openCreateLesson(module.id)}
                          variant="outline"
                          className="w-full gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Добавить урок
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>

        <Dialog open={lessonDialog} onOpenChange={setLessonDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Добавить урок</DialogTitle>
              <DialogDescription>Укажите название и тип урока. Детальная настройка доступна в редакторе урока.</DialogDescription>
            </DialogHeader>

            <form onSubmit={submitLesson} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lesson-title">Название урока</Label>
                <Input
                  id="lesson-title"
                  value={lessonForm.title}
                  onChange={(e) =>
                    setLessonForm({
                      ...lessonForm,
                      title: applyTextLimit(e.target.value, LIMITS.lessonTitle, "Название урока"),
                    })
                  }
                  required
                />
                <CharCounter value={lessonForm.title} max={LIMITS.lessonTitle} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lesson-type">Тип урока</Label>
                <Select
                  value={lessonForm.type}
                  onValueChange={(value: "text" | "video" | "test") =>
                    setLessonForm((prev) => ({
                      ...prev,
                      type: value,
                      requiresReview: value === "test" ? false : prev.requiresReview,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Текстовый урок</SelectItem>
                    <SelectItem value="video">Видео</SelectItem>
                    <SelectItem value="test">Тест</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(lessonForm.type === "text" || lessonForm.type === "video") && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={lessonForm.requiresReview}
                    onChange={(event) =>
                      setLessonForm((prev) => ({
                        ...prev,
                        requiresReview: event.target.checked,
                      }))
                    }
                  />
                  Требуется проверка преподавателем
                </label>
              )}

              <Button type="submit" className="w-full">
                Добавить урок
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
