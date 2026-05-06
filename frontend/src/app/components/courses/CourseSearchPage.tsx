import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { BookOpen, Clock, Lock, Search, Unlock } from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { api, Course, User } from "../../utils/api";
import { LIMITS } from "../../utils/limits";
import { formatRuCount } from "../../utils/plural";

type SearchBy = "all" | "id" | "title" | "teacher";

export default function CourseSearchPage() {
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [searchBy, setSearchBy] = useState<SearchBy>("all");

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const { user: sessionUser } = await api.getSession();
        setUser(sessionUser);
        setInitialized(true);
      } catch (error: any) {
        toast.error(error.message || "Ошибка загрузки страницы поиска");
      } finally {
        setLoading(false);
      }
    };
    void loadInitial();
  }, []);

  const runSearch = async (nextQuery: string, nextBy: SearchBy) => {
    setSearching(true);
    try {
      const { courses: foundCourses } = await api.searchCourses(nextQuery, nextBy);
      setCourses(foundCourses);
    } catch (error: any) {
      toast.error(error.message || "Ошибка поиска курсов");
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await runSearch(query, searchBy);
  };

  useEffect(() => {
    if (!initialized) return;
    const timeoutId = window.setTimeout(() => {
      void runSearch(query, searchBy);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [initialized, query, searchBy]);

  const handleEnroll = async (course: Course) => {
    try {
      let accessPassword = "";
      if (course.hasPassword) {
        const entered = window.prompt("Этот курс защищен паролем. Введите пароль:", "");
        if (entered === null) return;
        accessPassword = entered.trim();
        if (!accessPassword) {
          toast.error("Введите пароль курса");
          return;
        }
        if (accessPassword.length < LIMITS.courseAccessPasswordMin) {
          toast.error(`Пароль курса должен содержать минимум ${LIMITS.courseAccessPasswordMin} символа`);
          return;
        }
        if (accessPassword.length > LIMITS.courseAccessPassword) {
          toast.error(`Пароль курса не должен превышать ${LIMITS.courseAccessPassword} символов`);
          return;
        }
      }
      await api.enrollCourse(course.id, accessPassword);
      toast.success("Вы успешно записались на курс");
      const { user: refreshedUser } = await api.getSession();
      setUser(refreshedUser);
      await runSearch(query, searchBy);
    } catch (error: any) {
      toast.error(error.message || "Ошибка записи на курс");
    }
  };

  const enrolledSet = useMemo(() => new Set(user?.enrolledCourses || []), [user?.enrolledCourses]);

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
        <div>
          <h1 className="text-3xl font-bold">Поиск курсов</h1>
          <p className="mt-1 text-muted-foreground">Ищите курсы по ID, названию или преподавателю</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Фильтры поиска</CardTitle>
            <CardDescription>Введите запрос и выберите поле поиска</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_160px]">
              <div className="space-y-2">
                <Label htmlFor="search-query">Запрос</Label>
                <Input
                  id="search-query"
                  placeholder="Например: 12, JavaScript, Иванов"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="search-by">Искать по</Label>
                <Select value={searchBy} onValueChange={(value) => setSearchBy(value as SearchBy)}>
                  <SelectTrigger id="search-by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ID / Название / Преподаватель</SelectItem>
                    <SelectItem value="id">Только ID</SelectItem>
                    <SelectItem value="title">Только название</SelectItem>
                    <SelectItem value="teacher">Только преподаватель</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="opacity-0">Поиск</Label>
                <Button type="submit" className="h-9 w-full gap-2" disabled={searching}>
                  <Search className="h-4 w-4" />
                  {searching ? "Поиск..." : "Найти"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="text-sm text-muted-foreground">
          Найдено: {formatRuCount(courses.length, "курс", "курса", "курсов")}
        </div>

        {courses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">Курсы не найдены</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => {
              const isStudent = user?.role === "student";
              const isEnrolled = enrolledSet.has(course.id);

              return (
                <Card key={course.id} className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
                  <CardHeader className="min-w-0 bg-[#27A5E7] pb-4 text-white">
                    {course.imageUrl && (
                      <div className="mb-4 aspect-video overflow-hidden rounded-lg bg-gray-200">
                        <img src={course.imageUrl} alt={course.title} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <CardTitle className="line-clamp-1 min-h-7 text-lg leading-tight break-words [overflow-wrap:anywhere]" title={course.title}>
                      {course.title}
                    </CardTitle>
                    <CardDescription
                      className="line-clamp-2 min-h-14 break-words text-white/90 [overflow-wrap:anywhere]"
                      title={course.description}
                    >
                      {course.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="mt-auto flex flex-1 flex-col justify-end gap-4">
                    <div className="text-sm text-muted-foreground">
                      Преподаватель: <span className="font-medium text-foreground">{course.teacherName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{formatRuCount(course.modules.length, "модуль", "модуля", "модулей")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {course.hasPassword ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                      <span>{course.hasPassword ? "С паролем" : "Без пароля"}</span>
                    </div>

                    <div className="flex gap-2">
                      <Link to={`/courses/${course.id}`} className="flex-1">
                        <Button variant={isStudent && !isEnrolled ? "outline" : "default"} className="h-11 w-full">
                          {isStudent ? (isEnrolled ? "Открыть" : "Просмотреть") : "Открыть"}
                        </Button>
                      </Link>
                      {isStudent && !isEnrolled && (
                        <Button className="h-11 flex-1" onClick={() => handleEnroll(course)}>
                          Записаться
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
