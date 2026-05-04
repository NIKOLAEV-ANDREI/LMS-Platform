import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Award, CheckCircle, Download, Paperclip, XCircle } from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { api, Course, Lesson } from "../../utils/api";
import { sanitizeRichText } from "../../utils/richText";

export default function LessonViewer() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [parentModuleId, setParentModuleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [testAnswers, setTestAnswers] = useState<(number | null)[]>([]);
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [courseId, lessonId]);

  const loadData = async () => {
    try {
      if (!courseId || !lessonId) return;

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

      if (foundLesson.test) {
        setTestAnswers(new Array(foundLesson.test.questions.length).fill(null));
      }
    } catch (error: any) {
      toast.error(error.message || "Ошибка загрузки урока");
    } finally {
      setLoading(false);
    }
  };

  const goBackToCourse = () => {
    if (!courseId) return;
    navigate(`/courses/${courseId}`, {
      state: parentModuleId ? { openModuleId: parentModuleId } : undefined,
    });
  };

  const handleCompleteLesson = async () => {
    try {
      if (!courseId || !lessonId) return;
      await api.completeLesson(courseId, lessonId);
      toast.success("Урок завершен!");
      goBackToCourse();
    } catch (error: any) {
      toast.error(error.message || "Ошибка завершения урока");
    }
  };

  const handleSubmitTest = async () => {
    try {
      if (!courseId || !lessonId) return;
      const result = await api.submitTest(courseId, lessonId, testAnswers);
      setTestResult(result);
      setTestSubmitted(true);

      if (result.score >= 70) {
        await api.completeLesson(courseId, lessonId);
        toast.success(`Тест пройден! Ваш результат: ${result.score}%`);
      } else {
        toast.error(`Тест не пройден. Ваш результат: ${result.score}%`);
      }
    } catch (error: any) {
      toast.error(error.message || "Ошибка отправки теста");
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

  const allAnswered = useMemo(() => testAnswers.length > 0 && testAnswers.every((item) => item !== null), [testAnswers]);

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

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="gap-2" onClick={goBackToCourse}>
            <ArrowLeft className="h-4 w-4" />
            Назад к курсу
          </Button>
        </div>

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
                {!testSubmitted ? (
                  <>
                    {lesson.test.questions.map((question, questionIndex) => (
                      <Card key={question.id}>
                        <CardHeader>
                          <CardTitle className="text-lg">
                            Вопрос {questionIndex + 1}: {question.question}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <RadioGroup
                            value={testAnswers[questionIndex]?.toString()}
                            onValueChange={(value) => {
                              const next = [...testAnswers];
                              next[questionIndex] = parseInt(value, 10);
                              setTestAnswers(next);
                            }}
                          >
                            {question.options?.map((option, optionIndex) => (
                              <div key={optionIndex} className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-gray-50">
                                <RadioGroupItem value={optionIndex.toString()} id={`q${questionIndex}-o${optionIndex}`} />
                                <Label htmlFor={`q${questionIndex}-o${optionIndex}`} className="flex-1 cursor-pointer">
                                  {option}
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </CardContent>
                      </Card>
                    ))}

                    <Button onClick={handleSubmitTest} className="w-full" disabled={!allAnswered}>
                      Отправить ответы
                    </Button>
                  </>
                ) : (
                  <div className="space-y-6">
                    <Card className={testResult.score >= 70 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                          {testResult.score >= 70 ? (
                            <>
                              <Award className="h-6 w-6 text-green-600" />
                              <span className="text-green-900">Тест пройден!</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-6 w-6 text-red-600" />
                              <span className="text-red-900">Попробуйте еще раз</span>
                            </>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span>Правильных ответов:</span>
                            <span className="font-bold">
                              {testResult.correctCount} из {testResult.totalQuestions}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Результат:</span>
                            <span className="text-2xl font-bold">{testResult.score}%</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {lesson.test.questions.map((question, questionIndex) => {
                      const userAnswer = testAnswers[questionIndex];
                      const isCorrect = userAnswer === question.correctAnswer;

                      return (
                        <Card key={question.id} className={isCorrect ? "border-green-200" : "border-red-200"}>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                              {isCorrect ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                              Вопрос {questionIndex + 1}: {question.question}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {question.options?.map((option, optionIndex) => {
                              const isUserAnswer = userAnswer === optionIndex;
                              const isCorrectAnswer = question.correctAnswer === optionIndex;

                              return (
                                <div
                                  key={optionIndex}
                                  className={`rounded-lg border p-3 ${
                                    isCorrectAnswer
                                      ? "border-green-300 bg-green-50"
                                      : isUserAnswer
                                        ? "border-red-300 bg-red-50"
                                        : ""
                                  }`}
                                >
                                  {option}
                                  {isCorrectAnswer && <span className="ml-2 font-medium text-green-600">Правильный ответ</span>}
                                  {isUserAnswer && !isCorrectAnswer && <span className="ml-2 font-medium text-red-600">Ваш ответ</span>}
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      );
                    })}

                    {testResult.score >= 70 ? (
                      <Button onClick={goBackToCourse} className="w-full">
                        Вернуться к курсу
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
                          setTestSubmitted(false);
                          setTestAnswers(new Array(lesson.test!.questions.length).fill(null));
                        }}
                        className="w-full"
                      >
                        Попробовать снова
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {lesson.type !== "test" && (
              <div className="flex items-center justify-between border-t pt-6">
                <Button variant="outline" className="gap-2" onClick={goBackToCourse}>
                  <ArrowLeft className="h-4 w-4" />К содержанию
                </Button>

                <Button onClick={handleCompleteLesson} className="gap-2">
                  Завершить урок
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
