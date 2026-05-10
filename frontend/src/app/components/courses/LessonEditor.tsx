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
import { api, Course, Lesson, LessonAttachment, TestSettings } from "../../utils/api";
import { applyTextLimit, LIMITS } from "../../utils/limits";
import { sanitizeRichText, toPlainText } from "../../utils/richText";

type EditableQuestion = {
  id: string;
  type: "single" | "multiple" | "open" | "true_false";
  question: string;
  options: string[];
  correctAnswer?: number;
  correctAnswers: number[];
  correctText: string;
  difficulty: number;
};

const MIN_TEST_OPTIONS = 2;
const MAX_TEST_OPTIONS = 8;
const DEFAULT_TEST_OPTIONS = 4;

type LessonDraft = {
  lessonForm: {
    title: string;
    content: string;
    type: "text" | "video" | "test";
    videoUrl: string;
    requiresReview: boolean;
    attachments: LessonAttachment[];
  };
  testSettings: TestSettings;
  testQuestions: EditableQuestion[];
  savedAt: string;
};

const defaultTestSettings: TestSettings = {
  timeLimitSec: 0,
  passScore: 70,
  maxAttempts: 3,
  randomQuestionCount: 0,
  shuffleQuestions: false,
  shuffleOptions: false,
  showCorrectAnswers: false,
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
  const [testSettings, setTestSettings] = useState<TestSettings>(defaultTestSettings);
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
        testSettings,
        testQuestions,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [draftReady, draftStorageKey, lessonForm, testSettings, testQuestions]);

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
              options:
                question.type === "true_false"
                  ? Array.isArray(question.options) && question.options.length > 0
                    ? question.options
                    : ["Верно", "Неверно"]
                  : Array.isArray(question.options) && question.options.length > 0
                  ? question.options
                  : Array.from({ length: DEFAULT_TEST_OPTIONS }, () => ""),
              correctAnswer: typeof question.correctAnswer === "number" ? question.correctAnswer : 0,
              correctAnswers: Array.isArray(question.correctAnswers) ? question.correctAnswers : [],
              correctText: question.correctText || "",
              difficulty: typeof question.difficulty === "number" ? question.difficulty : 3,
            }))
          : [];
      const serverSettings: TestSettings =
        foundLesson.type === "test" && foundLesson.test?.settings
          ? {
              timeLimitSec: Number(foundLesson.test.settings.timeLimitSec ?? 0),
              passScore: Number(foundLesson.test.settings.passScore ?? 70),
              maxAttempts: Number(foundLesson.test.settings.maxAttempts ?? 3),
              randomQuestionCount: Number(foundLesson.test.settings.randomQuestionCount ?? 0),
              shuffleQuestions: Boolean(foundLesson.test.settings.shuffleQuestions),
              shuffleOptions: Boolean(foundLesson.test.settings.shuffleOptions),
              showCorrectAnswers: Boolean(foundLesson.test.settings.showCorrectAnswers),
            }
          : defaultTestSettings;

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
        setTestSettings(draftData.testSettings || serverSettings);
        setTestQuestions(Array.isArray(draftData.testQuestions) ? draftData.testQuestions : []);
        toast.info("Черновик урока восстановлен");
      } else {
        setLessonForm(serverLessonForm);
        setTestSettings(serverSettings);
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
        options: Array.from({ length: DEFAULT_TEST_OPTIONS }, () => ""),
        correctAnswer: 0,
        correctAnswers: [],
        correctText: "",
        difficulty: 3,
      },
    ]);
  };

  const updateQuestion = (index: number, patch: Partial<EditableQuestion>) => {
    setTestQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const updateQuestionType = (index: number, type: EditableQuestion["type"]) => {
    setTestQuestions((prev) => {
      const next = [...prev];
      const question = next[index];
      if (!question) return prev;

      if (type === "open") {
        next[index] = {
          ...question,
          type,
          options: [],
          correctAnswer: undefined,
          correctAnswers: [],
          correctText: question.correctText || "",
        };
        return next;
      }

      const options = type === "true_false"
        ? ["Верно", "Неверно"]
        : question.options.length >= MIN_TEST_OPTIONS
          ? [...question.options]
          : Array.from({ length: DEFAULT_TEST_OPTIONS }, () => "");

      next[index] = {
        ...question,
        type,
        options,
        correctAnswer: type === "multiple" ? undefined : Math.min(question.correctAnswer ?? 0, options.length - 1),
        correctAnswers: type === "multiple" ? question.correctAnswers : [],
        correctText: "",
      };
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

  const updateQuestionOptionsCount = (questionIndex: number, nextCountValue: string) => {
    const parsedCount = Number(nextCountValue);
    if (!Number.isFinite(parsedCount)) return;
    const count = Math.max(MIN_TEST_OPTIONS, Math.min(MAX_TEST_OPTIONS, parsedCount));

    setTestQuestions((prev) => {
      const next = [...prev];
      const question = next[questionIndex];
      if (!question) return prev;

      const options = [...question.options];
      if (options.length < count) {
        while (options.length < count) {
          options.push("");
        }
      } else if (options.length > count) {
        options.length = count;
      }

      next[questionIndex] = {
        ...question,
        options,
        correctAnswer: question.type === "multiple" ? undefined : Math.min(question.correctAnswer ?? 0, count - 1),
        correctAnswers: question.correctAnswers.filter((optionIndex) => optionIndex < count),
      };
      return next;
    });
  };

  const toggleMultipleAnswer = (questionIndex: number, optionIndex: number, checked: boolean) => {
    setTestQuestions((prev) => {
      const next = [...prev];
      const question = next[questionIndex];
      if (!question) return prev;

      const indexes = new Set(question.correctAnswers || []);
      if (checked) indexes.add(optionIndex);
      else indexes.delete(optionIndex);

      next[questionIndex] = {
        ...question,
        correctAnswers: Array.from(indexes).sort((a, b) => a - b),
      };
      return next;
    });
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

    const preparedTestQuestions =
      lessonForm.type === "test"
        ? testQuestions.map((question) => ({
            id: question.id,
            type: question.type,
            question: question.question,
            options: question.type === "open" ? [] : question.options,
            correctAnswer:
              question.type === "single" || question.type === "true_false"
                ? question.correctAnswer ?? 0
                : undefined,
            correctAnswers: question.type === "multiple" ? question.correctAnswers : undefined,
            correctText: question.type === "open" ? question.correctText : undefined,
            difficulty: question.difficulty,
          }))
        : [];

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
      test: lessonForm.type === "test" ? { settings: testSettings, questions: preparedTestQuestions } : undefined,
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
                  <Card className="border-dashed">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Настройки теста</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Проходной балл (%) (макс {LIMITS.testPassScoreMax})</Label>
                        <Input
                          type="number"
                          min={LIMITS.testPassScoreMin}
                          max={LIMITS.testPassScoreMax}
                          value={testSettings.passScore}
                          onChange={(event) =>
                            setTestSettings((prev) => ({
                              ...prev,
                              passScore: Math.max(
                                LIMITS.testPassScoreMin,
                                Math.min(LIMITS.testPassScoreMax, Number(event.target.value || prev.passScore)),
                              ),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Максимум попыток (макс {LIMITS.testAttemptsMax})</Label>
                        <Input
                          type="number"
                          min={LIMITS.testAttemptsMin}
                          max={LIMITS.testAttemptsMax}
                          value={testSettings.maxAttempts}
                          onChange={(event) =>
                            setTestSettings((prev) => ({
                              ...prev,
                              maxAttempts: Math.max(
                                LIMITS.testAttemptsMin,
                                Math.min(LIMITS.testAttemptsMax, Number(event.target.value || prev.maxAttempts)),
                              ),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Лимит времени (мин) (макс {LIMITS.testTimeLimitMaxMin})</Label>
                        <Input
                          type="number"
                          min={0}
                          max={LIMITS.testTimeLimitMaxMin}
                          value={Math.floor(testSettings.timeLimitSec / 60)}
                          onChange={(event) =>
                            setTestSettings((prev) => ({
                              ...prev,
                              timeLimitSec: Math.max(0, Math.min(LIMITS.testTimeLimitMaxMin, Number(event.target.value || 0))) * 60,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Случайных вопросов в попытке (макс {LIMITS.testRandomQuestionsMax})</Label>
                        <Input
                          type="number"
                          min={0}
                          max={LIMITS.testRandomQuestionsMax}
                          value={testSettings.randomQuestionCount}
                          onChange={(event) =>
                            setTestSettings((prev) => ({
                              ...prev,
                              randomQuestionCount: Math.max(
                                0,
                                Math.min(
                                  Math.min(LIMITS.testRandomQuestionsMax, Math.max(0, testQuestions.length)),
                                  Number(event.target.value || 0),
                                ),
                              ),
                            }))
                          }
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={testSettings.shuffleQuestions}
                          onChange={(event) =>
                            setTestSettings((prev) => ({
                              ...prev,
                              shuffleQuestions: event.target.checked,
                            }))
                          }
                        />
                        Перемешивать вопросы
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={testSettings.shuffleOptions}
                          onChange={(event) =>
                            setTestSettings((prev) => ({
                              ...prev,
                              shuffleOptions: event.target.checked,
                            }))
                          }
                        />
                        Перемешивать варианты ответов
                      </label>
                      <label className="flex items-center gap-2 text-sm md:col-span-2">
                        <input
                          type="checkbox"
                          checked={testSettings.showCorrectAnswers}
                          onChange={(event) =>
                            setTestSettings((prev) => ({
                              ...prev,
                              showCorrectAnswers: event.target.checked,
                            }))
                          }
                        />
                        Показывать правильные ответы после отправки теста
                      </label>
                    </CardContent>
                  </Card>

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
                            onChange={(event) =>
                              updateQuestion(questionIndex, {
                                question: applyTextLimit(event.target.value, LIMITS.questionText, `Текст вопроса ${questionIndex + 1}`),
                              })
                            }
                            required
                          />
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeQuestion(questionIndex)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <CharCounter value={question.question || ""} max={LIMITS.questionText} />
                        <div className="grid gap-2 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-sm">Тип вопроса</Label>
                            <Select value={question.type} onValueChange={(value) => updateQuestionType(questionIndex, value as EditableQuestion["type"])}>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="single">Один вариант</SelectItem>
                                <SelectItem value="multiple">Несколько вариантов</SelectItem>
                                <SelectItem value="open">Открытый ответ</SelectItem>
                                <SelectItem value="true_false">Верно/Неверно</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm">Сложность</Label>
                            <Select
                              value={String(question.difficulty || 3)}
                              onValueChange={(value) => updateQuestion(questionIndex, { difficulty: Number(value) })}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1</SelectItem>
                                <SelectItem value="2">2</SelectItem>
                                <SelectItem value="3">3</SelectItem>
                                <SelectItem value="4">4</SelectItem>
                                <SelectItem value="5">5</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {question.type === "open" ? (
                          <div className="space-y-2">
                            <Label className="text-sm">Правильный ответ</Label>
                            <Input
                              value={question.correctText}
                              onChange={(event) =>
                                updateQuestion(questionIndex, {
                                  correctText: applyTextLimit(event.target.value, LIMITS.questionOption, `Ответ на вопрос ${questionIndex + 1}`),
                                })
                              }
                              required
                            />
                          </div>
                        ) : (
                          <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Label className="text-sm">Варианты ответов</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Кол-во:</span>
                            <Select
                              value={String(question.options.length)}
                              disabled={question.type === "true_false"}
                              onValueChange={(value) => updateQuestionOptionsCount(questionIndex, value)}
                            >
                              <SelectTrigger className="h-8 w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: MAX_TEST_OPTIONS - MIN_TEST_OPTIONS + 1 }, (_, idx) => {
                                  const value = String(MIN_TEST_OPTIONS + idx);
                                  return (
                                    <SelectItem key={`${question.id}-options-${value}`} value={value}>
                                      {value}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
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
                              type={question.type === "multiple" ? "checkbox" : "radio"}
                              name={`correct-${questionIndex}`}
                              checked={
                                question.type === "multiple"
                                  ? question.correctAnswers.includes(optionIndex)
                                  : question.correctAnswer === optionIndex
                              }
                              onChange={(event) => {
                                if (question.type === "multiple") {
                                  toggleMultipleAnswer(questionIndex, optionIndex, event.target.checked);
                                } else {
                                  updateQuestion(questionIndex, { correctAnswer: optionIndex });
                                }
                              }}
                              className="h-4 w-4 text-primary"
                            />
                          </div>
                        ))}
                          </>
                        )}
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


