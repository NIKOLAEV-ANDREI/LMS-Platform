import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { api, Course, LessonSubmission, Lesson } from "../../utils/api";
import { LIMITS } from "../../utils/limits";
import { formatRuCount } from "../../utils/plural";
import { sanitizeRichText, toPlainText } from "../../utils/richText";

type SubmissionStatusFilter = "all" | "pending" | "approved" | "rejected";

type ReviewRow = {
  key: string;
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  lessonType: Lesson["type"];
  lessonContent: string;
  submission: LessonSubmission;
};

const statusMeta: Record<SubmissionStatusFilter, { label: string }> = {
  all: { label: "Все" },
  pending: { label: "На проверке" },
  approved: { label: "Приняты" },
  rejected: { label: "Отклонены" },
};

const lessonTypeLabel: Record<Lesson["type"], string> = {
  text: "Текстовый урок",
  video: "Видеоурок",
  test: "Тест",
};

export default function TeacherReviewsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [courses, setCourses] = useState<Course[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatusFilter>("pending");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectRow, setRejectRow] = useState<ReviewRow | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  const loadSubmissionsForCourses = async (teacherCourses: Course[]) => {
    const rowsByCourse = await Promise.all(
      teacherCourses.map(async (course) => {
        const lessonByID = new Map<string, Lesson>();
        for (const module of course.modules) {
          for (const lesson of module.lessons) {
            lessonByID.set(lesson.id, lesson);
          }
        }

        try {
          const { submissions } = await api.getTeacherCourseSubmissions(course.id, "all");
          return submissions.map((submission) => {
            const lesson = lessonByID.get(submission.lessonId);
            return {
              key: `${course.id}:${submission.id}`,
              courseId: course.id,
              courseTitle: course.title,
              lessonId: submission.lessonId,
              lessonTitle: lesson?.title || `Урок #${submission.lessonId}`,
              lessonType: lesson?.type || "text",
              lessonContent: lesson?.content || "",
              submission,
            };
          });
        } catch {
          return [] as ReviewRow[];
        }
      }),
    );

    const flat = rowsByCourse.flat();
    flat.sort((a, b) => {
      const aTime = Date.parse(a.submission.updatedAt || a.submission.createdAt || "");
      const bTime = Date.parse(b.submission.updatedAt || b.submission.createdAt || "");
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
    });
    return flat;
  };

  const loadData = async () => {
    try {
      const { user: sessionUser } = await api.getSession();
      if (sessionUser.role !== "teacher") {
        toast.error("Раздел доступен только преподавателю");
        navigate("/teacher/dashboard", { replace: true });
        return;
      }
      const { courses: teacherCourses } = await api.getCourses();
      setCourses(teacherCourses);

      const courseIdFromQuery = new URLSearchParams(location.search).get("courseId");
      if (courseIdFromQuery && teacherCourses.some((course) => course.id === courseIdFromQuery)) {
        setCourseFilter(courseIdFromQuery);
      }

      const nextRows = await loadSubmissionsForCourses(teacherCourses);
      setRows(nextRows);
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки раздела проверки работ");
      navigate("/teacher/dashboard", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (courseFilter !== "all" && row.courseId !== courseFilter) return false;
      if (statusFilter !== "all" && row.submission.status !== statusFilter) return false;
      return true;
    });
  }, [rows, courseFilter, statusFilter]);

  const pendingTotal = useMemo(
    () => rows.filter((row) => row.submission.status === "pending").length,
    [rows],
  );

  const formatDate = (value: string) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("ru-RU");
  };

  const getStatusBadge = (status: LessonSubmission["status"]) => {
    if (status === "pending") return <Badge variant="secondary">На проверке</Badge>;
    if (status === "approved") return <Badge className="bg-green-600">Принято</Badge>;
    return <Badge variant="destructive">Отклонено</Badge>;
  };

  const getLessonTaskHint = (row: ReviewRow) => {
    if (row.lessonType === "test") {
      return "Это тестовый урок. Для проверки работы ориентируйтесь на задание в описании и структуру теста.";
    }
    if (row.lessonType === "video") {
      return "Это видеоурок. Ниже отображается текст задания/описания, которое видел студент.";
    }
    return "Текст задания, которое видел студент в уроке:";
  };

  const refreshRows = async () => {
    const nextRows = await loadSubmissionsForCourses(courses);
    setRows(nextRows);
  };

  const reviewSubmission = async (row: ReviewRow, action: "approve" | "reject", reviewNote: string) => {
    setReviewingSubmissionId(row.submission.id);
    try {
      await api.reviewLessonSubmission(row.courseId, row.submission.id, { action, reviewNote });
      toast.success(action === "approve" ? "Работа подтверждена" : "Работа отклонена");
      await refreshRows();
    } catch (error: any) {
      toast.error(error.message || "Ошибка проверки работы");
    } finally {
      setReviewingSubmissionId(null);
    }
  };

  const openRejectDialog = (row: ReviewRow) => {
    setRejectRow(row);
    setRejectNote("");
    setRejectDialogOpen(true);
  };

  const closeRejectDialog = () => {
    if (reviewingSubmissionId) return;
    setRejectDialogOpen(false);
    setRejectRow(null);
    setRejectNote("");
  };

  const submitReject = async () => {
    if (!rejectRow) return;
    const normalized = rejectNote.trim();
    if (!normalized) {
      toast.error("Комментарий обязателен при отклонении");
      return;
    }
    if (normalized.length > LIMITS.lessonReviewNote) {
      toast.error(`Комментарий не должен превышать ${LIMITS.lessonReviewNote} символов`);
      return;
    }
    await reviewSubmission(rejectRow, "reject", normalized);
    setRejectDialogOpen(false);
    setRejectRow(null);
    setRejectNote("");
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
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={() => navigate("/teacher/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Единая проверка работ</CardTitle>
            <CardDescription>
              {formatRuCount(pendingTotal, "работа", "работы", "работ")} сейчас на проверке
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(statusMeta) as SubmissionStatusFilter[]).map((status) => (
                <Button
                  key={status}
                  type="button"
                  variant={statusFilter === status ? "default" : "outline"}
                  onClick={() => setStatusFilter(status)}
                >
                  {statusMeta[status].label}
                </Button>
              ))}

              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger className="w-full md:w-[320px]">
                  <SelectValue placeholder="Выберите курс" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все курсы</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-sm text-muted-foreground">Показано: {filteredRows.length}</p>

            {filteredRows.length === 0 ? (
              <div className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
                По выбранным фильтрам работы не найдены.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRows.map((row) => {
                  const renderedTaskHtml = sanitizeRichText(row.lessonContent || "");
                  const taskPlain = toPlainText(row.lessonContent || "");
                  const hasTask = taskPlain.length > 0;

                  return (
                    <div key={row.key} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-sm font-medium" title={row.courseTitle}>
                            Курс: {row.courseTitle}
                          </p>
                          <p className="truncate text-sm text-muted-foreground" title={row.lessonTitle}>
                            Урок: {row.lessonTitle}
                          </p>
                          <p className="truncate text-sm text-muted-foreground" title={row.submission.fileName}>
                            Работа: {row.submission.fileName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Студент: {row.submission.studentName} ({row.submission.studentEmail || "email не указан"})
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {getStatusBadge(row.submission.status)}
                            <Badge variant="outline">{lessonTypeLabel[row.lessonType]}</Badge>
                            <Badge variant="outline">Попытка #{row.submission.attemptCount}</Badge>
                            <span>Отправлено: {formatDate(row.submission.updatedAt || row.submission.createdAt)}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <a href={row.submission.fileUrl} download={row.submission.fileName} target="_blank" rel="noreferrer">
                            <Button variant="outline" size="sm" className="gap-2">
                              <Download className="h-4 w-4" />
                              Скачать
                            </Button>
                          </a>
                          <Link to={`/courses/${row.courseId}/lessons/${row.lessonId}`}>
                            <Button variant="outline" size="sm" className="gap-2">
                              <ExternalLink className="h-4 w-4" />
                              Открыть урок
                            </Button>
                          </Link>
                          <Link to={`/courses/${row.courseId}`}>
                            <Button variant="outline" size="sm">К курсу</Button>
                          </Link>
                        </div>
                      </div>

                      <details className="mt-3 rounded-md border bg-muted/10 p-3">
                        <summary className="cursor-pointer select-none text-sm font-medium">
                          Задание урока
                        </summary>
                        <p className="mt-2 text-sm text-muted-foreground">{getLessonTaskHint(row)}</p>
                        {hasTask ? (
                          <div
                            className="prose prose-sm mt-3 max-w-none break-words rounded-md bg-background p-3 [overflow-wrap:anywhere]"
                            dangerouslySetInnerHTML={{ __html: renderedTaskHtml }}
                          />
                        ) : (
                          <p className="mt-3 rounded-md bg-background p-3 text-sm text-muted-foreground">
                            Описание задания в уроке не заполнено.
                          </p>
                        )}
                      </details>

                      {row.submission.studentNote && (
                        <p className="mt-3 rounded-md bg-muted/40 p-2 text-sm break-words [overflow-wrap:anywhere]">
                          Комментарий студента: {row.submission.studentNote}
                        </p>
                      )}

                      {row.submission.reviewNote && (
                        <p className="mt-2 rounded-md bg-muted/40 p-2 text-sm break-words [overflow-wrap:anywhere]">
                          Комментарий преподавателя: {row.submission.reviewNote}
                        </p>
                      )}

                      {row.submission.status === "pending" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={reviewingSubmissionId === row.submission.id}
                            onClick={() => reviewSubmission(row, "approve", "")}
                          >
                            Подтвердить
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={reviewingSubmissionId === row.submission.id}
                            onClick={() => openRejectDialog(row)}
                          >
                            Отклонить
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={(open) => (open ? setRejectDialogOpen(true) : closeRejectDialog())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Отклонить работу</DialogTitle>
            <DialogDescription>Укажите причину, студент увидит этот комментарий.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Textarea
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value.slice(0, LIMITS.lessonReviewNote))}
              rows={4}
              placeholder="Например: добавьте выводы и исправьте оформление."
            />
            <p className="text-right text-xs text-muted-foreground">
              {rejectNote.length}/{LIMITS.lessonReviewNote}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeRejectDialog} disabled={Boolean(reviewingSubmissionId)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={submitReject} disabled={Boolean(reviewingSubmissionId)}>
              {reviewingSubmissionId ? "Сохранение..." : "Отклонить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
