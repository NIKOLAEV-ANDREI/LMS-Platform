package http

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"lms-backend/internal/domain"
	"lms-backend/internal/middleware"
	"lms-backend/internal/service"
)

type Handler struct {
	auth   *service.AuthService
	course *service.CourseService
	admin  *service.AdminService
}

func NewHandler(auth *service.AuthService, course *service.CourseService, admin *service.AdminService) *Handler {
	return &Handler{auth: auth, course: course, admin: admin}
}

func (h *Handler) RegisterRoutes(r chi.Router, jwtSecret string) {
	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api", func(api chi.Router) {
		api.Post("/auth/register", h.register)
		api.Post("/auth/login", h.login)

		api.Group(func(p chi.Router) {
			p.Use(middleware.Auth(jwtSecret))
			p.Get("/me", h.me)
			p.Patch("/me", h.updateMe)
			p.Get("/dashboard", h.dashboard)
			p.Get("/courses", h.listCourses)
			p.Get("/courses/search", h.searchCourses)
			p.Get("/courses/{courseID}", h.courseByID)
			p.Get("/teachers/{teacherID}/profile", h.teacherPublicProfile)
			p.Post("/courses/{courseID}/enroll", h.enroll)
			p.With(middleware.RequireRole(domain.RoleStudent)).Delete("/courses/{courseID}/enroll", h.unenroll)
			p.Patch("/courses/{courseID}/progress", h.updateProgress)
			p.With(middleware.RequireRole(domain.RoleStudent)).Get("/progress/{courseID}", h.getProgress)
			p.With(middleware.RequireRole(domain.RoleStudent)).Post("/courses/{courseID}/lessons/{lessonID}/complete", h.completeLesson)
			p.With(middleware.RequireRole(domain.RoleStudent)).Post("/courses/{courseID}/lessons/{lessonID}/test/start", h.startLessonTestAttempt)
			p.With(middleware.RequireRole(domain.RoleStudent)).Post("/courses/{courseID}/lessons/{lessonID}/test/submit", h.submitLessonTestAttempt)
			p.With(middleware.RequireRole(domain.RoleStudent)).Get("/courses/{courseID}/lessons/{lessonID}/test/attempts", h.myLessonTestAttempts)
			p.With(middleware.RequireRole(domain.RoleStudent)).Post("/courses/{courseID}/lessons/{lessonID}/submission", h.submitLessonForReview)
			p.With(middleware.RequireRole(domain.RoleStudent)).Get("/courses/{courseID}/submissions/me", h.myCourseSubmissions)

			p.With(middleware.RequireRole(domain.RoleTeacher)).Post("/teacher/courses", h.createCourse)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Get("/teacher/courses", h.teacherCourses)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Post("/teacher/courses/{courseID}/publish", h.publishCourse)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Post("/teacher/courses/{courseID}/unpublish", h.unpublishCourse)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Post("/teacher/courses/{courseID}/password", h.setCoursePassword)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Delete("/teacher/courses/{courseID}/password", h.clearCoursePassword)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Post("/teacher/courses/{courseID}/restore", h.restoreCourse)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Delete("/teacher/courses/{courseID}", h.deleteCourse)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Patch("/teacher/courses/{courseID}", h.updateCourseByTeacher)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Post("/teacher/courses/{courseID}/modules", h.addModule)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Patch("/teacher/courses/{courseID}/modules/{moduleID}", h.updateModule)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Delete("/teacher/courses/{courseID}/modules/{moduleID}", h.deleteModule)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Post("/teacher/courses/{courseID}/modules/{moduleID}/lessons", h.addLesson)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Patch("/teacher/courses/{courseID}/modules/{moduleID}/lessons/{lessonID}", h.updateLesson)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Delete("/teacher/courses/{courseID}/modules/{moduleID}/lessons/{lessonID}", h.deleteLesson)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Get("/teacher/courses/{courseID}/students", h.teacherCourseStudents)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Get("/teacher/courses/{courseID}/submissions", h.teacherCourseSubmissions)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Patch("/teacher/courses/{courseID}/submissions/{submissionID}", h.reviewLessonSubmission)
			p.With(middleware.RequireRole(domain.RoleTeacher)).Get("/teacher/courses/{courseID}/lessons/{lessonID}/test/analytics", h.teacherLessonTestAnalytics)

			p.With(middleware.RequireRole(domain.RoleAdmin)).Get("/admin/users", h.listUsers)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Post("/admin/users", h.createUserByAdmin)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Get("/admin/users/{id}", h.userDetails)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Patch("/admin/users/{id}", h.updateUserProfile)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Patch("/admin/users/{id}/restore", h.restoreUser)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Patch("/admin/users/{id}/block", h.blockUser)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Patch("/admin/users/{id}/role", h.changeRole)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Get("/admin/courses", h.listAllCourses)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Patch("/admin/courses/{id}/approve", h.approveCourse)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Patch("/admin/courses/{id}", h.updateCourseByAdmin)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Post("/admin/courses/{id}/publish", h.publishCourseByAdmin)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Post("/admin/courses/{id}/unpublish", h.unpublishCourseByAdmin)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Post("/admin/courses/{id}/password", h.setCoursePasswordByAdmin)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Delete("/admin/courses/{id}/password", h.clearCoursePasswordByAdmin)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Post("/admin/courses/{id}/restore", h.restoreCourseByAdmin)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Delete("/admin/courses/{id}", h.deleteCourseByAdmin)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Post("/admin/courses/{courseID}/modules", h.addModuleByAdmin)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Patch("/admin/courses/{courseID}/modules/{moduleID}", h.updateModuleByAdmin)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Delete("/admin/courses/{courseID}/modules/{moduleID}", h.deleteModuleByAdmin)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Post("/admin/courses/{courseID}/modules/{moduleID}/lessons", h.addLessonByAdmin)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Patch("/admin/courses/{courseID}/modules/{moduleID}/lessons/{lessonID}", h.updateLessonByAdmin)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Delete("/admin/courses/{courseID}/modules/{moduleID}/lessons/{lessonID}", h.deleteLessonByAdmin)
			p.With(middleware.RequireRole(domain.RoleAdmin)).Get("/admin/courses/{courseID}/lessons/{lessonID}/test/analytics", h.adminLessonTestAnalytics)
		})
	})
}

type registerReq struct {
	Name                  string      `json:"name"`
	Email                 string      `json:"email"`
	Password              string      `json:"password"`
	Role                  domain.Role `json:"role"`
	TeacherAccessPassword string      `json:"teacher_access_password"`
}

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	user, err := h.auth.Register(req.Name, req.Email, req.Password, req.Role, req.TeacherAccessPassword)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, user)
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	token, user, err := h.auth.Login(req.Email, req.Password)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": user})
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserIDFromContext(r.Context())
	user, err := h.admin.UserByID(uid)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if user == nil {
		writeErr(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (h *Handler) updateMe(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserIDFromContext(r.Context())
	var req struct {
		Name         string  `json:"name"`
		Email        string  `json:"email"`
		Password     string  `json:"password"`
		AvatarURL    *string `json:"avatar_url"`
		RemoveAvatar bool    `json:"remove_avatar"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if err := h.admin.UpdateUserProfile(uid, req.Name, req.Email, req.Password, req.AvatarURL, req.RemoveAvatar); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	user, err := h.admin.UserByID(uid)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (h *Handler) dashboard(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserIDFromContext(r.Context())
	role := middleware.RoleFromContext(r.Context())
	resp := map[string]any{"role": role}

	switch role {
	case domain.RoleStudent:
		courses, err := h.course.ListPublicCourses()
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		enrollments, err := h.course.StudentEnrollments(uid)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		resp["courses"] = courses
		resp["progress"] = enrollments
	case domain.RoleTeacher:
		courses, err := h.course.ListTeacherCourses(uid)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		resp["courses"] = courses
	case domain.RoleAdmin:
		users, err := h.admin.ListUsers()
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		courses, err := h.admin.AllCourses()
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		resp["users"] = users
		resp["courses"] = courses
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) createCourse(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserIDFromContext(r.Context())
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	course, err := h.course.CreateByTeacher(uid, req.Title, req.Description)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, course)
}

func (h *Handler) teacherCourses(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserIDFromContext(r.Context())
	courses, err := h.course.ListTeacherCourses(uid)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, courses)
}

func (h *Handler) publishCourse(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	if err := h.course.PublishByTeacher(teacherID, courseID); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "published"})
}

func (h *Handler) unpublishCourse(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	if err := h.course.UnpublishByTeacher(teacherID, courseID); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "unpublished"})
}

func (h *Handler) deleteCourse(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	if err := h.course.DeleteByTeacher(teacherID, courseID); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *Handler) restoreCourse(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	if err := h.course.RestoreByTeacher(teacherID, courseID); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "restored"})
}

func (h *Handler) updateCourseByTeacher(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	course, err := h.course.UpdateCourseByTeacher(teacherID, courseID, req.Title, req.Description)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, course)
}

func (h *Handler) listCourses(w http.ResponseWriter, _ *http.Request) {
	courses, err := h.course.ListPublicCourses()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, courses)
}

func (h *Handler) searchCourses(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("query"))
	searchBy := strings.TrimSpace(r.URL.Query().Get("by"))

	courses, err := h.course.SearchPublicCourses(query, searchBy)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, courses)
}

func (h *Handler) courseByID(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserIDFromContext(r.Context())
	role := middleware.RoleFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	course, err := h.course.CourseByID(courseID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if course == nil {
		writeErr(w, http.StatusNotFound, "course not found")
		return
	}
	if err := h.course.EnsureCourseAccess(uid, role, course, r.Header.Get("X-Course-Password")); err != nil {
		writeErr(w, http.StatusForbidden, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, course)
}

func (h *Handler) teacherPublicProfile(w http.ResponseWriter, r *http.Request) {
	teacherID, err := h.resolveUserID(r, "teacherID")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid user id")
		return
	}

	teacher, err := h.admin.UserByID(teacherID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if teacher == nil {
		writeErr(w, http.StatusNotFound, "user not found")
		return
	}
	if teacher.Role != domain.RoleTeacher {
		writeErr(w, http.StatusBadRequest, "invalid role")
		return
	}

	courses, err := h.course.ListTeacherPublishedCourses(teacherID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"teacher": map[string]any{
			"id":         teacher.ID,
			"public_id":  teacher.PublicID,
			"name":       teacher.Name,
			"email":      teacher.Email,
			"avatar_url": teacher.AvatarURL,
		},
		"courses": courses,
	})
}

func (h *Handler) enroll(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserIDFromContext(r.Context())
	role := middleware.RoleFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	var req struct {
		AccessPassword string `json:"access_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err != io.EOF {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	course, err := h.course.CourseByID(courseID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if course == nil {
		writeErr(w, http.StatusNotFound, "course not found")
		return
	}
	if err := h.course.EnsureCourseAccess(uid, role, course, req.AccessPassword); err != nil {
		writeErr(w, http.StatusForbidden, err.Error())
		return
	}
	if err := h.course.Enroll(uid, courseID); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "enrolled"})
}

func (h *Handler) unenroll(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	if err := h.course.Unenroll(uid, courseID); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "unenrolled"})
}

func (h *Handler) updateProgress(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	var req struct {
		Progress int `json:"progress"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if err := h.course.UpdateProgress(uid, courseID, req.Progress); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) getProgress(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	progress, err := h.course.GetCourseProgress(uid, courseID)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, progress)
}

func (h *Handler) completeLesson(w http.ResponseWriter, r *http.Request) {
	uid := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	lessonID, err := strconv.ParseInt(chi.URLParam(r, "lessonID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid lesson id")
		return
	}
	progress, err := h.course.CompleteLesson(uid, courseID, lessonID)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, progress)
}

func (h *Handler) startLessonTestAttempt(w http.ResponseWriter, r *http.Request) {
	studentID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	lessonID, err := strconv.ParseInt(chi.URLParam(r, "lessonID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid lesson id")
		return
	}
	var req struct {
		ForceExtraAttempt bool `json:"forceExtraAttempt"`
	}
	if r.Body != nil {
		defer r.Body.Close()
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err != io.EOF {
			writeErr(w, http.StatusBadRequest, "invalid json")
			return
		}
	}

	attempt, err := h.course.StartLessonTestAttempt(studentID, courseID, lessonID, req.ForceExtraAttempt)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, attempt)
}

func (h *Handler) submitLessonTestAttempt(w http.ResponseWriter, r *http.Request) {
	studentID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	lessonID, err := strconv.ParseInt(chi.URLParam(r, "lessonID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid lesson id")
		return
	}
	var req struct {
		AttemptID int64                     `json:"attemptId"`
		Answers   []domain.LessonTestAnswer `json:"answers"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.AttemptID <= 0 {
		writeErr(w, http.StatusBadRequest, "invalid test attempt id")
		return
	}

	result, progress, err := h.course.SubmitLessonTestAttempt(studentID, courseID, lessonID, req.AttemptID, req.Answers)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	resp := map[string]any{"result": result}
	if progress != nil {
		resp["progress"] = progress
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) myLessonTestAttempts(w http.ResponseWriter, r *http.Request) {
	studentID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	lessonID, err := strconv.ParseInt(chi.URLParam(r, "lessonID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid lesson id")
		return
	}
	attempts, err := h.course.StudentLessonTestAttempts(studentID, courseID, lessonID)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, attempts)
}

func (h *Handler) submitLessonForReview(w http.ResponseWriter, r *http.Request) {
	studentID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	lessonID, err := strconv.ParseInt(chi.URLParam(r, "lessonID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid lesson id")
		return
	}
	var req struct {
		FileName    string `json:"file_name"`
		FileURL     string `json:"file_url"`
		StudentNote string `json:"student_note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}

	submission, err := h.course.SubmitLessonForReview(studentID, courseID, lessonID, req.FileName, req.FileURL, req.StudentNote)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, submission)
}

func (h *Handler) myCourseSubmissions(w http.ResponseWriter, r *http.Request) {
	studentID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}

	submissions, err := h.course.StudentCourseSubmissions(studentID, courseID)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, submissions)
}

func (h *Handler) teacherCourseSubmissions(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	status := r.URL.Query().Get("status")

	submissions, err := h.course.TeacherCourseSubmissions(teacherID, courseID, status)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, submissions)
}

func (h *Handler) reviewLessonSubmission(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	submissionID, err := strconv.ParseInt(chi.URLParam(r, "submissionID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid submission id")
		return
	}
	var req struct {
		Action     string `json:"action"`
		ReviewNote string `json:"review_note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}

	action := strings.TrimSpace(strings.ToLower(req.Action))
	if action != "approve" && action != "reject" {
		writeErr(w, http.StatusBadRequest, "invalid review action")
		return
	}
	if action == "reject" && strings.TrimSpace(req.ReviewNote) == "" {
		writeErr(w, http.StatusBadRequest, "review note is required for rejection")
		return
	}

	submission, progress, err := h.course.ReviewLessonSubmissionByTeacher(teacherID, courseID, submissionID, action == "approve", req.ReviewNote)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}

	resp := map[string]any{"submission": submission}
	if progress != nil {
		resp["progress"] = progress
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) teacherLessonTestAnalytics(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	lessonID, err := strconv.ParseInt(chi.URLParam(r, "lessonID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid lesson id")
		return
	}

	analytics, attempts, err := h.course.TeacherLessonTestAnalytics(teacherID, courseID, lessonID)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"analytics": analytics,
		"attempts":  attempts,
	})
}

func (h *Handler) adminLessonTestAnalytics(w http.ResponseWriter, r *http.Request) {
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	lessonID, err := strconv.ParseInt(chi.URLParam(r, "lessonID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid lesson id")
		return
	}

	analytics, attempts, err := h.course.AdminLessonTestAnalytics(courseID, lessonID)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"analytics": analytics,
		"attempts":  attempts,
	})
}

func (h *Handler) listUsers(w http.ResponseWriter, _ *http.Request) {
	users, err := h.admin.ListUsers()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func (h *Handler) createUserByAdmin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name     string      `json:"name"`
		Email    string      `json:"email"`
		Password string      `json:"password"`
		Role     domain.Role `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}

	user, err := h.admin.CreateUser(req.Name, req.Email, req.Password, req.Role)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, user)
}

func (h *Handler) userDetails(w http.ResponseWriter, r *http.Request) {
	id, err := h.resolveUserID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid user id")
		return
	}
	user, err := h.admin.UserByID(id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if user == nil {
		writeErr(w, http.StatusNotFound, "user not found")
		return
	}

	resp := map[string]any{"user": user}
	if user.Role == domain.RoleTeacher {
		courses, err := h.course.ListTeacherCourses(user.ID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		deletedCourses, err := h.course.ListTeacherDeletedCourses(user.ID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		resp["courses"] = courses
		resp["deleted_courses"] = deletedCourses
	}
	if user.Role == domain.RoleStudent {
		progress, err := h.course.StudentEnrollments(user.ID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		resp["progress"] = progress
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) updateUserProfile(w http.ResponseWriter, r *http.Request) {
	id, err := h.resolveUserID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid user id")
		return
	}
	var req struct {
		Name         string  `json:"name"`
		Email        string  `json:"email"`
		Password     string  `json:"password"`
		AvatarURL    *string `json:"avatar_url"`
		RemoveAvatar bool    `json:"remove_avatar"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if err := h.admin.UpdateUserProfile(id, req.Name, req.Email, req.Password, req.AvatarURL, req.RemoveAvatar); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	user, err := h.admin.UserByID(id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (h *Handler) restoreUser(w http.ResponseWriter, r *http.Request) {
	id, err := h.resolveUserID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid user id")
		return
	}
	if err := h.admin.BlockUser(id, false); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "restored"})
}

func (h *Handler) blockUser(w http.ResponseWriter, r *http.Request) {
	id, err := h.resolveUserID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid user id")
		return
	}
	var req struct {
		Blocked bool `json:"blocked"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if err := h.admin.BlockUser(id, req.Blocked); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) changeRole(w http.ResponseWriter, r *http.Request) {
	id, err := h.resolveUserID(r, "id")
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid user id")
		return
	}
	currentUserID := middleware.UserIDFromContext(r.Context())
	if id == currentUserID {
		writeErr(w, http.StatusForbidden, "cannot change own role")
		return
	}
	var req struct {
		Role domain.Role `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if err := h.admin.SetRole(id, req.Role); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) listAllCourses(w http.ResponseWriter, _ *http.Request) {
	courses, err := h.admin.AllCourses()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, courses)
}

func (h *Handler) approveCourse(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	if err := h.admin.ApproveCourse(id); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "approved"})
}

func (h *Handler) updateCourseByAdmin(w http.ResponseWriter, r *http.Request) {
	courseID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	course, err := h.course.UpdateCourseByAdmin(courseID, req.Title, req.Description)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, course)
}

func (h *Handler) publishCourseByAdmin(w http.ResponseWriter, r *http.Request) {
	courseID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	if err := h.course.PublishByAdmin(courseID); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "published"})
}

func (h *Handler) unpublishCourseByAdmin(w http.ResponseWriter, r *http.Request) {
	courseID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	if err := h.course.UnpublishByAdmin(courseID); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "unpublished"})
}

func (h *Handler) setCoursePassword(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if err := h.course.SetCoursePasswordByTeacher(teacherID, courseID, req.Password); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "password_set"})
}

func (h *Handler) clearCoursePassword(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	if err := h.course.ClearCoursePasswordByTeacher(teacherID, courseID); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "password_cleared"})
}

func (h *Handler) setCoursePasswordByAdmin(w http.ResponseWriter, r *http.Request) {
	courseID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	var req struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	if err := h.course.SetCoursePasswordByAdmin(courseID, req.Password); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "password_set"})
}

func (h *Handler) clearCoursePasswordByAdmin(w http.ResponseWriter, r *http.Request) {
	courseID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	if err := h.course.ClearCoursePasswordByAdmin(courseID); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "password_cleared"})
}

func (h *Handler) restoreCourseByAdmin(w http.ResponseWriter, r *http.Request) {
	courseID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	if err := h.course.RestoreByAdmin(courseID); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "restored"})
}

func (h *Handler) deleteCourseByAdmin(w http.ResponseWriter, r *http.Request) {
	courseID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	if err := h.course.DeleteByAdmin(courseID); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *Handler) addModule(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}

	module, err := h.course.AddModuleByTeacher(teacherID, courseID, req.Title, req.Description)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, module)
}

func (h *Handler) addLesson(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	moduleID, err := strconv.ParseInt(chi.URLParam(r, "moduleID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid module id")
		return
	}
	var req struct {
		Title          string                    `json:"title"`
		Content        string                    `json:"content"`
		Type           string                    `json:"type"`
		VideoURL       string                    `json:"videoUrl"`
		RequiresReview bool                      `json:"requiresReview"`
		Attachments    []domain.LessonAttachment `json:"attachments"`
		Test           *domain.LessonTest        `json:"test"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}

	lesson, err := h.course.AddLessonByTeacher(teacherID, courseID, moduleID, req.Title, req.Content, req.Type, req.VideoURL, req.RequiresReview, req.Attachments, req.Test)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, lesson)
}

func (h *Handler) updateModule(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	moduleID, err := strconv.ParseInt(chi.URLParam(r, "moduleID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid module id")
		return
	}
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}

	module, err := h.course.UpdateModuleByTeacher(teacherID, courseID, moduleID, req.Title, req.Description)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, module)
}

func (h *Handler) deleteModule(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	moduleID, err := strconv.ParseInt(chi.URLParam(r, "moduleID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid module id")
		return
	}
	if err := h.course.DeleteModuleByTeacher(teacherID, courseID, moduleID); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *Handler) updateLesson(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	moduleID, err := strconv.ParseInt(chi.URLParam(r, "moduleID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid module id")
		return
	}
	lessonID, err := strconv.ParseInt(chi.URLParam(r, "lessonID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid lesson id")
		return
	}
	var req struct {
		Title          string                    `json:"title"`
		Content        string                    `json:"content"`
		Type           string                    `json:"type"`
		VideoURL       string                    `json:"videoUrl"`
		RequiresReview bool                      `json:"requiresReview"`
		Attachments    []domain.LessonAttachment `json:"attachments"`
		Test           *domain.LessonTest        `json:"test"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}

	lesson, err := h.course.UpdateLessonByTeacher(teacherID, courseID, moduleID, lessonID, req.Title, req.Content, req.Type, req.VideoURL, req.RequiresReview, req.Attachments, req.Test)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, lesson)
}

func (h *Handler) deleteLesson(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	moduleID, err := strconv.ParseInt(chi.URLParam(r, "moduleID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid module id")
		return
	}
	lessonID, err := strconv.ParseInt(chi.URLParam(r, "lessonID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid lesson id")
		return
	}
	if err := h.course.DeleteLessonByTeacher(teacherID, courseID, moduleID, lessonID); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *Handler) teacherCourseStudents(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.UserIDFromContext(r.Context())
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}

	students, err := h.course.ListCourseStudentsByTeacher(teacherID, courseID)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, students)
}

func (h *Handler) addModuleByAdmin(w http.ResponseWriter, r *http.Request) {
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	module, err := h.course.AddModuleByAdmin(courseID, req.Title, req.Description)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, module)
}

func (h *Handler) updateModuleByAdmin(w http.ResponseWriter, r *http.Request) {
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	moduleID, err := strconv.ParseInt(chi.URLParam(r, "moduleID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid module id")
		return
	}
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	module, err := h.course.UpdateModuleByAdmin(courseID, moduleID, req.Title, req.Description)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, module)
}

func (h *Handler) deleteModuleByAdmin(w http.ResponseWriter, r *http.Request) {
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	moduleID, err := strconv.ParseInt(chi.URLParam(r, "moduleID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid module id")
		return
	}
	if err := h.course.DeleteModuleByAdmin(courseID, moduleID); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *Handler) addLessonByAdmin(w http.ResponseWriter, r *http.Request) {
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	moduleID, err := strconv.ParseInt(chi.URLParam(r, "moduleID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid module id")
		return
	}
	var req struct {
		Title          string                    `json:"title"`
		Content        string                    `json:"content"`
		Type           string                    `json:"type"`
		VideoURL       string                    `json:"videoUrl"`
		RequiresReview bool                      `json:"requiresReview"`
		Attachments    []domain.LessonAttachment `json:"attachments"`
		Test           *domain.LessonTest        `json:"test"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	lesson, err := h.course.AddLessonByAdmin(courseID, moduleID, req.Title, req.Content, req.Type, req.VideoURL, req.RequiresReview, req.Attachments, req.Test)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, lesson)
}

func (h *Handler) updateLessonByAdmin(w http.ResponseWriter, r *http.Request) {
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	moduleID, err := strconv.ParseInt(chi.URLParam(r, "moduleID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid module id")
		return
	}
	lessonID, err := strconv.ParseInt(chi.URLParam(r, "lessonID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid lesson id")
		return
	}
	var req struct {
		Title          string                    `json:"title"`
		Content        string                    `json:"content"`
		Type           string                    `json:"type"`
		VideoURL       string                    `json:"videoUrl"`
		RequiresReview bool                      `json:"requiresReview"`
		Attachments    []domain.LessonAttachment `json:"attachments"`
		Test           *domain.LessonTest        `json:"test"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid json")
		return
	}
	lesson, err := h.course.UpdateLessonByAdmin(courseID, moduleID, lessonID, req.Title, req.Content, req.Type, req.VideoURL, req.RequiresReview, req.Attachments, req.Test)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, lesson)
}

func (h *Handler) deleteLessonByAdmin(w http.ResponseWriter, r *http.Request) {
	courseID, err := strconv.ParseInt(chi.URLParam(r, "courseID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid course id")
		return
	}
	moduleID, err := strconv.ParseInt(chi.URLParam(r, "moduleID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid module id")
		return
	}
	lessonID, err := strconv.ParseInt(chi.URLParam(r, "lessonID"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid lesson id")
		return
	}
	if err := h.course.DeleteLessonByAdmin(courseID, moduleID, lessonID); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *Handler) resolveUserID(r *http.Request, param string) (int64, error) {
	raw := strings.TrimSpace(chi.URLParam(r, param))
	if raw == "" {
		return 0, strconv.ErrSyntax
	}
	if id, err := strconv.ParseInt(raw, 10, 64); err == nil {
		return id, nil
	}
	user, err := h.admin.UserByPublicID(raw)
	if err != nil {
		return 0, err
	}
	if user == nil {
		return 0, strconv.ErrSyntax
	}
	return user.ID, nil
}

func writeJSON(w http.ResponseWriter, code int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}
