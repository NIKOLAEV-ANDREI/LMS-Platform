export const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface User {
  id: string;
  publicId: string;
  email: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
  blocked?: boolean;
  blockedAt?: string;
  avatarUrl?: string;
  enrolledCourses: string[];
  createdCourses: string[];
  createdAt: string;
}

export interface Course {
  id: string;
  publicId: string;
  title: string;
  description: string;
  imageUrl: string;
  teacherId: string;
  teacherPublicId?: string;
  teacherName: string;
  createdAt: string;
  modules: Module[];
  enrolledStudents: string[];
  status?: string;
  hasPassword?: boolean;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
  order: number;
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'video' | 'test';
  videoUrl?: string;
  requiresReview?: boolean;
  attachments?: LessonAttachment[];
  test?: Test;
  order: number;
}

export interface LessonAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  url: string;
}

export interface LessonSubmission {
  id: string;
  courseId: string;
  lessonId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  teacherId: string;
  fileName: string;
  fileUrl: string;
  studentNote: string;
  reviewNote: string;
  status: "pending" | "approved" | "rejected";
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
}

export interface Test {
  settings?: TestSettings;
  questions: Question[];
}

export interface Question {
  id: string;
  type: 'single' | 'multiple' | 'open' | 'true_false';
  question: string;
  options?: string[];
  correctAnswer?: number;
  correctAnswers?: number[];
  correctText?: string;
}

export interface TestSettings {
  timeLimitSec: number;
  passScore: number;
  maxAttempts: number;
  allowRetakeAfterPass: boolean;
  randomQuestionCount: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showCorrectAnswers: boolean;
}

export interface LessonTestQuestionPublic {
  id: string;
  type: 'single' | 'multiple' | 'open' | 'true_false';
  question: string;
  options: string[];
}

export interface LessonTestAnswer {
  questionId: string;
  option?: number;
  options?: number[];
  text?: string;
}

export interface LessonTestQuestionResult {
  questionId: string;
  question: string;
  type: string;
  isCorrect: boolean;
  studentAnswer?: unknown;
  correctAnswer?: unknown;
}

export interface LessonTestAttemptStart {
  attemptId: string;
  attemptNumber: number;
  maxAttempts: number;
  passScore: number;
  timeLimitSec: number;
  questions: LessonTestQuestionPublic[];
  startedAt: string;
}

export interface LessonTestAttemptResult {
  attemptId: string;
  attemptNumber: number;
  score: number;
  passed: boolean;
  timeExpired?: boolean;
  passScore: number;
  correctAnswers: number;
  totalQuestions: number;
  durationSec: number;
  showAnswers: boolean;
  results: LessonTestQuestionResult[];
  submittedAt: string;
}

export interface LessonTestAttemptHistoryItem {
  id: string;
  attemptNumber: number;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  passed: boolean;
  startedAt: string;
  submittedAt?: string;
  studentName?: string;
  studentEmail?: string;
}

export interface LessonTestStudentStat {
  studentId: string;
  studentName: string;
  studentEmail: string;
  attemptsUsed: number;
  bestScore: number;
  lastScore: number;
  passed: boolean;
}

export interface LessonTestQuestionAnalytics {
  questionId: string;
  question: string;
  timesShown: number;
  correctCount: number;
  correctRate: number;
}

export interface LessonTestAnalytics {
  courseId: string;
  lessonId: string;
  totalStudents: number;
  passedStudents: number;
  failedStudents: number;
  students: LessonTestStudentStat[];
  questions: LessonTestQuestionAnalytics[];
}

export interface TestResult {
  lessonId: string;
  score: number;
  completedAt: string;
}

export interface Progress {
  userId: string;
  courseId: string;
  completedLessons: string[];
  testResults: TestResult[];
  progress: number;
  enrolledAt: string;
}

export interface TeacherPublicProfile {
  teacher: {
    id: string;
    publicId: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  courses: Course[];
}

class API {
  private token: string | null = null;
  private readonly tokenKey = 'auth_token';
  private readonly userKey = 'auth_user';
  private readonly fieldTranslations: Record<string, string> = {
    name: 'Имя',
    email: 'Email',
    password: 'Пароль',
    title: 'Название',
    description: 'Описание',
    'course password': 'Пароль курса',
    'module title': 'Название модуля',
    'module description': 'Описание модуля',
    'lesson title': 'Название урока',
    'lesson content': 'Содержание урока',
    'video url': 'Ссылка на видео',
    'review note': 'Комментарий преподавателя',
    'submission file name': 'Имя файла',
    'submission file url': 'Ссылка на файл',
    'student note': 'Комментарий студента',
  };
  private readonly errorTranslations: Array<{ test: RegExp; value: string }> = [
    { test: /^Request failed$/i, value: 'Ошибка запроса к серверу' },
    { test: /^not implemented$/i, value: 'Функция пока не реализована на сервере' },
    { test: /^invalid json$/i, value: 'Некорректный JSON в запросе' },
    { test: /^invalid credentials$/i, value: 'Неверный email или пароль' },
    { test: /user is blocked/i, value: 'Пользователь заблокирован' },
    { test: /missing auth header/i, value: 'Отсутствует заголовок авторизации' },
    { test: /invalid auth header/i, value: 'Некорректный заголовок авторизации' },
    { test: /authorization header is missing/i, value: 'Отсутствует токен авторизации' },
    { test: /token is invalid/i, value: 'Недействительный токен авторизации' },
    { test: /^invalid token$/i, value: 'Недействительный токен авторизации' },
    { test: /invalid signing method/i, value: 'Недействительный токен авторизации' },
    { test: /invalid token claims/i, value: 'Некорректные данные токена' },
    { test: /token has invalid claims/i, value: 'Срок действия сессии истек, войдите снова' },
    { test: /token is expired/i, value: 'Срок действия сессии истек, войдите снова' },
    { test: /rate limit exceeded/i, value: 'Слишком много запросов. Попробуйте снова позже' },
    { test: /role not found/i, value: 'Роль пользователя не определена' },
    { test: /invalid email format/i, value: 'Некорректный формат email' },
    { test: /email already exists/i, value: 'Пользователь с таким email уже существует' },
    { test: /user already exists/i, value: 'Пользователь с таким email уже существует' },
    { test: /public registration allows only student or teacher/i, value: 'При открытой регистрации доступны только роли студент и преподаватель' },
    { test: /invalid teacher registration password/i, value: 'Неверный код доступа преподавателя' },
    { test: /invalid role/i, value: 'Некорректная роль пользователя' },
    { test: /user not found/i, value: 'Пользователь не найден' },
    { test: /course not found/i, value: 'Курс не найден' },
    { test: /course must be in deleted status/i, value: 'Окончательно удалить можно только курс из раздела удаленных' },
    { test: /invalid user id/i, value: 'Некорректный ID пользователя' },
    { test: /invalid course id/i, value: 'Некорректный ID курса' },
    { test: /invalid module id/i, value: 'Некорректный ID модуля' },
    { test: /invalid lesson id/i, value: 'Некорректный ID урока' },
    { test: /invalid submission id/i, value: 'Некорректный ID отправленной работы' },
    { test: /module not found in course/i, value: 'Модуль не найден в курсе' },
    { test: /lesson not found in module/i, value: 'Урок не найден в модуле' },
    { test: /lesson not found in this course/i, value: 'Урок не найден в этом курсе' },
    { test: /student is not enrolled in this course/i, value: 'Студент не записан на этот курс' },
    { test: /progress not found/i, value: 'Прогресс по курсу не найден' },
    { test: /lesson type must be text, video or test/i, value: 'Тип урока должен быть: текстовый, видео или тест' },
    { test: /attachments are allowed only for text and video lessons/i, value: 'Файлы можно прикреплять только к текстовому или видео-уроку' },
    { test: /too many attachments \(max \d+\)/i, value: 'Превышено максимально допустимое количество файлов' },
    { test: /attachment \d+ size must be 0\.\.\d+ bytes/i, value: 'Один из файлов превышает допустимый размер' },
    { test: /attachment \d+ has invalid url format/i, value: 'Некорректный формат прикрепленного файла' },
    { test: /submission not found/i, value: 'Отправленная работа не найдена' },
    { test: /invalid submission status/i, value: 'Некорректный статус отправленной работы' },
    { test: /submission is already reviewed/i, value: 'Работа уже проверена преподавателем' },
    { test: /submission file has invalid format/i, value: 'Некорректный формат файла для отправки' },
    { test: /lesson does not require review submission/i, value: 'Для этого урока не требуется отправка работы на проверку' },
    { test: /review note is required for rejection/i, value: 'Добавьте комментарий при отклонении работы' },
    { test: /invalid review action/i, value: 'Некорректное действие проверки работы' },
    { test: /review note/i, value: 'Комментарий преподавателя слишком длинный' },
    { test: /cannot change own role/i, value: 'Свою роль менять нельзя' },
    { test: /cannot block own user/i, value: 'Нельзя удалить аккаунт, под которым вы сейчас авторизованы' },
    { test: /cannot change creator admin role/i, value: 'Нельзя менять роль администратора, который создал ваш аккаунт' },
    { test: /invalid permanent delete confirmation/i, value: 'Подтвердите удаление словом DELETE' },
    { test: /cannot permanently delete own user/i, value: 'Нельзя окончательно удалить аккаунт, под которым вы сейчас авторизованы' },
    { test: /cannot permanently delete creator admin/i, value: 'Нельзя удалить администратора, который создал ваш аккаунт' },
    { test: /user must be blocked before permanent delete/i, value: 'Окончательное удаление доступно только во вкладке удалённых пользователей' },
    { test: /cannot permanently delete user with active courses/i, value: 'Сначала снимите с пользователя все активные курсы' },
    { test: /cannot permanently delete user with deleted courses/i, value: 'Сначала удалите окончательно курсы пользователя из раздела удалённых курсов' },
    { test: /cannot permanently delete user with enrollments/i, value: 'Сначала удалите записи пользователя на курсы' },
    { test: /cannot permanently delete user with pending teacher submissions/i, value: 'У пользователя есть непроверенные работы студентов' },
    { test: /cannot permanently delete user with pending student submissions/i, value: 'У пользователя есть работы на проверке у преподавателя' },
    { test: /cannot permanently delete user with dependent admins/i, value: 'Сначала переназначьте или удалите администраторов, созданных этим пользователем' },
    { test: /forbidden:\s*course does not belong to teacher/i, value: 'Недостаточно прав: курс не принадлежит этому преподавателю' },
    { test: /test lesson must have at least one question/i, value: 'Тестовый урок должен содержать минимум один вопрос' },
    { test: /question (\d+) type must be single, multiple, open or true_false/i, value: 'Укажите корректный тип вопроса (single, multiple, open или true_false)' },
    { test: /question (\d+) options count must be \d+\.\.\d+/i, value: 'В вопросе указано недопустимое количество вариантов ответа' },
    { test: /question (\d+) must have at least 1 correct option/i, value: 'Для вопроса с множественным выбором нужен минимум один правильный вариант' },
    { test: /question (\d+) has invalid correct (option )?index/i, value: 'В вопросе указан некорректный индекс правильного ответа' },
    { test: /test pass score must be \d+\.\.\d+/i, value: 'Проходной балл теста указан неверно' },
    { test: /test max attempts must be \d+\.\.\d+/i, value: 'Количество попыток теста указано неверно' },
    { test: /test random question count must be \d+\.\.\d+/i, value: 'Количество вопросов в выборке указано неверно' },
    { test: /test time limit must be 0\.\.\d+ seconds/i, value: 'Ограничение времени теста указано неверно' },
    { test: /test attempts limit reached/i, value: 'Лимит попыток для этого теста исчерпан' },
    { test: /test already passed/i, value: 'Тест уже пройден. Повторное прохождение отключено преподавателем' },
    { test: /test time is over/i, value: 'Время прохождения теста истекло' },
    { test: /test attempt not found/i, value: 'Попытка теста не найдена' },
    { test: /test attempt already submitted/i, value: 'Эта попытка теста уже отправлена' },
    { test: /lesson is not a test/i, value: 'Этот урок не является тестом' },
    { test: /invalid test attempt id/i, value: 'Некорректный ID попытки теста' },
    { test: /avatar is too large/i, value: 'Аватар слишком большой' },
    { test: /invalid avatar format/i, value: 'Недопустимый формат аватара' },
    { test: /is required$/i, value: 'Заполните обязательное поле' },
    { test: /is too long \(max \d+ chars\)$/i, value: 'Превышена максимальная длина поля' },
    { test: /is too short \(min \d+ chars\)$/i, value: 'Значение слишком короткое' },
    { test: /forbidden/i, value: 'Недостаточно прав для выполнения действия' },
    { test: /progress must be 0\.\.100/i, value: 'Прогресс должен быть в диапазоне от 0 до 100' },
    { test: /course password required/i, value: 'Требуется пароль курса' },
    { test: /invalid course password/i, value: 'Неверный пароль курса' },
    { test: /invalid search filter/i, value: 'Некорректный фильтр поиска' },
    { test: /duplicate key value violates unique constraint/i, value: 'Нарушение уникальности данных (дублирующее значение)' },
    { test: /violates foreign key constraint/i, value: 'Нарушены связи данных в базе' },
    { test: /sql: no rows in result set/i, value: 'Запись не найдена' },
    { test: /relation .* does not exist/i, value: 'Ошибка структуры базы данных (нет нужной таблицы)' },
    { test: /password authentication failed/i, value: 'Ошибка подключения к базе данных (неверный пароль)' },
    { test: /connection refused/i, value: 'Сервер базы данных недоступен' },
    { test: /timeout/i, value: 'Превышено время ожидания ответа сервера' },
  ];

  private humanizeFieldName(rawField: string): string {
    const normalized = String(rawField || '').trim().toLowerCase();
    if (!normalized) return 'Поле';
    return this.fieldTranslations[normalized] || rawField.trim();
  }

  private localizeDetailedError(message: string): string | null {
    let match = message.match(/^(.+?) is required$/i);
    if (match) {
      return `Поле "${this.humanizeFieldName(match[1])}" обязательно для заполнения`;
    }

    match = message.match(/^(.+?) is too long \(max (\d+) chars\)$/i);
    if (match) {
      return `Поле "${this.humanizeFieldName(match[1])}": максимум ${match[2]} символов`;
    }

    match = message.match(/^(.+?) is too short \(min (\d+) chars\)$/i);
    if (match) {
      return `Поле "${this.humanizeFieldName(match[1])}": минимум ${match[2]} символов`;
    }

    match = message.match(/^too many attachments \(max (\d+)\)$/i);
    if (match) {
      return `Превышено максимально допустимое количество файлов: ${match[1]}`;
    }

    match = message.match(/^attachment (\d+) size must be 0\.\.(\d+) bytes$/i);
    if (match) {
      return `Файл №${match[1]} превышает допустимый размер (${match[2]} байт)`;
    }

    match = message.match(/^attachment (\d+) has invalid url format$/i);
    if (match) {
      return `У файла №${match[1]} некорректный формат ссылки`;
    }

    match = message.match(/^question (\d+) type must be single, multiple, open or true_false$/i);
    if (match) {
      return `Вопрос №${match[1]}: укажите тип single, multiple, open или true_false`;
    }

    match = message.match(/^question (\d+) options count must be (\d+)\.\.(\d+)$/i);
    if (match) {
      return `Вопрос №${match[1]}: количество вариантов должно быть от ${match[2]} до ${match[3]}`;
    }

    match = message.match(/^user permanent delete cooldown active \(days_left=(\d+)\)$/i);
    if (match) {
      return `Окончательное удаление будет доступно через ${match[1]} дн.`;
    }

    match = message.match(/^forbidden:\s*(.+)$/i);
    if (match) {
      const reason = match[1].trim().toLowerCase();
      if (reason === 'course does not belong to teacher') {
        return 'Недостаточно прав: курс не принадлежит этому преподавателю';
      }
      return `Недостаточно прав: ${match[1].trim()}`;
    }

    if (/duplicate key value violates unique constraint/i.test(message)) {
      if (/users_email_key/i.test(message)) {
        return 'Пользователь с таким email уже существует';
      }
      if (/users_public_id_idx/i.test(message)) {
        return 'Ошибка генерации публичного ID пользователя, повторите попытку';
      }
      if (/courses_public_id_idx/i.test(message)) {
        return 'Ошибка генерации публичного ID курса, повторите попытку';
      }
      if (/lesson_submissions_course_id_lesson_id_student_id_key/i.test(message)) {
        return 'Работа по этому уроку уже отправлена на проверку';
      }
      return 'Нарушение уникальности данных (дублирующее значение)';
    }

    if (/violates foreign key constraint/i.test(message)) {
      return 'Операция невозможна: связанная запись не найдена или уже удалена';
    }

    return null;
  }

  private localizeErrorMessage(message: string): string {
    const normalized = String(message || '').trim();
    if (!normalized) return 'Произошла ошибка';

    const detailed = this.localizeDetailedError(normalized);
    if (detailed) {
      return detailed;
    }

    for (const translation of this.errorTranslations) {
      if (translation.test.test(normalized)) {
        return translation.value;
      }
    }

    if (/[A-Za-z]/.test(normalized)) {
      return `Ошибка сервера: ${normalized}`;
    }

    return normalized;
  }

  private saveUser(user: User | null) {
    if (user) {
      localStorage.setItem(this.userKey, JSON.stringify(user));
      return;
    }
    localStorage.removeItem(this.userKey);
  }

  private readUser(): User | null {
    const raw = localStorage.getItem(this.userKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  private mapUser(raw: any, prev?: User | null): User {
    return {
      id: String(raw.id),
      publicId: String(raw.public_id || raw.publicId || raw.id || ""),
      email: raw.email,
      name: raw.name,
      role: raw.role,
      blocked: Boolean(raw.blocked),
      blockedAt: raw.blocked_at || raw.blockedAt || undefined,
      avatarUrl: raw.avatar_url || raw.avatarUrl || '',
      enrolledCourses: prev?.enrolledCourses ?? [],
      createdCourses: prev?.createdCourses ?? [],
      createdAt: prev?.createdAt ?? new Date().toISOString(),
    };
  }

  private mapCourse(raw: any): Course {
    const enrolledStudentsRaw = raw.enrolledStudents ?? raw.enrolled_students;
    const modules: Module[] = Array.isArray(raw.modules)
      ? raw.modules.map((m: any) => ({
          id: String(m.id),
          title: m.title,
          description: m.description || '',
          order: Number(m.order ?? 0),
          lessons: Array.isArray(m.lessons)
            ? m.lessons.map((l: any) => ({
                id: String(l.id),
                title: l.title,
                content: l.content || '',
                type: l.type || 'text',
                videoUrl: l.video_url || l.videoUrl || '',
                requiresReview: Boolean(l.requires_review ?? l.requiresReview),
                attachments: Array.isArray(l.attachments)
                  ? l.attachments.map((a: any) => ({
                      id: String(a.id || ''),
                      name: String(a.name || ''),
                      contentType: String(a.contentType || a.content_type || ''),
                      size: Number(a.size || 0),
                      url: String(a.url || ''),
                    }))
                  : [],
                test: l.test && Array.isArray(l.test.questions)
                  ? {
                      settings: l.test.settings
                        ? {
                            timeLimitSec: Number(l.test.settings.timeLimitSec ?? 0),
                            passScore: Number(l.test.settings.passScore ?? 70),
                            maxAttempts: Number(l.test.settings.maxAttempts ?? 3),
                            allowRetakeAfterPass: Boolean(l.test.settings.allowRetakeAfterPass),
                            randomQuestionCount: Number(l.test.settings.randomQuestionCount ?? l.test.questions.length ?? 0),
                            shuffleQuestions: Boolean(l.test.settings.shuffleQuestions),
                            shuffleOptions: Boolean(l.test.settings.shuffleOptions),
                            showCorrectAnswers: Boolean(l.test.settings.showCorrectAnswers),
                          }
                        : undefined,
                      questions: l.test.questions.map((q: any) => ({
                        id: String(q.id || ''),
                        type: q.type || 'single',
                        question: q.question || '',
                        options: Array.isArray(q.options) ? q.options.map((opt: any) => String(opt)) : [],
                        correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : undefined,
                        correctAnswers: Array.isArray(q.correctAnswers) ? q.correctAnswers.map((item: any) => Number(item)) : undefined,
                        correctText: typeof q.correctText === 'string' ? q.correctText : undefined,
                      })),
                    }
                  : undefined,
                order: Number(l.order ?? 0),
              }))
            : [],
        }))
      : [];

    return {
      id: String(raw.id),
      publicId: String(raw.public_id || raw.publicId || raw.id || ""),
      title: raw.title,
      description: raw.description,
      imageUrl: raw.imageUrl || '',
      teacherId: String(raw.teacher_id),
      teacherPublicId: raw.teacher_public_id ? String(raw.teacher_public_id) : undefined,
      teacherName: raw.teacher_name || raw.teacherName || `Преподаватель #${raw.teacher_id}`,
      createdAt: raw.createdAt || new Date().toISOString(),
      modules,
      enrolledStudents: Array.isArray(enrolledStudentsRaw) ? enrolledStudentsRaw.map((id: any) => String(id)) : [],
      status: raw.status,
      hasPassword: Boolean(raw.has_password ?? raw.hasPassword),
    };
  }

  private mapLessonSubmission(raw: any): LessonSubmission {
    return {
      id: String(raw.id),
      courseId: String(raw.course_id ?? raw.courseId ?? ""),
      lessonId: String(raw.lesson_id ?? raw.lessonId ?? ""),
      studentId: String(raw.student_id ?? raw.studentId ?? ""),
      studentName: String(raw.student_name ?? raw.studentName ?? ""),
      studentEmail: String(raw.student_email ?? raw.studentEmail ?? ""),
      teacherId: String(raw.teacher_id ?? raw.teacherId ?? ""),
      fileName: String(raw.file_name ?? raw.fileName ?? ""),
      fileUrl: String(raw.file_url ?? raw.fileUrl ?? ""),
      studentNote: String(raw.student_note ?? raw.studentNote ?? ""),
      reviewNote: String(raw.review_note ?? raw.reviewNote ?? ""),
      status: (raw.status || "pending") as "pending" | "approved" | "rejected",
      attemptCount: Number(raw.attempt_count ?? raw.attemptCount ?? 1),
      createdAt: String(raw.created_at ?? raw.createdAt ?? ""),
      updatedAt: String(raw.updated_at ?? raw.updatedAt ?? ""),
      reviewedAt: raw.reviewed_at ?? raw.reviewedAt ?? undefined,
    };
  }

  private mapLessonTestAttemptHistoryItem(raw: any): LessonTestAttemptHistoryItem {
    return {
      id: String(raw.id),
      attemptNumber: Number(raw.attempt_number ?? raw.attemptNumber ?? 0),
      totalQuestions: Number(raw.total_questions ?? raw.totalQuestions ?? 0),
      correctAnswers: Number(raw.correct_answers ?? raw.correctAnswers ?? 0),
      score: Number(raw.score ?? 0),
      passed: Boolean(raw.passed),
      startedAt: String(raw.started_at ?? raw.startedAt ?? ""),
      submittedAt: raw.submitted_at ?? raw.submittedAt ?? undefined,
      studentName: raw.student_name ?? raw.studentName ?? undefined,
      studentEmail: raw.student_email ?? raw.studentEmail ?? undefined,
    };
  }

  private mapLessonTestAnalytics(raw: any): LessonTestAnalytics {
    return {
      courseId: String(raw.course_id ?? raw.courseId ?? ""),
      lessonId: String(raw.lesson_id ?? raw.lessonId ?? ""),
      totalStudents: Number(raw.total_students ?? raw.totalStudents ?? 0),
      passedStudents: Number(raw.passed_students ?? raw.passedStudents ?? 0),
      failedStudents: Number(raw.failed_students ?? raw.failedStudents ?? 0),
      students: Array.isArray(raw.students)
        ? raw.students.map((item: any) => ({
            studentId: String(item.student_id ?? item.studentId ?? ""),
            studentName: String(item.student_name ?? item.studentName ?? ""),
            studentEmail: String(item.student_email ?? item.studentEmail ?? ""),
            attemptsUsed: Number(item.attempts_used ?? item.attemptsUsed ?? 0),
            bestScore: Number(item.best_score ?? item.bestScore ?? 0),
            lastScore: Number(item.last_score ?? item.lastScore ?? 0),
            passed: Boolean(item.passed),
          }))
        : [],
      questions: Array.isArray(raw.questions)
        ? raw.questions.map((item: any) => ({
            questionId: String(item.question_id ?? item.questionId ?? ""),
            question: String(item.question ?? ""),
            timesShown: Number(item.times_shown ?? item.timesShown ?? 0),
            correctCount: Number(item.correct_count ?? item.correctCount ?? 0),
            correctRate: Number(item.correct_rate ?? item.correctRate ?? 0),
          }))
        : [],
    };
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem(this.tokenKey, token);
    } else {
      localStorage.removeItem(this.tokenKey);
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem(this.tokenKey);
    }
    return this.token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      const bodyText = await response.text();
      let data: any = {};
      if (bodyText) {
        try {
          data = JSON.parse(bodyText);
        } catch {
          data = {};
        }
      }

      if (!response.ok) {
        const rawError = String(data.error || data.message || bodyText || 'Request failed');
        throw new Error(this.localizeErrorMessage(rawError));
      }

      return data;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Бэкенд недоступен: проверьте VITE_API_URL и доступность API');
      }
      if (error instanceof Error) {
        throw new Error(this.localizeErrorMessage(error.message));
      }
      throw error;
    }
  }

  private async syncUserFromDashboard(baseUser: User): Promise<User> {
    try {
      const dashboard = await this.request('/dashboard');
      if (baseUser.role === 'student') {
        const enrolledCourses = Array.isArray(dashboard.progress)
          ? dashboard.progress.map((p: any) => String(p.course_id))
          : [];
        const nextUser = { ...baseUser, enrolledCourses };
        this.saveUser(nextUser);
        return nextUser;
      }

      if (baseUser.role === 'teacher') {
        const createdCourses = Array.isArray(dashboard.courses)
          ? dashboard.courses.map((c: any) => String(c.id))
          : [];
        const nextUser = { ...baseUser, createdCourses };
        this.saveUser(nextUser);
        return nextUser;
      }
    } catch {
      // Keep base user when dashboard data is not available.
    }

    this.saveUser(baseUser);
    return baseUser;
  }

  async signup(
    email: string,
    password: string,
    name: string,
    role: 'student' | 'teacher',
    teacherAccessPassword?: string,
  ) {
    const user = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        name,
        role,
        teacher_access_password: teacherAccessPassword || "",
      }),
    });
    return { success: true, user: this.mapUser(user, null) };
  }

  async signin(email: string, password: string) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    this.setToken(data.token);
    const mapped = this.mapUser(data.user, this.readUser());
    const syncedUser = await this.syncUserFromDashboard(mapped);

    return {
      success: true,
      accessToken: data.token,
      user: syncedUser,
    };
  }

  async getSession(options?: { syncDashboard?: boolean }): Promise<{ user: User }> {
    const token = this.getToken();
    if (!token) throw new Error('Не авторизован');

    const localUser = this.readUser();
    try {
      const me = await this.request('/me');
      const mapped = this.mapUser(me, localUser);
      if (options?.syncDashboard) {
        const synced = await this.syncUserFromDashboard(mapped);
        return { user: synced };
      }
      this.saveUser(mapped);
      return { user: mapped };
    } catch {
      if (!localUser) throw new Error('Сессия не найдена, войди заново');
      if (options?.syncDashboard) {
        const synced = await this.syncUserFromDashboard(localUser);
        return { user: synced };
      }
      return { user: localUser };
    }
  }

  async getCourses(): Promise<{ courses: Course[] }> {
    let role = this.readUser()?.role;
    if (!role) {
      const { user } = await this.getSession();
      role = user.role;
    }

    if (role === 'student') {
      const courses = await this.request('/courses');
      return { courses: (courses || []).map((c: any) => this.mapCourse(c)) };
    }

    if (role === 'teacher') {
      const courses = await this.request('/teacher/courses');
      return { courses: (courses || []).map((c: any) => this.mapCourse(c)) };
    }

    const courses = await this.request('/admin/courses');
    return { courses: (courses || []).map((c: any) => this.mapCourse(c)) };
  }

  async getCourse(id: string, accessPassword?: string): Promise<{ course: Course }> {
    const headers: HeadersInit = {};
    if (accessPassword) {
      headers["X-Course-Password"] = accessPassword;
    }
    const course = await this.request(`/courses/${id}`, { headers });
    return { course: this.mapCourse(course) };
  }

  async searchCourses(query: string, by: "all" | "id" | "title" | "teacher" = "all"): Promise<{ courses: Course[] }> {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("query", query.trim());
    }
    params.set("by", by);
    const rows = await this.request(`/courses/search?${params.toString()}`);
    return { courses: (rows || []).map((c: any) => this.mapCourse(c)) };
  }

  async getTeacherPublicProfile(teacherId: string): Promise<TeacherPublicProfile> {
    const data = await this.request(`/teachers/${teacherId}/profile`);
    return {
      teacher: {
        id: String(data.teacher?.id || teacherId),
        publicId: String(data.teacher?.public_id || data.teacher?.publicId || data.teacher?.id || teacherId),
        name: String(data.teacher?.name || "Преподаватель"),
        email: String(data.teacher?.email || ""),
        avatarUrl: data.teacher?.avatar_url || "",
      },
      courses: (data.courses || []).map((course: any) => this.mapCourse(course)),
    };
  }

  async createCourse(title: string, description: string) {
    const course = await this.request('/teacher/courses', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    });
    return { success: true, course: this.mapCourse(course) };
  }

  async publishCourse(courseId: string) {
    await this.request(`/teacher/courses/${courseId}/publish`, {
      method: 'POST',
    });
    return { success: true };
  }

  async unpublishCourse(courseId: string) {
    await this.request(`/teacher/courses/${courseId}/unpublish`, {
      method: 'POST',
    });
    return { success: true };
  }

  async removeCourse(courseId: string) {
    await this.request(`/teacher/courses/${courseId}`, {
      method: 'DELETE',
    });
    return { success: true };
  }

  async restoreCourseAsTeacher(courseId: string) {
    await this.request(`/teacher/courses/${courseId}/restore`, { method: 'POST' });
    return { success: true };
  }

  async updateCourseAsTeacher(courseId: string, title: string, description: string) {
    const course = await this.request(`/teacher/courses/${courseId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, description }),
    });
    return { success: true, course: this.mapCourse(course) };
  }

  async updateCourseAsAdmin(courseId: string, title: string, description: string) {
    const course = await this.request(`/admin/courses/${courseId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, description }),
    });
    return { success: true, course: this.mapCourse(course) };
  }

  async publishCourseAsAdmin(courseId: string) {
    await this.request(`/admin/courses/${courseId}/publish`, { method: 'POST' });
    return { success: true };
  }

  async unpublishCourseAsAdmin(courseId: string) {
    await this.request(`/admin/courses/${courseId}/unpublish`, { method: 'POST' });
    return { success: true };
  }

  async deleteCourseAsAdmin(courseId: string) {
    await this.request(`/admin/courses/${courseId}`, { method: 'DELETE' });
    return { success: true };
  }

  async restoreCourseAsAdmin(courseId: string) {
    await this.request(`/admin/courses/${courseId}/restore`, { method: 'POST' });
    return { success: true };
  }

  async permanentlyDeleteCourseAsAdmin(courseId: string) {
    await this.request(`/admin/courses/${courseId}/permanent`, { method: "DELETE" });
    return { success: true };
  }

  async setCoursePassword(courseId: string, password: string) {
    await this.request(`/teacher/courses/${courseId}/password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    return { success: true };
  }

  async clearCoursePassword(courseId: string) {
    await this.request(`/teacher/courses/${courseId}/password`, { method: 'DELETE' });
    return { success: true };
  }

  async setCoursePasswordByAdmin(courseId: string, password: string) {
    await this.request(`/admin/courses/${courseId}/password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    return { success: true };
  }

  async clearCoursePasswordByAdmin(courseId: string) {
    await this.request(`/admin/courses/${courseId}/password`, { method: 'DELETE' });
    return { success: true };
  }

  async updateCourse(_id: string, _updates: Partial<Course>) {
    throw new Error('Используйте методы обновления курса для конкретной роли');
  }

  async enrollCourse(id: string, accessPassword?: string) {
    await this.request(`/courses/${id}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ access_password: accessPassword || "" }),
    });

    const user = this.readUser();
    if (user && !user.enrolledCourses.includes(String(id))) {
      const nextUser = { ...user, enrolledCourses: [...user.enrolledCourses, String(id)] };
      this.saveUser(nextUser);
    }

    return { success: true };
  }

  async unenrollCourse(id: string) {
    await this.request(`/courses/${id}/enroll`, {
      method: 'DELETE',
    });

    const user = this.readUser();
    if (user && user.enrolledCourses.includes(String(id))) {
      const nextUser = { ...user, enrolledCourses: user.enrolledCourses.filter((courseId) => courseId !== String(id)) };
      this.saveUser(nextUser);
    }

    return { success: true };
  }

  async addModule(courseId: string, title: string, description: string) {
    const module = await this.request(`/teacher/courses/${courseId}/modules`, {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    });
    return { success: true, module };
  }

  async updateModule(courseId: string, moduleId: string, title: string, description: string) {
    const module = await this.request(`/teacher/courses/${courseId}/modules/${moduleId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, description }),
    });
    return { success: true, module };
  }

  async deleteModule(courseId: string, moduleId: string) {
    await this.request(`/teacher/courses/${courseId}/modules/${moduleId}`, {
      method: 'DELETE',
    });
    return { success: true };
  }

  async addModuleAsAdmin(courseId: string, title: string, description: string) {
    const module = await this.request(`/admin/courses/${courseId}/modules`, {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    });
    return { success: true, module };
  }

  async updateModuleAsAdmin(courseId: string, moduleId: string, title: string, description: string) {
    const module = await this.request(`/admin/courses/${courseId}/modules/${moduleId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, description }),
    });
    return { success: true, module };
  }

  async deleteModuleAsAdmin(courseId: string, moduleId: string) {
    await this.request(`/admin/courses/${courseId}/modules/${moduleId}`, {
      method: 'DELETE',
    });
    return { success: true };
  }

  async addLesson(courseId: string, moduleId: string, lesson: Partial<Lesson>) {
    const created = await this.request(`/teacher/courses/${courseId}/modules/${moduleId}/lessons`, {
      method: 'POST',
      body: JSON.stringify({
        title: lesson.title,
        content: lesson.content,
        type: lesson.type,
        videoUrl: lesson.videoUrl,
        requiresReview: Boolean(lesson.requiresReview),
        test: lesson.test,
        attachments: lesson.attachments,
      }),
    });
    return { success: true, lesson: created };
  }

  async updateLesson(courseId: string, moduleId: string, lessonId: string, lesson: Partial<Lesson>) {
    const updated = await this.request(`/teacher/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: lesson.title,
        content: lesson.content,
        type: lesson.type,
        videoUrl: lesson.videoUrl,
        requiresReview: Boolean(lesson.requiresReview),
        test: lesson.test,
        attachments: lesson.attachments,
      }),
    });
    return { success: true, lesson: updated };
  }

  async deleteLesson(courseId: string, moduleId: string, lessonId: string) {
    await this.request(`/teacher/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`, {
      method: 'DELETE',
    });
    return { success: true };
  }

  async addLessonAsAdmin(courseId: string, moduleId: string, lesson: Partial<Lesson>) {
    const created = await this.request(`/admin/courses/${courseId}/modules/${moduleId}/lessons`, {
      method: 'POST',
      body: JSON.stringify({
        title: lesson.title,
        content: lesson.content,
        type: lesson.type,
        videoUrl: lesson.videoUrl,
        requiresReview: Boolean(lesson.requiresReview),
        test: lesson.test,
        attachments: lesson.attachments,
      }),
    });
    return { success: true, lesson: created };
  }

  async updateLessonAsAdmin(courseId: string, moduleId: string, lessonId: string, lesson: Partial<Lesson>) {
    const updated = await this.request(`/admin/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: lesson.title,
        content: lesson.content,
        type: lesson.type,
        videoUrl: lesson.videoUrl,
        requiresReview: Boolean(lesson.requiresReview),
        test: lesson.test,
        attachments: lesson.attachments,
      }),
    });
    return { success: true, lesson: updated };
  }

  async deleteLessonAsAdmin(courseId: string, moduleId: string, lessonId: string) {
    await this.request(`/admin/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`, {
      method: 'DELETE',
    });
    return { success: true };
  }

  async startLessonTest(courseId: string, lessonId: string): Promise<{ attempt: LessonTestAttemptStart }> {
    const row = await this.request(`/courses/${courseId}/lessons/${lessonId}/test/start`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    return {
      attempt: {
        attemptId: String(row.attemptId),
        attemptNumber: Number(row.attemptNumber ?? 0),
        maxAttempts: Number(row.maxAttempts ?? 0),
        passScore: Number(row.passScore ?? 70),
        timeLimitSec: Number(row.timeLimitSec ?? 0),
        questions: Array.isArray(row.questions)
          ? row.questions.map((question: any) => ({
              id: String(question.id || ""),
              type: (question.type || "single") as LessonTestQuestionPublic["type"],
              question: String(question.question || ""),
              options: Array.isArray(question.options) ? question.options.map((item: any) => String(item)) : [],
            }))
          : [],
        startedAt: String(row.startedAt || ""),
      },
    };
  }

  async resetStudentLessonTestResultsByTeacher(courseId: string, lessonId: string, studentId: string) {
    await this.request(`/teacher/courses/${courseId}/lessons/${lessonId}/test/students/${studentId}/reset`, {
      method: "DELETE",
    });
    return { success: true };
  }

  async resetStudentLessonTestResultsByAdmin(courseId: string, lessonId: string, studentId: string) {
    await this.request(`/admin/courses/${courseId}/lessons/${lessonId}/test/students/${studentId}/reset`, {
      method: "DELETE",
    });
    return { success: true };
  }

  async submitTest(courseId: string, lessonId: string, attemptId: string, answers: LessonTestAnswer[]) {
    const row = await this.request(`/courses/${courseId}/lessons/${lessonId}/test/submit`, {
      method: "POST",
      body: JSON.stringify({
        attemptId: Number(attemptId),
        answers,
      }),
    });
    const raw = row.result || {};
    return {
      result: {
        attemptId: String(raw.attemptId || attemptId),
        attemptNumber: Number(raw.attemptNumber ?? 0),
        score: Number(raw.score ?? 0),
        passed: Boolean(raw.passed),
        timeExpired: Boolean(raw.timeExpired),
        passScore: Number(raw.passScore ?? 70),
        correctAnswers: Number(raw.correctAnswers ?? 0),
        totalQuestions: Number(raw.totalQuestions ?? 0),
        durationSec: Number(raw.durationSec ?? 0),
        showAnswers: Boolean(raw.showAnswers),
        results: Array.isArray(raw.results)
          ? raw.results.map((item: any) => ({
              questionId: String(item.questionId || ""),
              question: String(item.question || ""),
              type: String(item.type || ""),
              isCorrect: Boolean(item.isCorrect),
              studentAnswer: item.studentAnswer,
              correctAnswer: item.correctAnswer,
            }))
          : [],
        submittedAt: String(raw.submittedAt || ""),
      } as LessonTestAttemptResult,
      progress: row.progress || null,
    };
  }

  async getMyLessonTestAttempts(courseId: string, lessonId: string): Promise<{ attempts: LessonTestAttemptHistoryItem[] }> {
    const rows = await this.request(`/courses/${courseId}/lessons/${lessonId}/test/attempts`);
    return {
      attempts: Array.isArray(rows) ? rows.map((row: any) => this.mapLessonTestAttemptHistoryItem(row)) : [],
    };
  }

  async getTeacherLessonTestAnalytics(courseId: string, lessonId: string): Promise<{ analytics: LessonTestAnalytics; attempts: LessonTestAttemptHistoryItem[] }> {
    const row = await this.request(`/teacher/courses/${courseId}/lessons/${lessonId}/test/analytics`);
    return {
      analytics: this.mapLessonTestAnalytics(row.analytics || {}),
      attempts: Array.isArray(row.attempts) ? row.attempts.map((item: any) => this.mapLessonTestAttemptHistoryItem(item)) : [],
    };
  }

  async getAdminLessonTestAnalytics(courseId: string, lessonId: string): Promise<{ analytics: LessonTestAnalytics; attempts: LessonTestAttemptHistoryItem[] }> {
    const row = await this.request(`/admin/courses/${courseId}/lessons/${lessonId}/test/analytics`);
    return {
      analytics: this.mapLessonTestAnalytics(row.analytics || {}),
      attempts: Array.isArray(row.attempts) ? row.attempts.map((item: any) => this.mapLessonTestAttemptHistoryItem(item)) : [],
    };
  }

  async completeLesson(courseId: string, lessonId: string) {
    const progress = await this.request(`/courses/${courseId}/lessons/${lessonId}/complete`, {
      method: 'POST',
    });
    return { success: true, progress };
  }

  async submitLessonForReview(courseId: string, lessonId: string, payload: { fileName: string; fileUrl: string; studentNote?: string }) {
    const row = await this.request(`/courses/${courseId}/lessons/${lessonId}/submission`, {
      method: "POST",
      body: JSON.stringify({
        file_name: payload.fileName,
        file_url: payload.fileUrl,
        student_note: payload.studentNote || "",
      }),
    });
    return { success: true, submission: this.mapLessonSubmission(row) };
  }

  async getMyCourseSubmissions(courseId: string): Promise<{ submissions: LessonSubmission[] }> {
    const rows = await this.request(`/courses/${courseId}/submissions/me`);
    return { submissions: (rows || []).map((row: any) => this.mapLessonSubmission(row)) };
  }

  async getTeacherCourseSubmissions(courseId: string, status: "pending" | "approved" | "rejected" | "all" = "pending") {
    const rows = await this.request(`/teacher/courses/${courseId}/submissions?status=${encodeURIComponent(status)}`);
    return { submissions: (rows || []).map((row: any) => this.mapLessonSubmission(row)) };
  }

  async getTeacherCourseStudents(courseId: string): Promise<{ students: User[] }> {
    const rows = await this.request(`/teacher/courses/${courseId}/students`);
    return { students: (rows || []).map((row: any) => this.mapUser(row, null)) };
  }

  async reviewLessonSubmission(
    courseId: string,
    submissionId: string,
    payload: { action: "approve" | "reject"; reviewNote?: string },
  ) {
    const data = await this.request(`/teacher/courses/${courseId}/submissions/${submissionId}`, {
      method: "PATCH",
      body: JSON.stringify({
        action: payload.action,
        review_note: payload.reviewNote || "",
      }),
    });
    return {
      success: true,
      submission: data?.submission ? this.mapLessonSubmission(data.submission) : null,
      progress: data?.progress || null,
    };
  }

  async getProgress(courseId: string): Promise<{ progress: Progress | null }> {
    const row = await this.request(`/progress/${courseId}`);
    const completedLessons = Array.isArray(row.completed_lessons)
      ? row.completed_lessons.map((id: number | string) => String(id))
      : [];
    return {
      progress: {
        userId: String(row.user_id),
        courseId: String(row.course_id),
        completedLessons,
        testResults: [],
        progress: Number(row.progress || 0),
        enrolledAt: new Date().toISOString(),
      },
    };
  }

  async getStudentsProgress(_courseId: string) {
    throw new Error('Аналитика по студентам пока не реализована на бэкенде');
  }

  async getAllUsers() {
    const users = await this.request('/admin/users');
    return { users: (users || []).map((u: any) => this.mapUser(u, null)) };
  }

  async createUserAsAdmin(payload: { name: string; email: string; password: string; role: "student" | "teacher" | "admin" }) {
    const user = await this.request('/admin/users', {
      method: "POST",
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        password: payload.password,
        role: payload.role,
      }),
    });
    return { success: true, user: this.mapUser(user, null) };
  }

  async getAdminUserDetails(userId: string) {
    try {
      const data = await this.request(`/admin/users/${userId}`);
      return {
        user: this.mapUser(data.user, null),
        courses: (data.courses || []).map((c: any) => this.mapCourse(c)),
        deletedCourses: (data.deleted_courses || []).map((c: any) => this.mapCourse(c)),
        progress: data.progress || [],
      };
    } catch {
      // Backward-compatible fallback when new admin details endpoint is unavailable.
      const { users } = await this.getAllUsers();
      const user = users.find((u) => u.id === String(userId));
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      const adminCourses = await this.request('/admin/courses');
      const mapped = (adminCourses || []).map((c: any) => this.mapCourse(c));
      const teacherCourses = user.role === 'teacher'
        ? mapped.filter((c) => c.teacherId === user.id && c.status !== 'rejected')
        : [];
      const teacherDeletedCourses = user.role === 'teacher'
        ? mapped.filter((c) => c.teacherId === user.id && c.status === 'rejected')
        : [];
      return {
        user,
        courses: teacherCourses,
        deletedCourses: teacherDeletedCourses,
        progress: [],
      };
    }
  }

  async updateAdminUser(
    userId: string,
    payload: { name?: string; email?: string; password?: string; avatarUrl?: string; removeAvatar?: boolean }
  ) {
    const user = await this.request(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        password: payload.password,
        avatar_url: payload.avatarUrl,
        remove_avatar: Boolean(payload.removeAvatar),
      }),
    });
    return { success: true, user: this.mapUser(user, null) };
  }

  async updateMyProfile(payload: { name?: string; email?: string; password?: string; avatarUrl?: string; removeAvatar?: boolean }) {
    const user = await this.request('/me', {
      method: 'PATCH',
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        password: payload.password,
        avatar_url: payload.avatarUrl,
        remove_avatar: Boolean(payload.removeAvatar),
      }),
    });
    const mapped = this.mapUser(user, this.readUser());
    this.saveUser(mapped);
    return { success: true, user: mapped };
  }

  async updateUserRole(userId: string, role: 'student' | 'teacher' | 'admin') {
    await this.request(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    return { success: true };
  }

  async deleteUser(userId: string) {
    await this.request(`/admin/users/${userId}/block`, {
      method: 'PATCH',
      body: JSON.stringify({ blocked: true }),
    });
    return { success: true };
  }

  async restoreUser(userId: string) {
    await this.request(`/admin/users/${userId}/restore`, {
      method: 'PATCH',
    });
    return { success: true };
  }

  async permanentlyDeleteUser(userId: string, confirmation: string) {
    await this.request(`/admin/users/${userId}/permanent`, {
      method: "DELETE",
      body: JSON.stringify({ confirmation }),
    });
    return { success: true };
  }

  logout() {
    this.setToken(null);
    this.saveUser(null);
  }
}

export const api = new API();


