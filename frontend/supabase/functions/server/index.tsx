import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as crypto from "node:crypto";

const app = new Hono();

const supabase = createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-eebefe55/health", (c) => {
  return c.json({ status: "ok" });
});

// Helper: Generate unique ID
const generateId = () => crypto.randomUUID();

// Helper: Hash password (simple for demo)
const hashPassword = (password: string) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// Helper: Verify user authorization
const verifyAuth = async (authHeader: string | null) => {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const accessToken = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    return null;
  }
  const userData = await kv.get(`user:${user.id}`);
  return userData;
};

// AUTHENTICATION ENDPOINTS

// Sign up
app.post("/make-server-eebefe55/auth/signup", async (c) => {
  try {
    const { email, password, name, role } = await c.req.json();

    if (!email || !password || !name || !role) {
      return c.json({ error: "All fields are required" }, 400);
    }

    if (!['student', 'teacher'].includes(role)) {
      return c.json({ error: "Invalid role. Must be 'student' or 'teacher'" }, 400);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role },
      email_confirm: true
    });

    if (error) {
      console.log('Signup error:', error);
      return c.json({ error: error.message }, 400);
    }

    const userId = data.user.id;
    await kv.set(`user:${userId}`, {
      id: userId,
      email,
      name,
      role,
      createdAt: new Date().toISOString(),
      enrolledCourses: [],
      createdCourses: [],
    });

    return c.json({ success: true, userId, role });
  } catch (error) {
    console.log('Signup error:', error);
    return c.json({ error: "Signup failed: " + error.message }, 500);
  }
});

// Sign in
app.post("/make-server-eebefe55/auth/signin", async (c) => {
  try {
    const { email, password } = await c.req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_ANON_KEY"),
    );

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log('Signin error:', error);
      return c.json({ error: error.message }, 401);
    }

    const userId = data.user.id;
    const userData = await kv.get(`user:${userId}`);

    return c.json({
      success: true,
      accessToken: data.session.access_token,
      user: userData,
    });
  } catch (error) {
    console.log('Signin error:', error);
    return c.json({ error: "Signin failed: " + error.message }, 500);
  }
});

// Get current session
app.get("/make-server-eebefe55/auth/session", async (c) => {
  try {
    const user = await verifyAuth(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    return c.json({ user });
  } catch (error) {
    console.log('Session error:', error);
    return c.json({ error: "Session check failed: " + error.message }, 500);
  }
});

// COURSE ENDPOINTS

// Create course (teacher only)
app.post("/make-server-eebefe55/courses", async (c) => {
  try {
    const user = await verifyAuth(c.req.header('Authorization'));
    if (!user || user.role !== 'teacher') {
      return c.json({ error: "Unauthorized. Only teachers can create courses" }, 403);
    }

    const { title, description, imageUrl } = await c.req.json();
    const courseId = generateId();

    const course = {
      id: courseId,
      title,
      description,
      imageUrl: imageUrl || '',
      teacherId: user.id,
      teacherName: user.name,
      createdAt: new Date().toISOString(),
      modules: [],
      enrolledStudents: [],
    };

    await kv.set(`course:${courseId}`, course);

    user.createdCourses.push(courseId);
    await kv.set(`user:${user.id}`, user);

    return c.json({ success: true, course });
  } catch (error) {
    console.log('Create course error:', error);
    return c.json({ error: "Failed to create course: " + error.message }, 500);
  }
});

// Get all courses
app.get("/make-server-eebefe55/courses", async (c) => {
  try {
    const courses = await kv.getByPrefix('course:');
    return c.json({ courses: courses || [] });
  } catch (error) {
    console.log('Get courses error:', error);
    return c.json({ error: "Failed to get courses: " + error.message }, 500);
  }
});

// Get course by ID
app.get("/make-server-eebefe55/courses/:id", async (c) => {
  try {
    const courseId = c.req.param('id');
    const course = await kv.get(`course:${courseId}`);

    if (!course) {
      return c.json({ error: "Course not found" }, 404);
    }

    return c.json({ course });
  } catch (error) {
    console.log('Get course error:', error);
    return c.json({ error: "Failed to get course: " + error.message }, 500);
  }
});

// Update course (teacher only, own courses)
app.put("/make-server-eebefe55/courses/:id", async (c) => {
  try {
    const user = await verifyAuth(c.req.header('Authorization'));
    if (!user || user.role !== 'teacher') {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const courseId = c.req.param('id');
    const course = await kv.get(`course:${courseId}`);

    if (!course || course.teacherId !== user.id) {
      return c.json({ error: "Course not found or unauthorized" }, 404);
    }

    const updates = await c.req.json();
    const updatedCourse = { ...course, ...updates };

    await kv.set(`course:${courseId}`, updatedCourse);

    return c.json({ success: true, course: updatedCourse });
  } catch (error) {
    console.log('Update course error:', error);
    return c.json({ error: "Failed to update course: " + error.message }, 500);
  }
});

// Enroll in course (student only)
app.post("/make-server-eebefe55/courses/:id/enroll", async (c) => {
  try {
    const user = await verifyAuth(c.req.header('Authorization'));
    if (!user || user.role !== 'student') {
      return c.json({ error: "Unauthorized. Only students can enroll" }, 403);
    }

    const courseId = c.req.param('id');
    const course = await kv.get(`course:${courseId}`);

    if (!course) {
      return c.json({ error: "Course not found" }, 404);
    }

    if (!course.enrolledStudents.includes(user.id)) {
      course.enrolledStudents.push(user.id);
      await kv.set(`course:${courseId}`, course);
    }

    if (!user.enrolledCourses.includes(courseId)) {
      user.enrolledCourses.push(courseId);
      await kv.set(`user:${user.id}`, user);
    }

    await kv.set(`progress:${user.id}:${courseId}`, {
      userId: user.id,
      courseId,
      completedLessons: [],
      testResults: [],
      progress: 0,
      enrolledAt: new Date().toISOString(),
    });

    return c.json({ success: true });
  } catch (error) {
    console.log('Enroll error:', error);
    return c.json({ error: "Failed to enroll: " + error.message }, 500);
  }
});

// Add module to course (teacher only)
app.post("/make-server-eebefe55/courses/:id/modules", async (c) => {
  try {
    const user = await verifyAuth(c.req.header('Authorization'));
    if (!user || user.role !== 'teacher') {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const courseId = c.req.param('id');
    const course = await kv.get(`course:${courseId}`);

    if (!course || course.teacherId !== user.id) {
      return c.json({ error: "Course not found or unauthorized" }, 404);
    }

    const { title, description } = await c.req.json();
    const moduleId = generateId();

    const module = {
      id: moduleId,
      title,
      description,
      lessons: [],
      order: course.modules.length,
    };

    course.modules.push(module);
    await kv.set(`course:${courseId}`, course);

    return c.json({ success: true, module });
  } catch (error) {
    console.log('Add module error:', error);
    return c.json({ error: "Failed to add module: " + error.message }, 500);
  }
});

// Add lesson to module (teacher only)
app.post("/make-server-eebefe55/courses/:courseId/modules/:moduleId/lessons", async (c) => {
  try {
    const user = await verifyAuth(c.req.header('Authorization'));
    if (!user || user.role !== 'teacher') {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const courseId = c.req.param('courseId');
    const moduleId = c.req.param('moduleId');
    const course = await kv.get(`course:${courseId}`);

    if (!course || course.teacherId !== user.id) {
      return c.json({ error: "Course not found or unauthorized" }, 404);
    }

    const moduleIndex = course.modules.findIndex((m: any) => m.id === moduleId);
    if (moduleIndex === -1) {
      return c.json({ error: "Module not found" }, 404);
    }

    const { title, content, type, videoUrl, test } = await c.req.json();
    const lessonId = generateId();

    const lesson = {
      id: lessonId,
      title,
      content: content || '',
      type: type || 'text',
      videoUrl: videoUrl || '',
      test: test || null,
      order: course.modules[moduleIndex].lessons.length,
    };

    course.modules[moduleIndex].lessons.push(lesson);
    await kv.set(`course:${courseId}`, course);

    return c.json({ success: true, lesson });
  } catch (error) {
    console.log('Add lesson error:', error);
    return c.json({ error: "Failed to add lesson: " + error.message }, 500);
  }
});

// Submit test answers
app.post("/make-server-eebefe55/progress/:courseId/lessons/:lessonId/test", async (c) => {
  try {
    const user = await verifyAuth(c.req.header('Authorization'));
    if (!user || user.role !== 'student') {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const courseId = c.req.param('courseId');
    const lessonId = c.req.param('lessonId');
    const { answers } = await c.req.json();

    const course = await kv.get(`course:${courseId}`);
    if (!course) {
      return c.json({ error: "Course not found" }, 404);
    }

    let lesson = null;
    for (const module of course.modules) {
      lesson = module.lessons.find((l: any) => l.id === lessonId);
      if (lesson) break;
    }

    if (!lesson || !lesson.test) {
      return c.json({ error: "Lesson or test not found" }, 404);
    }

    let correctCount = 0;
    const totalQuestions = lesson.test.questions.length;

    lesson.test.questions.forEach((q: any, index: number) => {
      const userAnswer = answers[index];
      if (q.type === 'single' && userAnswer === q.correctAnswer) {
        correctCount++;
      } else if (q.type === 'multiple') {
        const correct = JSON.stringify(userAnswer?.sort()) === JSON.stringify(q.correctAnswers?.sort());
        if (correct) correctCount++;
      }
    });

    const score = Math.round((correctCount / totalQuestions) * 100);

    const progressKey = `progress:${user.id}:${courseId}`;
    const progress = await kv.get(progressKey) || {
      userId: user.id,
      courseId,
      completedLessons: [],
      testResults: [],
      progress: 0,
    };

    if (!progress.completedLessons.includes(lessonId)) {
      progress.completedLessons.push(lessonId);
    }

    progress.testResults.push({
      lessonId,
      score,
      completedAt: new Date().toISOString(),
    });

    const totalLessons = course.modules.reduce((sum: number, m: any) => sum + m.lessons.length, 0);
    progress.progress = Math.round((progress.completedLessons.length / totalLessons) * 100);

    await kv.set(progressKey, progress);

    return c.json({ success: true, score, correctCount, totalQuestions });
  } catch (error) {
    console.log('Submit test error:', error);
    return c.json({ error: "Failed to submit test: " + error.message }, 500);
  }
});

// Mark lesson as completed
app.post("/make-server-eebefe55/progress/:courseId/lessons/:lessonId/complete", async (c) => {
  try {
    const user = await verifyAuth(c.req.header('Authorization'));
    if (!user || user.role !== 'student') {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const courseId = c.req.param('courseId');
    const lessonId = c.req.param('lessonId');

    const course = await kv.get(`course:${courseId}`);
    if (!course) {
      return c.json({ error: "Course not found" }, 404);
    }

    const progressKey = `progress:${user.id}:${courseId}`;
    const progress = await kv.get(progressKey) || {
      userId: user.id,
      courseId,
      completedLessons: [],
      testResults: [],
      progress: 0,
    };

    if (!progress.completedLessons.includes(lessonId)) {
      progress.completedLessons.push(lessonId);
    }

    const totalLessons = course.modules.reduce((sum: number, m: any) => sum + m.lessons.length, 0);
    progress.progress = Math.round((progress.completedLessons.length / totalLessons) * 100);

    await kv.set(progressKey, progress);

    return c.json({ success: true, progress: progress.progress });
  } catch (error) {
    console.log('Complete lesson error:', error);
    return c.json({ error: "Failed to complete lesson: " + error.message }, 500);
  }
});

// Get student progress
app.get("/make-server-eebefe55/progress/:courseId", async (c) => {
  try {
    const user = await verifyAuth(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const courseId = c.req.param('courseId');
    const progressKey = `progress:${user.id}:${courseId}`;
    const progress = await kv.get(progressKey);

    return c.json({ progress: progress || null });
  } catch (error) {
    console.log('Get progress error:', error);
    return c.json({ error: "Failed to get progress: " + error.message }, 500);
  }
});

// Get all students progress for a course (teacher only)
app.get("/make-server-eebefe55/courses/:id/students-progress", async (c) => {
  try {
    const user = await verifyAuth(c.req.header('Authorization'));
    if (!user || user.role !== 'teacher') {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const courseId = c.req.param('id');
    const course = await kv.get(`course:${courseId}`);

    if (!course || course.teacherId !== user.id) {
      return c.json({ error: "Course not found or unauthorized" }, 404);
    }

    const studentsProgress = [];
    for (const studentId of course.enrolledStudents) {
      const studentData = await kv.get(`user:${studentId}`);
      const progress = await kv.get(`progress:${studentId}:${courseId}`);

      if (studentData && progress) {
        studentsProgress.push({
          student: studentData,
          progress,
        });
      }
    }

    return c.json({ studentsProgress });
  } catch (error) {
    console.log('Get students progress error:', error);
    return c.json({ error: "Failed to get students progress: " + error.message }, 500);
  }
});

// ADMIN ENDPOINTS

// Get all users (admin only)
app.get("/make-server-eebefe55/admin/users", async (c) => {
  try {
    const user = await verifyAuth(c.req.header('Authorization'));
    if (!user || user.role !== 'admin') {
      return c.json({ error: "Unauthorized. Admin access required" }, 403);
    }

    const users = await kv.getByPrefix('user:');
    return c.json({ users: users || [] });
  } catch (error) {
    console.log('Get users error:', error);
    return c.json({ error: "Failed to get users: " + error.message }, 500);
  }
});

// Update user role (admin only)
app.put("/make-server-eebefe55/admin/users/:id/role", async (c) => {
  try {
    const user = await verifyAuth(c.req.header('Authorization'));
    if (!user || user.role !== 'admin') {
      return c.json({ error: "Unauthorized. Admin access required" }, 403);
    }

    const userId = c.req.param('id');
    const { role } = await c.req.json();

    if (!['student', 'teacher', 'admin'].includes(role)) {
      return c.json({ error: "Invalid role" }, 400);
    }

    const targetUser = await kv.get(`user:${userId}`);
    if (!targetUser) {
      return c.json({ error: "User not found" }, 404);
    }

    targetUser.role = role;
    await kv.set(`user:${userId}`, targetUser);

    return c.json({ success: true, user: targetUser });
  } catch (error) {
    console.log('Update user role error:', error);
    return c.json({ error: "Failed to update user role: " + error.message }, 500);
  }
});

// Delete user (admin only)
app.delete("/make-server-eebefe55/admin/users/:id", async (c) => {
  try {
    const user = await verifyAuth(c.req.header('Authorization'));
    if (!user || user.role !== 'admin') {
      return c.json({ error: "Unauthorized. Admin access required" }, 403);
    }

    const userId = c.req.param('id');
    await kv.del(`user:${userId}`);

    return c.json({ success: true });
  } catch (error) {
    console.log('Delete user error:', error);
    return c.json({ error: "Failed to delete user: " + error.message }, 500);
  }
});

Deno.serve(app.fetch);