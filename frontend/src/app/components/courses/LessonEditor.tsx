import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, ClipboardList, Paperclip, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import CharCounter from "../shared/CharCounter";
import RichTextEditor from "../shared/RichTextEditor";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { api, Course, Lesson, LessonAttachment } from "../../utils/api";
import { applyTextLimit, LIMITS } from "../../utils/limits";
import { sanitizeRichText, toPlainText } from "../../utils/richText";

type EditableQuestion = {
  id: string;
  type: "single" | "multiple" | "open";
  question: string;
  options: string[];
  correctAnswer: number;
};

type LessonDraft = {
  lessonForm: {
    title: string;
    content: string;
    type: "text" | "video" | "test";
    videoUrl: string;
    requiresReview: boolean;
    attachments: LessonAttachment[];
  };
  testQuestions: EditableQuestion[];
  savedAt: string;
};

export default function LessonEditor() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminMode = location.pathname.startsWith("/admin/courses/");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [lessonForm, setLessonForm] = useState({
    title: "",
    content: "",
    type: "text" as "text" | "video" | "test",
    videoUrl: "",
    requiresReview: false,
    attachments: [] as LessonAttachment[],
  });
  const [testQuestions, setTestQuestions] = useState<EditableQuestion[]>([]);
  const draftStorageKey = courseId && lessonId ? `lms:lesson-editor-draft:${courseId}:${lessonId}` : null;

  useEffect(() => {
    loadLesson();
  }, [courseId, lessonId]);

  useEffect(() => {
    if (!draftReady || !draftStorageKey) return;
    const timer = window.setTimeout(() => {
      const draft: LessonDraft = {
        lessonForm,
        testQuestions,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [draftReady, draftStorageKey, lessonForm, testQuestions]);

  const loadLesson = async () => {
    try {
      setDraftReady(false);
      if (!courseId || !lessonId) return;
      const { course: courseData } = await api.getCourse(courseId);
      setCourse(courseData);

      let foundLesson: Lesson | null = null;
      let foundModuleId: string | null = null;
      for (const module of courseData.modules) {
        const currentLesson = module.lessons.find((entry) => entry.id === lessonId);
        if (currentLesson) {
          foundLesson = currentLesson;
          foundModuleId = module.id;
          break;
        }
      }

      if (!foundLesson || !foundModuleId) {
        toast.error("Урок не найден");
        navigate(isAdminMode ? `/admin/courses/${courseId}/edit` : `/courses/${courseId}/edit`);
        return;
      }

      setLesson(foundLesson);
      setModuleId(foundModuleId);
      const serverLessonForm = {
        title: foundLesson.title,
        content: foundLesson.content || "",
        type: foundLesson.type,
        videoUrl: foundLesson.videoUrl || "",
        requiresReview: Boolean(foundLesson.requiresReview),
        attachments: Array.isArray(foundLesson.attachments) ? foundLesson.attachments : [],
      };

      const serverQuestions =
        foundLesson.type === "test" && foundLesson.test?.questions?.length
          ? foundLesson.test.questions.map((question, index) => ({
              id: question.id || `q-${Date.now()}-${index}`,
              type: question.type || "single",
              question: question.question || "",
              options: Array.isArray(question.options) && question.options.length > 0 ? question.options : ["", "", "", ""],
              correctAnswer: typeof question.correctAnswer === "number" ? question.correctAnswer : 0,
            }))
          : [];

      let draftData: LessonDraft | null = null;
      if (draftStorageKey) {
        const rawDraft = localStorage.getItem(draftStorageKey);
        if (rawDraft) {
          try {
            const parsed = JSON.parse(rawDraft) as LessonDraft;
            if (parsed?.lessonForm?.title !== undefined && parsed?.lessonForm?.content !== undefined) {
              draftData = parsed;
            }
          } catch {
            localStorage.removeItem(draftStorageKey);
          }
        }
      }

      if (draftData) {
        setLessonForm({
          ...draftData.lessonForm,
          requiresReview: Boolean(draftData.lessonForm.requiresReview),
          attachments: Array.isArray(draftData.lessonForm.attachments) ? draftData.lessonForm.attachments : [],
        });
        setTestQuestions(Array.isArray(draftData.testQuestions) ? draftData.testQuestions : []);
        toast.info("Черновик урока восстановлен");
      } else {
        setLessonForm(serverLessonForm);
        setTestQuestions(serverQuestions);
      }

      setDraftReady(true);
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки урока");
      navigate(isAdminMode ? "/admin/dashboard" : "/teacher/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const addTestQuestion = () => {
    setTestQuestions((prev) => [
      ...prev,
      {
        id: `q-${Date.now()}-${Math.random()}`,
        type: "single",
        question: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
      },
    ]);
  };

  const updateQuestion = (index: number, field: "question" | "correctAnswer", value: string | number) => {
    setTestQuestions((prev) => {
      const next = [...prev];
      if (field === "question") {
        next[index] = {
          ...next[index],
          question: applyTextLimit(String(value), LIMITS.questionText, `Текст вопроса ${index + 1}`),
        };
      } else {
        next[index] = { ...next[index], correctAnswer: Number(value) };
      }
      return next;
    });
  };

  const updateQuestionOption = (questionIndex: number, optionIndex: number, value: string) => {
    setTestQuestions((prev) => {
      const next = [...prev];
      next[questionIndex] = { ...next[questionIndex], options: [...next[questionIndex].options] };
      next[questionIndex].options[optionIndex] = applyTextLimit(
        value,
        LIMITS.questionOption,
        `Вариант ответа ${optionIndex + 1} для вопроса ${questionIndex + 1}`,
      );
      return next;
    });
  };

  const removeQuestion = (index: number) => {
    setTestQuestions((prev) => prev.filter((_, current) => current !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  const toDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
      reader.readAsDataURL(file);
    });

  const addAttachments = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    const availableSlots = LIMITS.lessonAttachmentsMaxCount - lessonForm.attachments.length;
    if (availableSlots <= 0) {
      toast.error(`Можно прикрепить не более ${LIMITS.lessonAttachmentsMaxCount} файлов`);
      return;
    }
    if (files.length > availableSlots) {
      toast.error(`Добавлены только первые ${availableSlots} файлов из выбранных`);
    }

    const filesForUpload = files.slice(0, availableSlots);
    const nextAttachments: LessonAttachment[] = [];
    for (const [index, file] of filesForUpload.entries()) {
      if (file.size > LIMITS.lessonAttachmentMaxSize) {
        toast.error(`Файл "${file.name}" больше ${(LIMITS.lessonAttachmentMaxSize / (1024 * 1024)).toFixed(0)} МБ`);
        continue;
      }
      try {
        const dataUrl = await toDataUrl(file);
        nextAttachments.push({
          id: `att-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
          name: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
          url: dataUrl,
        });
      } catch (error: any) {
        toast.error(error?.message || `Не удалось добавить файл "${file.name}"`);
      }
    }

    if (nextAttachments.length === 0) return;
    setLessonForm((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...nextAttachments],
    }));
  };

  const removeAttachment = (attachmentId: string) => {
    setLessonForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((attachment) => attachment.id !== attachmentId),
    }));
  };

  const saveLesson = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!courseId || !moduleId || !lesson) return;

    const payload: Partial<Lesson> = {
      title: lessonForm.title,
      content:
        lessonForm.type === "text"
          ? sanitizeRichText(lessonForm.content)
          : lessonForm.type === "video"
            ? lessonForm.content
            : "",
      type: lessonForm.type,
      videoUrl: lessonForm.type === "video" ? lessonForm.videoUrl : "",
      requiresReview: lessonForm.type === "test" ? false : lessonForm.requiresReview,
      attachments: lessonForm.type === "text" || lessonForm.type === "video" ? lessonForm.attachments : [],
      test: lessonForm.type === "test" ? { questions: testQuestions } : undefined,
    };

    setSaving(true);
    try {
      if (isAdminMode) {
        await api.updateLessonAsAdmin(courseId, moduleId, lesson.id, payload);
      } else {
        await api.updateLesson(courseId, moduleId, lesson.id, payload);
      }
      if (draftStorageKey) {
        localStorage.removeItem(draftStorageKey);
      }
      toast.success("Урок обновлен");
      await loadLesson();
    } catch (error: any) {
      toast.error(error.message || "Ошибка сохранения урока");
    } finally {
      setSaving(false);
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

  if (!course || !lesson || !moduleId) {
    return (
      <Layout>
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Урок не найден</p>
        </div>
      </Layout>
    );
  }

  const backToCourseEditor = isAdminMode ? `/admin/courses/${courseId}/edit` : `/courses/${courseId}/edit`;
  const goBackToCourseEditor = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(backToCourseEditor, { replace: true });
  };

  return (
    <Layout fullWidth>
      <div className="space-y-6">
        <div>
          <Button variant="outline" className="gap-2" onClick={goBackToCourseEditor}>
            <ArrowLeft className="h-4 w-4" />
            Назад к курсу
          </Button>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-bold [overflow-wrap:anywhere]">{lessonForm.title || lesson.title}</h1>
            <p className="mt-1 text-muted-foreground">Редактор урока</p>
          </div>

          <div className="flex gap-2">
            <Link to={`/courses/${courseId}`}>
              <Button variant="outline">Просмотр курса</Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Настройки урока
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveLesson} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="lesson-title">Название урока</Label>
                <Input
                  id="lesson-title"
                  value={lessonForm.title}
                  onChange={(event) =>
                    setLessonForm((prev) => ({
                      ...prev,
                      title: applyTextLimit(event.target.value, LIMITS.lessonTitle, "Название урока"),
                    }))
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
                  <SelectTrigger id="lesson-type">
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

              {lessonForm.type === "text" && (
                <div className="space-y-2">
                  <Label htmlFor="lesson-content">Содержание урока</Label>
                  <RichTextEditor
                    id="lesson-content"
                    value={lessonForm.content}
                    maxLength={LIMITS.lessonContent}
                    onChange={(nextValue) =>
                      setLessonForm((prev) => ({
                        ...prev,
                        content: nextValue,
                      }))
                    }
                    placeholder="Введите содержание урока..."
                  />
                  <CharCounter value={toPlainText(lessonForm.content)} max={LIMITS.lessonContent} />
                </div>
              )}

              {lessonForm.type === "video" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="video-url">URL видео (YouTube / VK Video / RuTube)</Label>
                    <Input
                      id="video-url"
                      type="url"
                      value={lessonForm.videoUrl}
                      onChange={(event) =>
                        setLessonForm((prev) => ({
                          ...prev,
                          videoUrl: applyTextLimit(event.target.value, LIMITS.videoUrl, "URL видео"),
                        }))
                      }
                      placeholder="https://rutube.ru/video/... или https://vkvideo.ru/video..."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="video-desc">Описание</Label>
                    <Textarea
                      id="video-desc"
                      value={lessonForm.content}
                      onChange={(event) =>
                        setLessonForm((prev) => ({
                          ...prev,
                          content: applyTextLimit(event.target.value, LIMITS.lessonContent, "Описание видео"),
                        }))
                      }
                      rows={6}
                    />
                    <CharCounter value={lessonForm.content} max={LIMITS.lessonContent} />
                  </div>
                </div>
              )}

              {lessonForm.type === "test" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Вопросы теста</Label>
                    <Button type="button" onClick={addTestQuestion} size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Добавить вопрос
                    </Button>
                  </div>

                  {testQuestions.map((question, questionIndex) => (
                    <Card key={question.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <Input
                            placeholder="Текст вопроса"
                            value={question.question}
                            onChange={(event) => updateQuestion(questionIndex, "question", event.target.value)}
                            required
                          />
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeQuestion(questionIndex)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <CharCounter value={question.question || ""} max={LIMITS.questionText} />
                        <Label className="text-sm">Варианты ответов</Label>
                        {question.options.map((option, optionIndex) => (
                          <div key={`${question.id}-${optionIndex}`} className="flex items-center gap-2">
                            <Input
                              placeholder={`Вариант ${optionIndex + 1}`}
                              value={option}
                              onChange={(event) => updateQuestionOption(questionIndex, optionIndex, event.target.value)}
                              required
                            />
                            <span className="min-w-[76px] text-right text-xs text-muted-foreground">
                              {option.length}/{LIMITS.questionOption}
                            </span>
                            <input
                              type="radio"
                              name={`correct-${questionIndex}`}
                              checked={question.correctAnswer === optionIndex}
                              onChange={() => updateQuestion(questionIndex, "correctAnswer", optionIndex)}
                              className="h-4 w-4 text-primary"
                            />
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {(lessonForm.type === "text" || lessonForm.type === "video") && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="lesson-files" className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-primary" />
                      Файлы урока
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {lessonForm.attachments.length}/{LIMITS.lessonAttachmentsMaxCount}
                    </span>
                  </div>

                  <input
                    id="lesson-files"
                    type="file"
                    multiple
                    onChange={addAttachments}
                    disabled={lessonForm.attachments.length >= LIMITS.lessonAttachmentsMaxCount}
                    className="hidden"
                  />
                  <label
                    htmlFor="lesson-files"
                    className={`inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors ${
                      lessonForm.attachments.length >= LIMITS.lessonAttachmentsMaxCount
                        ? "pointer-events-none opacity-50"
                        : "hover:border-primary hover:bg-primary/5"
                    }`}
                  >
                    Выберите файлы
                  </label>

                  <p className="text-xs text-muted-foreground">
                    До {LIMITS.lessonAttachmentsMaxCount} файлов, максимум{" "}
                    {(LIMITS.lessonAttachmentMaxSize / (1024 * 1024)).toFixed(0)} МБ на файл.
                  </p>

                  {lessonForm.attachments.length > 0 && (
                    <div className="space-y-2">
                      {lessonForm.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{attachment.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {attachment.contentType || "Файл"} - {formatFileSize(attachment.size || 0)}
                            </p>
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeAttachment(attachment.id)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить урок"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
