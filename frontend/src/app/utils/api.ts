export const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
  blocked?: boolean;
  avatarUrl?: string;
  enrolledCourses: string[];
  createdCourses: string[];
  createdAt: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  teacherId: string;
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

export interface Test {
  questions: Question[];
}

export interface Question {
  id: string;
  type: 'single' | 'multiple' | 'open';
  question: string;
  options?: string[];
  correctAnswer?: number | string;
  correctAnswers?: number[];
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
  private readonly errorTranslations: Array<{ test: RegExp; value: string }> = [
    { test: /^Request failed$/i, value: 'Ошибка запроса к серверу' },
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
    { test: /role not found/i, value: 'Роль пользователя не определена' },
    { test: /email already exists/i, value: 'Пользователь с таким email уже существует' },
    { test: /user already exists/i, value: 'Пользователь с таким email уже существует' },
    { test: /public registration allows only student or teacher/i, value: 'При открытой регистрации доступны только роли студент и преподаватель' },
    { test: /invalid role/i, value: 'Некорректная роль пользователя' },
    { test: /user not found/i, value: 'Пользователь не найден' },
    { test: /course not found/i, value: 'Курс не найден' },
    { test: /invalid user id/i, value: 'Некорректный ID пользователя' },
    { test: /invalid course id/i, value: 'Некорректный ID курса' },
    { test: /invalid module id/i, value: 'Некорректный ID модуля' },
    { test: /invalid lesson id/i, value: 'Некорректный ID урока' },
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
    { test: /test lesson must have at least one question/i, value: 'Тестовый урок должен содержать минимум один вопрос' },
    { test: /question (\d+) type must be single, multiple or open/i, value: 'Укажите корректный тип вопроса (single, multiple или open)' },
    { test: /question (\d+) must have at least 2 options/i, value: 'В вопросе должно быть минимум 2 варианта ответа' },
    { test: /avatar is too large/i, value: 'Аватар слишком большой' },
    { test: /invalid avatar format/i, value: 'Недопустимый формат аватара' },
    { test: /is required$/i, value: 'Заполните обязательное поле' },
    { test: /is too long \(max \d+ chars\)$/i, value: 'Превышена максимальная длина поля' },
    { test: /is too short \(min \d+ chars\)$/i, value: 'Значение слишком короткое' },
    { test: /forbidden/i, value: 'Недостаточно прав для выполнения действия' },
    { test: /progress must be 0\.\.100/i, value: 'Прогресс должен быть в диапазоне от 0 до 100' },
    { test: /course password required/i, value: 'Требуется пароль курса' },
    { test: /invalid course password/i, value: 'Неверный пароль курса' },
  ];

  private localizeErrorMessage(message: string): string {
    const normalized = String(message || '').trim();
    if (!normalized) return 'Произошла ошибка';

    for (const translation of this.errorTranslations) {
      if (translation.test.test(normalized)) {
        return translation.value;
      }
    }

    if (/[A-Za-z]/.test(normalized)) {
      return 'Произошла ошибка на сервере';
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
      email: raw.email,
      name: raw.name,
      role: raw.role,
      blocked: Boolean(raw.blocked),
      avatarUrl: raw.avatar_url || raw.avatarUrl || '',
      enrolledCourses: prev?.enrolledCourses ?? [],
      createdCourses: prev?.createdCourses ?? [],
      createdAt: prev?.createdAt ?? new Date().toISOString(),
    };
  }

  private mapCourse(raw: any): Course {
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
                      questions: l.test.questions.map((q: any) => ({
                        id: String(q.id || ''),
                        type: q.type || 'single',
                        question: q.question || '',
                        options: Array.isArray(q.options) ? q.options.map((opt: any) => String(opt)) : [],
                        correctAnswer: (typeof q.correctAnswer === 'number' || typeof q.correctAnswer === 'string')
                          ? q.correctAnswer
                          : undefined,
                        correctAnswers: Array.isArray(q.correctAnswers) ? q.correctAnswers : undefined,
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
      title: raw.title,
      description: raw.description,
      imageUrl: raw.imageUrl || '',
      teacherId: String(raw.teacher_id),
      teacherName: raw.teacher_name || raw.teacherName || `Преподаватель #${raw.teacher_id}`,
      createdAt: raw.createdAt || new Date().toISOString(),
      modules,
      enrolledStudents: Array.isArray(raw.enrolledStudents) ? raw.enrolledStudents : [],
      status: raw.status,
      hasPassword: Boolean(raw.has_password ?? raw.hasPassword),
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
        throw new Error('Бэкенд недоступен: проверь запуск Go API на localhost:8080');
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

  async signup(email: string, password: string, name: string, role: 'student' | 'teacher') {
    const user = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, role }),
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

  async getSession(): Promise<{ user: User }> {
    const token = this.getToken();
    if (!token) throw new Error('Не авторизован');

    const localUser = this.readUser();
    try {
      const me = await this.request('/me');
      const mapped = this.mapUser(me, localUser);
      const synced = await this.syncUserFromDashboard(mapped);
      return { user: synced };
    } catch {
      if (!localUser) throw new Error('Сессия не найдена, войди заново');
      const synced = await this.syncUserFromDashboard(localUser);
      return { user: synced };
    }
  }

  async getCourses(): Promise<{ courses: Course[] }> {
    const { user } = await this.getSession();

    if (user.role === 'student') {
      const courses = await this.request('/courses');
      return { courses: (courses || []).map((c: any) => this.mapCourse(c)) };
    }

    if (user.role === 'teacher') {
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

  async getTeacherPublicProfile(teacherId: string): Promise<TeacherPublicProfile> {
    const data = await this.request(`/teachers/${teacherId}/profile`);
    return {
      teacher: {
        id: String(data.teacher?.id || teacherId),
        name: String(data.teacher?.name || "Преподаватель"),
        email: String(data.teacher?.email || ""),
        avatarUrl: data.teacher?.avatar_url || "",
      },
      courses: (data.courses || []).map((course: any) => this.mapCourse(course)),
    };
  }

  async createCourse(title: string, description: string, _imageUrl?: string) {
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

  async submitTest(courseId: string, lessonId: string, answers: any[]) {
    const { course } = await this.getCourse(courseId);
    const lesson = course.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
    if (!lesson || lesson.type !== 'test' || !lesson.test?.questions?.length) {
      throw new Error('Тест не найден или не настроен');
    }

    let correctCount = 0;
    for (let i = 0; i < lesson.test.questions.length; i += 1) {
      const question = lesson.test.questions[i];
      const userAnswer = answers[i];

      if (question.type === 'multiple') {
        const expected = Array.isArray(question.correctAnswers) ? [...question.correctAnswers].sort() : [];
        const actual = Array.isArray(userAnswer) ? [...userAnswer].sort() : [];
        if (expected.length > 0 && expected.length === actual.length && expected.every((v, idx) => v === actual[idx])) {
          correctCount += 1;
        }
        continue;
      }

      if (question.type === 'open') {
        const expected = String(question.correctAnswer ?? '').trim().toLowerCase();
        const actual = String(userAnswer ?? '').trim().toLowerCase();
        if (expected && expected === actual) {
          correctCount += 1;
        }
        continue;
      }

      if (typeof question.correctAnswer === 'number' && Number(userAnswer) === question.correctAnswer) {
        correctCount += 1;
      }
    }

    const totalQuestions = lesson.test.questions.length;
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    return {
      lessonId,
      score,
      correctCount,
      totalQuestions,
      completedAt: new Date().toISOString(),
    };
  }

  async completeLesson(courseId: string, lessonId: string) {
    const progress = await this.request(`/courses/${courseId}/lessons/${lessonId}/complete`, {
      method: 'POST',
    });
    return { success: true, progress };
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

  logout() {
    this.setToken(null);
    this.saveUser(null);
  }
}

export const api = new API();


