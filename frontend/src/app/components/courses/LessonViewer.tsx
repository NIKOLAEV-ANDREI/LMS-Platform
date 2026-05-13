import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, ArrowRight, Award, CheckCircle, Download, Paperclip, XCircle } from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Textarea } from "../ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  api,
  Course,
  Lesson,
  LessonSubmission,
  LessonTestAnalytics,
  LessonTestAttemptHistoryItem,
  LessonTestAttemptResult,
  LessonTestAttemptStart,
  LessonTestAnswer,
  User,
} from "../../utils/api";
import { LIMITS } from "../../utils/limits";
import { sanitizeRichText } from "../../utils/richText";

export default function LessonViewer() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [parentModuleId, setParentModuleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeAttempt, setActiveAttempt] = useState<LessonTestAttemptStart | null>(null);
  const [testAnswers, setTestAnswers] = useState<Record<string, LessonTestAnswer>>({});
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [testResult, setTestResult] = useState<LessonTestAttemptResult | null>(null);
  const [attemptHistory, setAttemptHistory] = useState<LessonTestAttemptHistoryItem[]>([]);
  const [teacherTestAnalytics, setTeacherTestAnalytics] = useState<LessonTestAnalytics | null>(null);
  const [teacherTestAttempts, setTeacherTestAttempts] = useState<LessonTestAttemptHistoryItem[]>([]);
  const [resettingStudentId, setResettingStudentId] = useState<string | null>(null);
  const [submittingTest, setSubmittingTest] = useState(false);
  const [startingTest, setStartingTest] = useState(false);
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [timeExpiredScreen, setTimeExpiredScreen] = useState(false);
  const [analyticsStudentFilter, setAnalyticsStudentFilter] = useState<"all" | "passed" | "failed">("all");
  const [nextModuleConfirmOpen, setNextModuleConfirmOpen] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [submission, setSubmission] = useState<LessonSubmission | null>(null);
  const [submissionNote, setSubmissionNote] = useState("");
  const [submissionFileName, setSubmissionFileName] = useState("");
  const [submissionFileUrl, setSubmissionFileUrl] = useState("");
  const [submittingWork, setSubmittingWork] = useState(false);
  const [lessonCompleted, setLessonCompleted] = useState(false);

  useEffect(() => {
    loadData();
  }, [courseId, lessonId]);

  useEffect(() => {
    if (!activeAttempt || activeAttempt.timeLimitSec <= 0) return;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeAttempt]);

  const loadData = async () => {
    try {
      if (!courseId || !lessonId) return;

      const { user: userData } = await api.getSession();
      setUser(userData);
      const { course: courseData } = await api.getCourse(courseId);
      setCourse(courseData);

      let foundLesson: Lesson | null = null;
      let foundModuleId: string | null = null;

      for (const module of courseData.modules) {
        const matched = module.lessons.find((item) => item.id === lessonId);
        if (matched) {
          foundLesson = matched;
          foundModuleId = module.id;
          break;
        }
      }

      if (!foundLesson) {
        toast.error("Урок не найден");
        navigate(`/courses/${courseId}`);
        return;
      }

      setParentModuleId(foundModuleId);
      setLesson(foundLesson);
      setSubmission(null);
      setSubmissionNote("");
      setSubmissionFileName("");
      setSubmissionFileUrl("");
      setActiveAttempt(null);
      setTestSubmitted(false);
      setTestResult(null);
      setTestAnswers({});
      setStartConfirmOpen(false);
      setTimeExpiredScreen(false);
      setAnalyticsStudentFilter("all");
      setAttemptHistory([]);
      setTeacherTestAnalytics(null);
      setTeacherTestAttempts([]);
      setLessonCompleted(false);

      if (userData.role === "student" && userData.enrolledCourses.includes(courseId)) {
        const { progress: progressData } = await api.getProgress(courseId);
        setLessonCompleted(progressData.completedLessons.includes(lessonId));
        const { submissions } = await api.getMyCourseSubmissions(courseId);
        const current = submissions.find((item) => item.lessonId === lessonId) || null;
        setSubmission(current);
        if (foundLesson.type === "test") {
          const { attempts } = await api.getMyLessonTestAttempts(courseId, lessonId);
          setAttemptHistory(attempts);
        }
      }

      if (foundLesson.type === "test") {
        if (userData.role === "teacher" && String(courseData.teacherId) === String(userData.id)) {
          const { analytics, attempts } = await api.getTeacherLessonTestAnalytics(courseId, lessonId);
          setTeacherTestAnalytics(analytics);
          setTeacherTestAttempts(attempts);
        }
        if (userData.role === "admin") {
          const { analytics, attempts } = await api.getAdminLessonTestAnalytics(courseId, lessonId);
          setTeacherTestAnalytics(analytics);
          setTeacherTestAttempts(attempts);
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки урока");
    } finally {
      setLoading(false);
    }
  };

  const goBackToCourse = () => {
    if (!courseId) return;
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(`/courses/${courseId}`, {
      replace: true,
      state: parentModuleId ? { openModuleId: parentModuleId } : undefined,
    });
  };

  const handleCompleteLesson = async () => {
    try {
      if (!courseId || !lessonId) return;
      await api.completeLesson(courseId, lessonId);
      toast.success("Урок завершен!");
      setLessonCompleted(true);
    } catch (error: any) {
      toast.error(error.message || "Ошибка завершения урока");
    }
  };

  const startTestAttempt = async () => {
    if (!courseId || !lessonId) return;
    setStartingTest(true);
    try {
      const { attempt } = await api.startLessonTest(courseId, lessonId);
      setActiveAttempt(attempt);
      setTestAnswers({});
      setTestSubmitted(false);
      setTestResult(null);
      setTimeExpiredScreen(false);
      setStartConfirmOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Не удалось начать тест");
    } finally {
      setStartingTest(false);
    }
  };

  const setSingleAnswer = (questionId: string, option: number) => {
    setTestAnswers((prev) => ({ ...prev, [questionId]: { questionId, option } }));
  };

  const setMultipleAnswer = (questionId: string, option: number, checked: boolean) => {
    setTestAnswers((prev) => {
      const current = prev[questionId];
      const set = new Set(current?.options || []);
      if (checked) set.add(option);
      else set.delete(option);
      return { ...prev, [questionId]: { questionId, options: Array.from(set).sort((a, b) => a - b) } };
    });
  };

  const setTextAnswer = (questionId: string, text: string) => {
    setTestAnswers((prev) => ({ ...prev, [questionId]: { questionId, text } }));
  };

  const handleSubmitTest = async (options?: { isTimeExpired?: boolean }) => {
    if (!courseId || !lessonId || !activeAttempt) return;
    setSubmittingTest(true);
    try {
      const answers = Object.values(testAnswers);
      const { result } = await api.submitTest(courseId, lessonId, activeAttempt.attemptId, answers);
      setTestResult(result);
      setTestSubmitted(true);
      setActiveAttempt(null);
      setTimeExpiredScreen(false);
      const { attempts } = await api.getMyLessonTestAttempts(courseId, lessonId);
      setAttemptHistory(attempts);
      if (options?.isTimeExpired || result.timeExpired) {
        toast.info("Время на прохождение теста истекло. Показаны результаты текущей попытки.");
      } else if (result.passed) {
        toast.success(`Тест пройден: ${result.score}%`);
      } else {
        toast.error(`Тест не пройден: ${result.score}%`);
      }
    } catch (error: any) {
      toast.error(error.message || "Ошибка отправки теста");
    } finally {
      setSubmittingTest(false);
    }
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
      reader.readAsDataURL(file);
    });

  const handleSubmissionFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > LIMITS.lessonSubmissionMaxSize) {
      toast.error(`Файл не должен превышать ${(LIMITS.lessonSubmissionMaxSize / (1024 * 1024)).toFixed(0)} МБ`);
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSubmissionFileName(file.name);
      setSubmissionFileUrl(dataUrl);
    } catch (error: any) {
      toast.error(error?.message || "Не удалось подготовить файл");
    }
  };

  const handleSubmitWorkForReview = async () => {
    if (!courseId || !lessonId) return;
    if (!submissionFileName || !submissionFileUrl) {
      toast.error("Выберите файл с выполненной работой");
      return;
    }
    if (submissionNote.length > LIMITS.lessonSubmissionNote) {
      toast.error(`Комментарий не должен превышать ${LIMITS.lessonSubmissionNote} символов`);
      return;
    }

    setSubmittingWork(true);
    try {
      const { submission: created } = await api.submitLessonForReview(courseId, lessonId, {
        fileName: submissionFileName,
        fileUrl: submissionFileUrl,
        studentNote: submissionNote,
      });
      setSubmission(created);
      setSubmissionFileName("");
      setSubmissionFileUrl("");
      setSubmissionNote("");
      toast.success("Работа отправлена преподавателю на проверку");
    } catch (error: any) {
      toast.error(error.message || "Ошибка отправки работы");
    } finally {
      setSubmittingWork(false);
    }
  };

  const getVideoEmbedUrl = (rawUrl: string) => {
    const normalize = (value: string) => {
      try {
        return new URL(value);
      } catch {
        try {
          return new URL(`https://${value}`);
        } catch {
          return null;
        }
      }
    };

    const parsed = normalize(rawUrl.trim());
    if (!parsed) return "";

    const host = parsed.hostname.toLowerCase();
    const hostWithoutWww = host.replace(/^www\./, "");
    const path = parsed.pathname;

    if (hostWithoutWww === "youtu.be") {
      const videoId = path.split("/").filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }

    if (hostWithoutWww.endsWith("youtube.com")) {
      if (path.startsWith("/embed/")) {
        const videoId = path.split("/")[2];
        return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
      }

      if (path.startsWith("/shorts/")) {
        const videoId = path.split("/")[2];
        return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
      }

      const videoId = parsed.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
    }

    if (hostWithoutWww.endsWith("rutube.ru")) {
      const embedMatch = path.match(/\/play\/embed\/([a-zA-Z0-9]+)/);
      if (embedMatch?.[1]) {
        const privateKey = parsed.searchParams.get("p");
        return privateKey
          ? `https://rutube.ru/play/embed/${embedMatch[1]}/?p=${encodeURIComponent(privateKey)}`
          : `https://rutube.ru/play/embed/${embedMatch[1]}/`;
      }

      const videoMatch = path.match(/\/video\/(?:private\/)?([a-zA-Z0-9]+)/);
      if (videoMatch?.[1]) {
        const privateKey = parsed.searchParams.get("p");
        return privateKey
          ? `https://rutube.ru/play/embed/${videoMatch[1]}/?p=${encodeURIComponent(privateKey)}`
          : `https://rutube.ru/play/embed/${videoMatch[1]}/`;
      }
    }

    if (hostWithoutWww.endsWith("vk.com") || hostWithoutWww.endsWith("vkvideo.ru")) {
      if (path.includes("video_ext.php")) {
        const oid = parsed.searchParams.get("oid");
        const id = parsed.searchParams.get("id");
        if (oid && id) {
          const params = new URLSearchParams({ oid, id });
          const hash = parsed.searchParams.get("hash");
          const hd = parsed.searchParams.get("hd");
          if (hash) params.set("hash", hash);
          if (hd) params.set("hd", hd);
          return `https://vk.com/video_ext.php?${params.toString()}`;
        }
      }

      let videoCompound = path.match(/\/video(-?\d+_\d+)/)?.[1] || "";
      if (!videoCompound) {
        const zParam = parsed.searchParams.get("z");
        if (zParam) {
          const decoded = decodeURIComponent(zParam);
          videoCompound = decoded.match(/video(-?\d+_\d+)/)?.[1] || "";
        }
      }

      if (videoCompound) {
        const [oid, id] = videoCompound.split("_");
        if (oid && id) {
          const params = new URLSearchParams({ oid, id, hd: "2" });
          return `https://vk.com/video_ext.php?${params.toString()}`;
        }
      }
    }

    return "";
  };

  const allAnswered = useMemo(() => {
    if (!activeAttempt || activeAttempt.questions.length === 0) return false;
    return activeAttempt.questions.every((question) => {
      const answer = testAnswers[question.id];
      if (!answer) return false;
      if (question.type === "multiple") return Array.isArray(answer.options) && answer.options.length > 0;
      if (question.type === "open") return Boolean((answer.text || "").trim());
      return typeof answer.option === "number";
    });
  }, [activeAttempt, testAnswers]);

  const remainingTimeSec = useMemo(() => {
    if (!activeAttempt || activeAttempt.timeLimitSec <= 0) return 0;
    const startedMs = Date.parse(activeAttempt.startedAt || "");
    if (Number.isNaN(startedMs)) return activeAttempt.timeLimitSec;
    const deadline = startedMs + activeAttempt.timeLimitSec * 1000;
    return Math.max(0, Math.ceil((deadline - nowTick) / 1000));
  }, [activeAttempt, nowTick]);

  useEffect(() => {
    if (!activeAttempt) {
      setTimeExpiredScreen(false);
      return;
    }
    if (activeAttempt.timeLimitSec > 0 && remainingTimeSec === 0 && !testSubmitted) {
      setTimeExpiredScreen(true);
    }
  }, [activeAttempt, remainingTimeSec, testSubmitted]);

  const formatDuration = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const minutes = Math.floor(safe / 60);
    const secs = safe % 60;
    if (minutes === 0) return `${secs} сек`;
    if (secs === 0) return `${minutes} мин`;
    return `${minutes} мин ${secs} сек`;
  };

  const handleResetStudentTestResult = async (studentId: string, studentName: string) => {
    if (!courseId || !lessonId || !user) return;
    const ok = window.confirm(`Сбросить результаты теста для студента "${studentName}"?`);
    if (!ok) return;

    setResettingStudentId(studentId);
    try {
      if (user.role === "admin") {
        await api.resetStudentLessonTestResultsByAdmin(courseId, lessonId, studentId);
        const { analytics, attempts } = await api.getAdminLessonTestAnalytics(courseId, lessonId);
        setTeacherTestAnalytics(analytics);
        setTeacherTestAttempts(attempts);
      } else {
        await api.resetStudentLessonTestResultsByTeacher(courseId, lessonId, studentId);
        const { analytics, attempts } = await api.getTeacherLessonTestAnalytics(courseId, lessonId);
        setTeacherTestAnalytics(analytics);
        setTeacherTestAttempts(attempts);
      }
      toast.success("Результаты студента сброшены");
    } catch (error: any) {
      toast.error(error.message || "Не удалось сбросить результаты студента");
    } finally {
      setResettingStudentId(null);
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

  if (!lesson || !course) {
    return (
      <Layout>
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Урок не найден</p>
        </div>
      </Layout>
    );
  }

  const renderedContent = sanitizeRichText(lesson.content || "");
  const hasRichMarkup = /<\/?[a-z][\s\S]*>/i.test(renderedContent);
  const videoEmbedUrl = lesson.type === "video" && lesson.videoUrl ? getVideoEmbedUrl(lesson.videoUrl) : "";
  const lessonAttachments = Array.isArray(lesson.attachments) ? lesson.attachments : [];
  const isStudent = user?.role === "student";
  const isStudentEnrolled = Boolean(isStudent && courseId && user?.enrolledCourses.includes(courseId));
  const requiresReview = Boolean(lesson.requiresReview && (lesson.type === "text" || lesson.type === "video"));
  const canSubmitWork = isStudentEnrolled && requiresReview;
  const isTeacherOwner = Boolean(user?.role === "teacher" && String(course.teacherId) === String(user?.id));
  const canReviewTestAnalytics = Boolean(isTeacherOwner || user?.role === "admin");
  const testMaxAttempts = activeAttempt?.maxAttempts ?? lesson.test?.settings?.maxAttempts ?? 0;
  const attemptsUsed = activeAttempt?.attemptNumber ?? attemptHistory[0]?.attemptNumber ?? attemptHistory.length;
  const attemptsLeft = testMaxAttempts > 0 ? Math.max(testMaxAttempts - attemptsUsed, 0) : 0;
  const hasPassedAttempt = attemptHistory.some((attempt) => attempt.passed);
  const allowRetakeAfterPass = Boolean(lesson.test?.settings?.allowRetakeAfterPass);
  const startBlockedByPassed = hasPassedAttempt && !allowRetakeAfterPass;
  const startBlockedByLimit = testMaxAttempts > 0 && attemptsLeft === 0;
  const startBlocked = startBlockedByLimit || startBlockedByPassed;
  const isTimeOver = Boolean(activeAttempt && activeAttempt.timeLimitSec > 0 && remainingTimeSec === 0);
  const filteredAnalyticsStudents = (() => {
    const items = teacherTestAnalytics?.students || [];
    if (analyticsStudentFilter === "passed") return items.filter((item) => item.passed);
    if (analyticsStudentFilter === "failed") return items.filter((item) => !item.passed);
    return items;
  })();
  const submissionRejected = submission?.status === "rejected";
  const submissionPending = submission?.status === "pending";
  const submissionApproved = submission?.status === "approved";
  const orderedModules = course.modules.slice().sort((left, right) => left.order - right.order);
  const currentModuleIndex = orderedModules.findIndex((module) => module.id === parentModuleId);
  const currentModuleLessons =
    currentModuleIndex >= 0
      ? orderedModules[currentModuleIndex].lessons.slice().sort((left, right) => left.order - right.order)
      : [];
  const currentModuleLessonIndex = currentModuleLessons.findIndex((item) => item.id === lesson.id);
  const previousLessonInModule =
    currentModuleLessonIndex > 0 ? currentModuleLessons[currentModuleLessonIndex - 1] || null : null;
  const nextLessonInModule =
    currentModuleLessonIndex >= 0 ? currentModuleLessons[currentModuleLessonIndex + 1] || null : null;
  const previousModule = currentModuleIndex > 0 ? orderedModules[currentModuleIndex - 1] || null : null;
  const nextModule = currentModuleIndex >= 0 ? orderedModules[currentModuleIndex + 1] || null : null;
  const previousModuleLastLesson = previousModule
    ? previousModule.lessons.slice().sort((left, right) => left.order - right.order).at(-1) || null
    : null;
  const nextModuleFirstLesson = nextModule
    ? nextModule.lessons.slice().sort((left, right) => left.order - right.order)[0] || null
    : null;
  const shouldShowPreviousModuleButton = Boolean(!previousLessonInModule && previousModuleLastLesson);
  const shouldShowNextModuleButton = Boolean(!nextLessonInModule && nextModuleFirstLesson);
  const isTestInProgress = Boolean(lesson.type === "test" && activeAttempt && !testSubmitted);

  const openNextLesson = () => {
    if (!courseId || !nextLessonInModule) return;
    navigate(`/courses/${courseId}/lessons/${nextLessonInModule.id}`, { replace: true });
  };

  const openPreviousLesson = () => {
    if (!courseId || !previousLessonInModule) return;
    navigate(`/courses/${courseId}/lessons/${previousLessonInModule.id}`, { replace: true });
  };

  const openNextModule = () => {
    if (!courseId || !nextModuleFirstLesson) return;
    setNextModuleConfirmOpen(false);
    navigate(`/courses/${courseId}/lessons/${nextModuleFirstLesson.id}`, { replace: true });
  };

  const openPreviousModule = () => {
    if (!courseId || !previousModuleLastLesson) return;
    navigate(`/courses/${courseId}/lessons/${previousModuleLastLesson.id}`, { replace: true });
  };

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" size="sm" className="gap-2" onClick={goBackToCourse}>
            <ArrowLeft className="h-4 w-4" />
            Назад к курсу
          </Button>
        </div>

        {activeAttempt && activeAttempt.timeLimitSec > 0 && !testSubmitted && (
          <div className="fixed right-6 bottom-6 z-40 rounded-xl border border-primary/40 bg-white/95 px-5 py-4 text-center shadow-xl backdrop-blur-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">До конца теста</p>
            <p className={`text-4xl font-extrabold tabular-nums ${remainingTimeSec <= 30 ? "text-red-600" : "text-primary"}`}>
              {Math.floor(remainingTimeSec / 60)}:{String(remainingTimeSec % 60).padStart(2, "0")}
            </p>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="mb-2 flex items-center gap-3">
              <Badge variant="outline" className="capitalize">
                {lesson.type}
              </Badge>
            </div>
            <CardTitle className="text-3xl break-words [overflow-wrap:anywhere]">{lesson.title}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {lesson.type === "text" && (
              <div className="space-y-4">
                <div className="rich-text-content">
                  {hasRichMarkup ? (
                    <div dangerouslySetInnerHTML={{ __html: renderedContent }} />
                  ) : (
                    <p className="whitespace-pre-wrap text-base leading-relaxed break-words [overflow-wrap:anywhere]">{lesson.content}</p>
                  )}
                </div>
                {lessonAttachments.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Paperclip className="h-4 w-4 text-primary" />
                        Материалы урока
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {lessonAttachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.url}
                          download={attachment.name}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
                        >
                          <span className="truncate pr-2">{attachment.name}</span>
                          <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </a>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {lesson.type === "video" && (
              <div className="space-y-4">
                {lesson.videoUrl && (
                  <>
                    {videoEmbedUrl ? (
                      <div className="aspect-video overflow-hidden rounded-lg bg-black">
                        <iframe
                          src={videoEmbedUrl}
                          className="h-full w-full"
                          allow="autoplay; encrypted-media; clipboard-write; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <Card className="border-amber-300 bg-amber-50">
                        <CardContent className="pt-6">
                          <p className="text-amber-900">
                            Ссылка на видео не распознана. Поддерживаются YouTube, VK Video и RuTube.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
                {lesson.content && (
                  <div className="rich-text-content">
                    {hasRichMarkup ? (
                      <div dangerouslySetInnerHTML={{ __html: renderedContent }} />
                    ) : (
                      <p className="whitespace-pre-wrap text-base leading-relaxed break-words [overflow-wrap:anywhere]">{lesson.content}</p>
                    )}
                  </div>
                )}
                {lessonAttachments.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Paperclip className="h-4 w-4 text-primary" />
                        Файлы к видео
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {lessonAttachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.url}
                          download={attachment.name}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/30"
                        >
                          <span className="truncate pr-2">{attachment.name}</span>
                          <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </a>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {lesson.type === "test" && !lesson.test?.questions?.length && (
              <Card className="border-amber-300 bg-amber-50">
                <CardContent className="pt-6">
                  <p className="text-amber-900">Этот тест пока не настроен: вопросы и варианты ответов отсутствуют.</p>
                </CardContent>
              </Card>
            )}

            {lesson.type === "test" && lesson.test && lesson.test.questions.length > 0 && (
              <div className="space-y-6">
                {isStudentEnrolled && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            Попытки: использовано {attemptsUsed}{testMaxAttempts > 0 ? ` из ${testMaxAttempts}` : ""}
                          </p>
                          {testMaxAttempts > 0 && (
                            <p className="text-sm text-muted-foreground">Осталось попыток: {attemptsLeft}</p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {activeAttempt
                              ? `Попытка #${activeAttempt.attemptNumber} из ${activeAttempt.maxAttempts}`
                              : "Запустите тест, чтобы начать попытку"}
                          </p>
                          {startBlockedByLimit && <p className="text-sm text-destructive">Лимит попыток исчерпан.</p>}
                          {startBlockedByPassed && (
                            <p className="text-sm text-green-700">
                              Тест уже пройден. Повторное прохождение отключено преподавателем.
                            </p>
                          )}
                          {!activeAttempt && lesson.test?.settings?.timeLimitSec > 0 && (
                            <p className="text-sm text-muted-foreground">
                              Время на попытку: {formatDuration(lesson.test.settings.timeLimitSec)}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            onClick={() => setStartConfirmOpen(true)}
                            disabled={startingTest || Boolean(activeAttempt) || startBlocked}
                          >
                            {startingTest ? "Запуск..." : activeAttempt ? "Попытка запущена" : "Начать тест"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <AlertDialog
                  open={startConfirmOpen}
                  onOpenChange={setStartConfirmOpen}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Начать попытку теста?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {lesson.test?.settings?.timeLimitSec > 0
                          ? `На прохождение теста выделено ${formatDuration(lesson.test.settings.timeLimitSec)}.`
                          : "У этого теста нет ограничения по времени."}{" "}
                        После старта попытка сразу начинает отсчёт времени.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {testMaxAttempts > 0 && <p>Попыток доступно: {attemptsLeft} из {testMaxAttempts}</p>}
                      {startBlockedByPassed && <p>Повтор после успешной сдачи: отключен</p>}
                      <p>Вопросов в попытке: {lesson.test?.settings?.randomQuestionCount || lesson.test?.questions.length || 0}</p>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={startingTest}>Отмена</AlertDialogCancel>
                      <AlertDialogAction onClick={() => startTestAttempt()} disabled={startingTest || startBlocked}>
                        {startingTest ? "Запуск..." : "Начать"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {activeAttempt && (
                  <div className="space-y-4">
                    {timeExpiredScreen || isTimeOver ? (
                      <Card className="border-amber-300 bg-amber-50">
                        <CardHeader>
                          <CardTitle className="text-xl text-amber-900">Время вышло</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="text-amber-900">
                            Время на прохождение этой попытки истекло. Нажмите кнопку ниже, чтобы завершить попытку и перейти к результатам.
                          </p>
                          <Button onClick={() => handleSubmitTest({ isTimeExpired: true })} className="w-full" disabled={submittingTest}>
                            {submittingTest ? "Формируем результат..." : "Перейти к результатам"}
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <>
                        {activeAttempt.questions.map((question, questionIndex) => {
                          const answer = testAnswers[question.id];
                          return (
                            <Card key={question.id}>
                              <CardHeader>
                                <CardTitle className="text-lg">
                                  Вопрос {questionIndex + 1}: {question.question}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {question.type === "open" ? (
                                  <Input
                                    value={answer?.text || ""}
                                    onChange={(event) => setTextAnswer(question.id, event.target.value)}
                                    placeholder="Введите ответ"
                                  />
                                ) : (
                                  <RadioGroup
                                    value={typeof answer?.option === "number" ? String(answer.option) : undefined}
                                    onValueChange={(value) => setSingleAnswer(question.id, Number(value))}
                                  >
                                    {question.options?.map((option, optionIndex) => (
                                      <label key={optionIndex} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-gray-50">
                                        {question.type === "multiple" ? (
                                          <input
                                            type="checkbox"
                                            checked={Boolean(answer?.options?.includes(optionIndex))}
                                            onChange={(event) => setMultipleAnswer(question.id, optionIndex, event.target.checked)}
                                          />
                                        ) : (
                                          <RadioGroupItem value={optionIndex.toString()} id={`q${questionIndex}-o${optionIndex}`} />
                                        )}
                                        <span className="flex-1">{option}</span>
                                      </label>
                                    ))}
                                  </RadioGroup>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                        <Button onClick={() => handleSubmitTest()} className="w-full" disabled={!allAnswered || submittingTest}>
                          {submittingTest ? "Отправка..." : "Отправить ответы"}
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {testSubmitted && testResult && (
                  <Card className={testResult.passed ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {testResult.passed ? <Award className="h-5 w-5 text-green-700" /> : <XCircle className="h-5 w-5 text-red-700" />}
                        {testResult.passed ? "Тест пройден" : "Тест не пройден"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {testResult.timeExpired && (
                        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          Попытка завершена по таймеру.
                        </p>
                      )}
                      <p>Балл: <strong>{testResult.score}%</strong> (проходной: {testResult.passScore}%)</p>
                      <p>Правильных ответов: {testResult.correctAnswers} из {testResult.totalQuestions}</p>
                      <p>Попытка: #{testResult.attemptNumber}</p>
                      {testResult.showAnswers && testResult.results.length > 0 && (
                        <div className="space-y-2 pt-2">
                          {testResult.results.map((item) => (
                            <div key={item.questionId} className={`rounded-md border p-2 ${item.isCorrect ? "border-green-200" : "border-red-200"}`}>
                              <p className="text-sm font-medium">{item.question}</p>
                              <p className="text-xs">{item.isCorrect ? "Верно" : "Неверно"}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {isStudentEnrolled && attemptHistory.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">История попыток</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {attemptHistory.map((attempt) => (
                        <div key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                          <span>Попытка #{attempt.attemptNumber}</span>
                          <span>{attempt.score}%</span>
                          <span>{attempt.correctAnswers}/{attempt.totalQuestions}</span>
                          <Badge variant={attempt.passed ? "default" : "secondary"}>
                            {attempt.passed ? "Пройдено" : "Не пройдено"}
                          </Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {canReviewTestAnalytics && teacherTestAnalytics && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Аналитика теста</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="grid gap-2 md:grid-cols-3">
                        <button
                          type="button"
                          onClick={() => setAnalyticsStudentFilter("passed")}
                          className={`rounded-md border p-2 text-left transition-colors ${
                            analyticsStudentFilter === "passed" ? "border-green-500 bg-green-50" : "hover:bg-muted/30"
                          }`}
                        >
                          Прошли: {teacherTestAnalytics.passedStudents}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnalyticsStudentFilter("failed")}
                          className={`rounded-md border p-2 text-left transition-colors ${
                            analyticsStudentFilter === "failed" ? "border-red-500 bg-red-50" : "hover:bg-muted/30"
                          }`}
                        >
                          Не прошли: {teacherTestAnalytics.failedStudents}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnalyticsStudentFilter("all")}
                          className={`rounded-md border p-2 text-left transition-colors ${
                            analyticsStudentFilter === "all" ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                          }`}
                        >
                          Всего студентов: {teacherTestAnalytics.totalStudents}
                        </button>
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium">Студенты</p>
                        {filteredAnalyticsStudents.length === 0 && (
                          <p className="text-xs text-muted-foreground">По выбранному фильтру пока нет данных.</p>
                        )}
                        {filteredAnalyticsStudents.map((item) => (
                          <div key={item.studentId} className="rounded-md border p-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p>{item.studentName} ({item.studentEmail})</p>
                                <p className="text-xs text-muted-foreground">
                                  Лучший балл: {item.bestScore}% | Последний: {item.lastScore}% | Попытки: {item.attemptsUsed}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleResetStudentTestResult(item.studentId, item.studentName || "Студент")}
                                disabled={resettingStudentId === item.studentId || item.attemptsUsed <= 0}
                              >
                                {resettingStudentId === item.studentId ? "Сброс..." : "Сбросить результат"}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium">Статистика по вопросам</p>
                        {teacherTestAnalytics.questions.map((item) => (
                          <div key={item.questionId} className="rounded-md border p-2">
                            <p>{item.question}</p>
                            <p className="text-xs text-muted-foreground">
                              Верных: {item.correctCount}/{item.timesShown} ({item.correctRate}%)
                            </p>
                          </div>
                        ))}
                      </div>
                      {teacherTestAttempts.length > 0 && (
                        <div className="space-y-2">
                          <p className="font-medium">История попыток</p>
                          {teacherTestAttempts.map((attempt) => (
                            <div key={attempt.id} className="rounded-md border p-2">
                              <p>{attempt.studentName || "Студент"} — {attempt.score}% (попытка #{attempt.attemptNumber})</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {canSubmitWork && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Отправка работы преподавателю</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {submission && (
                    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-muted-foreground">Статус:</span>
                        {submissionPending && <Badge variant="secondary">На проверке</Badge>}
                        {submissionApproved && <Badge className="bg-green-600">Принято</Badge>}
                        {submissionRejected && <Badge variant="destructive">Отклонено</Badge>}
                      </div>
                      <a href={submission.fileUrl} download={submission.fileName} target="_blank" rel="noreferrer" className="inline-block">
                        <Button variant="outline" size="sm" className="gap-2">
                          <Download className="h-4 w-4" />
                          {submission.fileName}
                        </Button>
                      </a>
                      {submission.studentNote && (
                        <p className="text-sm break-words [overflow-wrap:anywhere]">Ваш комментарий: {submission.studentNote}</p>
                      )}
                      {submission.reviewNote && (
                        <p className="text-sm text-destructive break-words [overflow-wrap:anywhere]">
                          Комментарий преподавателя: {submission.reviewNote}
                        </p>
                      )}
                    </div>
                  )}

                  {!submissionPending && !submissionApproved && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="submission-file">Файл выполненной работы</Label>
                        <input id="submission-file" type="file" onChange={handleSubmissionFileChange} className="hidden" />
                        <label
                          htmlFor="submission-file"
                          className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
                        >
                          Выберите файл
                        </label>
                        {submissionFileName && <p className="text-sm text-muted-foreground">Выбран файл: {submissionFileName}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="submission-note">Комментарий (необязательно)</Label>
                        <Textarea
                          id="submission-note"
                          value={submissionNote}
                          onChange={(event) => setSubmissionNote(event.target.value.slice(0, LIMITS.lessonSubmissionNote))}
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground">
                          {submissionNote.length}/{LIMITS.lessonSubmissionNote}
                        </p>
                      </div>
                      <Button onClick={handleSubmitWorkForReview} disabled={submittingWork}>
                        {submittingWork ? "Отправка..." : submissionRejected ? "Отправить повторно" : "Отправить на проверку"}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {isStudentEnrolled && canSubmitWork && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-6">
                {previousLessonInModule && (
                  <Button type="button" variant="outline" onClick={openPreviousLesson} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Предыдущий урок
                  </Button>
                )}
                {shouldShowPreviousModuleButton && (
                  <Button type="button" variant="outline" onClick={openPreviousModule} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Предыдущий модуль
                  </Button>
                )}
                {nextLessonInModule && (
                  <Button type="button" variant="outline" onClick={openNextLesson} className="gap-2">
                    Следующий урок
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {shouldShowNextModuleButton && (
                  <Button type="button" variant="outline" onClick={() => setNextModuleConfirmOpen(true)} className="gap-2">
                    Следующий модуль
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}

            {lesson.type === "test" && isStudentEnrolled && (
              <div className="space-y-2 border-t pt-6">
                {isTestInProgress && (
                  <p className="text-right text-sm text-muted-foreground">
                    Завершите текущую попытку теста, чтобы перейти к другому уроку.
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {previousLessonInModule && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={openPreviousLesson}
                      className="gap-2"
                      disabled={isTestInProgress}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Предыдущий урок
                    </Button>
                  )}
                  {shouldShowPreviousModuleButton && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={openPreviousModule}
                      className="gap-2"
                      disabled={isTestInProgress}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Предыдущий модуль
                    </Button>
                  )}
                  {nextLessonInModule && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={openNextLesson}
                      className="gap-2"
                      disabled={isTestInProgress}
                    >
                      Следующий урок
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                  {shouldShowNextModuleButton && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setNextModuleConfirmOpen(true)}
                      className="gap-2"
                      disabled={isTestInProgress}
                    >
                      Следующий модуль
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {lesson.type !== "test" && isStudentEnrolled && !canSubmitWork && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-6">
                {previousLessonInModule && (
                  <Button type="button" variant="outline" onClick={openPreviousLesson} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Предыдущий урок
                  </Button>
                )}
                {shouldShowPreviousModuleButton && (
                  <Button type="button" variant="outline" onClick={openPreviousModule} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Предыдущий модуль
                  </Button>
                )}
                {nextLessonInModule && (
                  <Button type="button" variant="outline" onClick={openNextLesson} className="gap-2">
                    Следующий урок
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {shouldShowNextModuleButton && (
                  <Button type="button" variant="outline" onClick={() => setNextModuleConfirmOpen(true)} className="gap-2">
                    Следующий модуль
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                <Button onClick={handleCompleteLesson} className="gap-2" disabled={lessonCompleted}>
                  {lessonCompleted ? "Урок завершён" : "Завершить урок"}
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={nextModuleConfirmOpen} onOpenChange={setNextModuleConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Перейти к следующему модулю?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы завершили последний урок текущего модуля.
              {nextModule ? ` Открыть модуль «${nextModule.title}»?` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={openNextModule}>Перейти</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

