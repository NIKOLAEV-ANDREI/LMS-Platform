import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import { api, Course, LessonSubmission, User } from "../../utils/api";
import { LIMITS } from "../../utils/limits";
import { formatRuCount } from "../../utils/plural";

type SubmissionStatusFilter = "all" | "pending" | "approved" | "rejected";

const statusMeta: Record<SubmissionStatusFilter, { label: string }> = {
  all: { label: "Все" },
  pending: { label: "На проверке" },
  approved: { label: "Приняты" },
  rejected: { label: "Отклонены" },
};

export default function CourseSubmissionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [submissions, setSubmissions] = useState<LessonSubmission[]>([]);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatusFilter>("pending");
  const [loading, setLoading] = useState(true);
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectSubmissionId, setRejectSubmissionId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => {
    loadData("pending");
  }, [id]);

  useEffect(() => {
    if (!id || !course) return;
    loadSubmissions(statusFilter);
  }, [statusFilter]);

  const loadData = async (initialStatus: SubmissionStatusFilter) => {
    try {
      if (!id) return;
      const { user: sessionUser } = await api.getSession();
      setUser(sessionUser);

      const { course: courseData } = await api.getCourse(id);
      if (sessionUser.role !== "teacher" || courseData.teacherId !== sessionUser.id) {
        toast.error("Раздел проверки доступен только преподавателю этого курса");
        navigate(sessionUser.role === "admin" ? "/admin/dashboard" : "/teacher/dashboard", { replace: true });
        return;
      }

      setCourse(courseData);
      await loadSubmissions(initialStatus);
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки раздела проверки");
      navigate("/teacher/dashboard", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const loadSubmissions = async (nextStatus: SubmissionStatusFilter) => {
    if (!id) return;
    try {
      const { submissions: rows } = await api.getTeacherCourseSubmissions(id, nextStatus);
      setSubmissions(rows);
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки работ");
    }
  };

  const lessonTitles = useMemo(() => {
    const map: Record<string, string> = {};
    if (!course) return map;
    for (const module of course.modules) {
      for (const lesson of module.lessons) {
        map[lesson.id] = lesson.title;
      }
    }
    return map;
  }, [course]);

  const reviewSubmission = async (submissionId: string, action: "approve" | "reject", reviewNote: string) => {
    if (!id) return;
    setReviewingSubmissionId(submissionId);
    try {
      await api.reviewLessonSubmission(id, submissionId, { action, reviewNote });
      toast.success(action === "approve" ? "Работа подтверждена" : "Работа отклонена");
      await loadSubmissions(statusFilter);
    } catch (error: any) {
      toast.error(error.message || "Ошибка проверки работы");
    } finally {
      setReviewingSubmissionId(null);
    }
  };

  const openRejectDialogFor = (submissionId: string) => {
    setRejectSubmissionId(submissionId);
    setRejectNote("");
    setRejectDialogOpen(true);
  };

  const closeRejectDialog = () => {
    if (reviewingSubmissionId) return;
    setRejectDialogOpen(false);
    setRejectSubmissionId(null);
    setRejectNote("");
  };

  const submitReject = async () => {
    if (!rejectSubmissionId) return;
    const normalized = rejectNote.trim();
    if (!normalized) {
      toast.error("Комментарий обязателен при отклонении");
      return;
    }
    if (normalized.length > LIMITS.lessonReviewNote) {
      toast.error(`Комментарий не должен превышать ${LIMITS.lessonReviewNote} символов`);
      return;
    }
    await reviewSubmission(rejectSubmissionId, "reject", normalized);
    setRejectDialogOpen(false);
    setRejectSubmissionId(null);
    setRejectNote("");
  };

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
        <div>
          <Button variant="outline" className="gap-2" onClick={() => navigate(`/courses/${course.id}`)}>
            <ArrowLeft className="h-4 w-4" />
            Назад к курсу
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Проверка работ: {course.title}</CardTitle>
            <CardDescription>
              {formatRuCount(submissions.length, "работа", "работы", "работ")} в статусе "{statusMeta[statusFilter].label.toLowerCase()}"
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
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
            </div>

            {submissions.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">Работы с выбранным статусом отсутствуют</div>
            ) : (
              <div className="space-y-3">
                {submissions.map((submission) => (
                  <div key={submission.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium">{lessonTitles[submission.lessonId] || `Урок #${submission.lessonId}`}</p>
                        <p className="text-sm text-muted-foreground">
                          Студент: {submission.studentName || `#${submission.studentId}`} ({submission.studentEmail || "email не указан"})
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {getStatusBadge(submission.status)}
                          <Badge variant="outline">Попытка #{submission.attemptCount}</Badge>
                          <span>Отправлено: {formatDate(submission.updatedAt || submission.createdAt)}</span>
                        </div>
                      </div>

                      <a href={submission.fileUrl} download={submission.fileName} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="gap-2">
                          <Download className="h-4 w-4" />
                          Скачать файл
                        </Button>
                      </a>
                    </div>

                    {submission.studentNote && (
                      <p className="mt-3 rounded-md bg-muted/40 p-2 text-sm break-words [overflow-wrap:anywhere]">
                        Комментарий студента: {submission.studentNote}
                      </p>
                    )}

                    {submission.reviewNote && (
                      <p className="mt-2 rounded-md bg-muted/40 p-2 text-sm break-words [overflow-wrap:anywhere]">
                        Комментарий преподавателя: {submission.reviewNote}
                      </p>
                    )}

                    {submission.status === "pending" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={reviewingSubmissionId === submission.id}
                          onClick={() => reviewSubmission(submission.id, "approve", "")}
                        >
                          Подтвердить прохождение
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={reviewingSubmissionId === submission.id}
                          onClick={() => openRejectDialogFor(submission.id)}
                        >
                          Отклонить
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-sm text-muted-foreground">
          <Link to={`/courses/${course.id}`} className="underline underline-offset-4">
            Перейти к просмотру курса
          </Link>
        </div>
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={(nextOpen) => (nextOpen ? setRejectDialogOpen(true) : closeRejectDialog())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Отклонить работу</DialogTitle>
            <DialogDescription>Укажите причину отклонения. Этот комментарий увидит студент.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Textarea
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value.slice(0, LIMITS.lessonReviewNote))}
              rows={4}
              placeholder="Например: исправьте оформление и добавьте выводы в конце работы."
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
              {reviewingSubmissionId ? "Сохранение..." : "Отклонить работу"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
