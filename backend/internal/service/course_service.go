package service

import (
	"errors"
	"math/rand"
	"sort"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"lms-backend/internal/domain"
	"lms-backend/internal/repository"
)

type CourseService struct {
	courses     repository.CourseRepository
	enrollments repository.EnrollmentRepository
}

func NewCourseService(courses repository.CourseRepository, enrollments repository.EnrollmentRepository) *CourseService {
	return &CourseService{courses: courses, enrollments: enrollments}
}

func (s *CourseService) CreateByTeacher(teacherID int64, title, description string) (*domain.Course, error) {
	title = strings.TrimSpace(title)
	description = strings.TrimSpace(description)
	if err := validateCoursePayload(title, description); err != nil {
		return nil, err
	}
	publicID, err := generatePublicID()
	if err != nil {
		return nil, err
	}
	course := &domain.Course{
		PublicID:    publicID,
		Title:       title,
		Description: description,
		TeacherID:   teacherID,
		Status:      "pending",
	}
	if err := s.courses.Create(course); err != nil {
		return nil, err
	}
	return course, nil
}

func (s *CourseService) ListPublicCourses() ([]domain.Course, error) {
	return s.courses.ListApproved()
}

func (s *CourseService) SearchPublicCourses(query, searchBy string) ([]domain.Course, error) {
	searchBy = strings.TrimSpace(strings.ToLower(searchBy))
	switch searchBy {
	case "", "all", "id", "title", "teacher":
	default:
		return nil, errors.New("invalid search filter")
	}
	return s.courses.SearchApproved(query, searchBy)
}

func (s *CourseService) CourseByID(courseID int64) (*domain.Course, error) {
	return s.courses.ByID(courseID)
}

func (s *CourseService) ListTeacherCourses(teacherID int64) ([]domain.Course, error) {
	return s.courses.ListByTeacher(teacherID)
}

func (s *CourseService) ListTeacherDeletedCourses(teacherID int64) ([]domain.Course, error) {
	return s.courses.ListDeletedByTeacher(teacherID)
}

func (s *CourseService) ListTeacherPublishedCourses(teacherID int64) ([]domain.Course, error) {
	courses, err := s.courses.ListByTeacher(teacherID)
	if err != nil {
		return nil, err
	}

	published := make([]domain.Course, 0, len(courses))
	for _, course := range courses {
		if course.Status == "approved" {
			published = append(published, course)
		}
	}

	return published, nil
}

func (s *CourseService) EnsureCourseAccess(userID int64, role domain.Role, course *domain.Course, password string) error {
	if course == nil {
		return errors.New("course not found")
	}
	if course.AccessPasswordHash == "" {
		return nil
	}
	if role == domain.RoleAdmin {
		return nil
	}
	if role == domain.RoleTeacher && course.TeacherID == userID {
		return nil
	}
	if role == domain.RoleStudent {
		enrollments, err := s.enrollments.ListByStudent(userID)
		if err != nil {
			return err
		}
		for _, enrollment := range enrollments {
			if enrollment.CourseID == course.ID {
				return nil
			}
		}
	}

	password = strings.TrimSpace(password)
	if password == "" {
		return errors.New("course password required")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(course.AccessPasswordHash), []byte(password)); err != nil {
		return errors.New("invalid course password")
	}
	return nil
}

func (s *CourseService) Enroll(studentID, courseID int64) error {
	return s.enrollments.Enroll(studentID, courseID)
}

func (s *CourseService) Unenroll(studentID, courseID int64) error {
	return s.enrollments.Unenroll(studentID, courseID)
}

func (s *CourseService) UpdateProgress(studentID, courseID int64, progress int) error {
	if progress < 0 || progress > 100 {
		return errors.New("progress must be 0..100")
	}
	return s.enrollments.SetProgress(studentID, courseID, progress)
}

func (s *CourseService) StudentEnrollments(studentID int64) ([]domain.Enrollment, error) {
	return s.enrollments.ListByStudent(studentID)
}

func (s *CourseService) ListCourseStudentsByTeacher(teacherID, courseID int64) ([]domain.User, error) {
	return s.enrollments.ListCourseStudentsByTeacher(teacherID, courseID)
}

func (s *CourseService) CompleteLesson(studentID, courseID, lessonID int64) (*domain.CourseProgress, error) {
	return s.enrollments.CompleteLesson(studentID, courseID, lessonID)
}

func (s *CourseService) GetCourseProgress(studentID, courseID int64) (*domain.CourseProgress, error) {
	return s.enrollments.GetCourseProgress(studentID, courseID)
}

func (s *CourseService) StartLessonTestAttempt(studentID, courseID, lessonID int64) (*domain.LessonTestAttemptStart, error) {
	course, lesson, err := s.getCourseLesson(courseID, lessonID)
	if err != nil {
		return nil, err
	}
	if lesson.Type != "test" || lesson.Test == nil {
		return nil, errors.New("lesson is not a test")
	}

	enrollments, err := s.enrollments.ListByStudent(studentID)
	if err != nil {
		return nil, err
	}
	isEnrolled := false
	for _, enrollment := range enrollments {
		if enrollment.CourseID == courseID {
			isEnrolled = true
			break
		}
	}
	if !isEnrolled {
		return nil, errors.New("student is not enrolled in this course")
	}

	settings := normalizeTestSettings(lesson.Test.Settings, len(lesson.Test.Questions))
	if !settings.AllowRetakeAfterPass {
		attemptHistory, err := s.enrollments.ListStudentLessonTestAttempts(studentID, courseID, lessonID)
		if err != nil {
			return nil, err
		}
		for _, attempt := range attemptHistory {
			if attempt.Passed {
				return nil, errors.New("test already passed")
			}
		}
	}
	attemptsUsed, err := s.enrollments.CountStudentLessonTestAttempts(studentID, lessonID)
	if err != nil {
		return nil, err
	}
	effectiveMaxAttempts := settings.MaxAttempts
	if attemptsUsed >= settings.MaxAttempts {
		return nil, errors.New("test attempts limit reached")
	}

	preparedQuestions, publicQuestions, err := buildAttemptQuestions(lesson.Test.Questions, settings)
	if err != nil {
		return nil, err
	}

	startedAt := time.Now().UTC()
	attempt := &domain.LessonTestAttempt{
		CourseID:       course.ID,
		LessonID:       lesson.ID,
		StudentID:      studentID,
		AttemptNumber:  attemptsUsed + 1,
		MaxAttempts:    effectiveMaxAttempts,
		PassScore:      settings.PassScore,
		TimeLimitSec:   settings.TimeLimitSec,
		TotalQuestions: len(preparedQuestions),
		Questions:      preparedQuestions,
		StartedAt:      startedAt,
	}
	if err := s.enrollments.CreateLessonTestAttempt(attempt); err != nil {
		return nil, err
	}

	return &domain.LessonTestAttemptStart{
		AttemptID:     attempt.ID,
		AttemptNumber: attempt.AttemptNumber,
		MaxAttempts:   effectiveMaxAttempts,
		PassScore:     settings.PassScore,
		TimeLimitSec:  settings.TimeLimitSec,
		Questions:     publicQuestions,
		StartedAt:     startedAt,
	}, nil
}

func (s *CourseService) ResetStudentLessonTestResultsByTeacher(teacherID, courseID, lessonID, studentID int64) error {
	course, lesson, err := s.getCourseLesson(courseID, lessonID)
	if err != nil {
		return err
	}
	if course.TeacherID != teacherID {
		return errors.New("forbidden: course does not belong to teacher")
	}
	if lesson.Type != "test" || lesson.Test == nil {
		return errors.New("lesson is not a test")
	}
	return s.enrollments.ResetStudentLessonTestResultsByTeacher(teacherID, courseID, lessonID, studentID)
}

func (s *CourseService) ResetStudentLessonTestResultsByAdmin(courseID, lessonID, studentID int64) error {
	_, lesson, err := s.getCourseLesson(courseID, lessonID)
	if err != nil {
		return err
	}
	if lesson.Type != "test" || lesson.Test == nil {
		return errors.New("lesson is not a test")
	}
	return s.enrollments.ResetStudentLessonTestResultsByAdmin(courseID, lessonID, studentID)
}

func (s *CourseService) SubmitLessonTestAttempt(studentID, courseID, lessonID, attemptID int64, answers []domain.LessonTestAnswer) (*domain.LessonTestAttemptSubmitResult, *domain.CourseProgress, error) {
	attempt, err := s.enrollments.GetStudentLessonTestAttemptByID(studentID, courseID, lessonID, attemptID)
	if err != nil {
		return nil, nil, err
	}
	if attempt == nil {
		return nil, nil, errors.New("test attempt not found")
	}
	if attempt.SubmittedAt != nil {
		return nil, nil, errors.New("test attempt already submitted")
	}

	timeExpired := false
	if attempt.TimeLimitSec > 0 {
		deadline := attempt.StartedAt.Add(time.Duration(attempt.TimeLimitSec) * time.Second)
		timeExpired = time.Now().UTC().After(deadline)
	}

	resultItems, correctCount, err := evaluateLessonTestAttempt(attempt.Questions, answers)
	if err != nil {
		return nil, nil, err
	}
	totalQuestions := len(attempt.Questions)
	score := 0
	if totalQuestions > 0 {
		score = int(float64(correctCount) / float64(totalQuestions) * 100.0)
	}
	passed := score >= attempt.PassScore

	submittedAt := time.Now().UTC()
	duration := int(submittedAt.Sub(attempt.StartedAt).Seconds())
	if duration < 0 {
		duration = 0
	}

	attempt.Answers = answers
	attempt.Results = resultItems
	attempt.CorrectAnswers = correctCount
	attempt.TotalQuestions = totalQuestions
	attempt.Score = score
	attempt.Passed = passed
	attempt.DurationSec = duration
	attempt.SubmittedAt = &submittedAt

	if err := s.enrollments.SubmitLessonTestAttempt(attempt); err != nil {
		return nil, nil, err
	}

	var progress *domain.CourseProgress
	if passed {
		progress, err = s.enrollments.CompleteLesson(studentID, courseID, lessonID)
		if err != nil {
			return nil, nil, err
		}
	}

	_, lesson, err := s.getCourseLesson(courseID, lessonID)
	if err != nil {
		return nil, nil, err
	}
	settings := normalizeTestSettings(lesson.Test.Settings, len(lesson.Test.Questions))

	response := &domain.LessonTestAttemptSubmitResult{
		AttemptID:      attempt.ID,
		AttemptNumber:  attempt.AttemptNumber,
		Score:          score,
		Passed:         passed,
		TimeExpired:    timeExpired,
		PassScore:      attempt.PassScore,
		CorrectAnswers: correctCount,
		TotalQuestions: totalQuestions,
		DurationSec:    duration,
		ShowAnswers:    settings.ShowCorrectAnswers,
		SubmittedAt:    submittedAt,
	}
	if settings.ShowCorrectAnswers {
		response.Results = resultItems
	}

	return response, progress, nil
}

func (s *CourseService) StudentLessonTestAttempts(studentID, courseID, lessonID int64) ([]domain.LessonTestAttempt, error) {
	return s.enrollments.ListStudentLessonTestAttempts(studentID, courseID, lessonID)
}

func (s *CourseService) TeacherLessonTestAnalytics(teacherID, courseID, lessonID int64) (*domain.LessonTestAnalytics, []domain.LessonTestAttempt, error) {
	course, lesson, err := s.getCourseLesson(courseID, lessonID)
	if err != nil {
		return nil, nil, err
	}
	if course.TeacherID != teacherID {
		return nil, nil, errors.New("forbidden: course does not belong to teacher")
	}
	if lesson.Type != "test" || lesson.Test == nil {
		return nil, nil, errors.New("lesson is not a test")
	}

	attempts, err := s.enrollments.ListTeacherLessonTestAttempts(teacherID, courseID, lessonID)
	if err != nil {
		return nil, nil, err
	}
	analytics := buildLessonTestAnalytics(courseID, lessonID, lesson.Test.Questions, attempts)
	return analytics, attempts, nil
}

func (s *CourseService) AdminLessonTestAnalytics(courseID, lessonID int64) (*domain.LessonTestAnalytics, []domain.LessonTestAttempt, error) {
	_, lesson, err := s.getCourseLesson(courseID, lessonID)
	if err != nil {
		return nil, nil, err
	}
	if lesson.Type != "test" || lesson.Test == nil {
		return nil, nil, errors.New("lesson is not a test")
	}
	attempts, err := s.enrollments.ListAdminLessonTestAttempts(courseID, lessonID)
	if err != nil {
		return nil, nil, err
	}
	analytics := buildLessonTestAnalytics(courseID, lessonID, lesson.Test.Questions, attempts)
	return analytics, attempts, nil
}

func (s *CourseService) SubmitLessonForReview(studentID, courseID, lessonID int64, fileName, fileURL, studentNote string) (*domain.LessonSubmission, error) {
	fileName = strings.TrimSpace(fileName)
	fileURL = strings.TrimSpace(fileURL)
	studentNote = strings.TrimSpace(studentNote)
	if err := validateLessonSubmissionPayload(fileName, fileURL, studentNote); err != nil {
		return nil, err
	}

	course, err := s.courses.ByID(courseID)
	if err != nil {
		return nil, err
	}
	if course == nil {
		return nil, errors.New("course not found")
	}
	var lesson *domain.Lesson
	for moduleIndex := range course.Modules {
		for lessonIndex := range course.Modules[moduleIndex].Lessons {
			if course.Modules[moduleIndex].Lessons[lessonIndex].ID == lessonID {
				lesson = &course.Modules[moduleIndex].Lessons[lessonIndex]
				break
			}
		}
		if lesson != nil {
			break
		}
	}
	if lesson == nil {
		return nil, errors.New("lesson not found in this course")
	}
	if !lesson.RequiresReview {
		return nil, errors.New("lesson does not require review submission")
	}
	return s.enrollments.SubmitLessonWork(studentID, courseID, lessonID, fileName, fileURL, studentNote)
}

func (s *CourseService) StudentCourseSubmissions(studentID, courseID int64) ([]domain.LessonSubmission, error) {
	return s.enrollments.ListStudentCourseSubmissions(studentID, courseID)
}

func (s *CourseService) TeacherCourseSubmissions(teacherID, courseID int64, status string) ([]domain.LessonSubmission, error) {
	status = strings.TrimSpace(strings.ToLower(status))
	var submissionStatus domain.LessonSubmissionStatus
	switch status {
	case "", "all":
		submissionStatus = ""
	case string(domain.LessonSubmissionPending):
		submissionStatus = domain.LessonSubmissionPending
	case string(domain.LessonSubmissionApproved):
		submissionStatus = domain.LessonSubmissionApproved
	case string(domain.LessonSubmissionRejected):
		submissionStatus = domain.LessonSubmissionRejected
	default:
		return nil, errors.New("invalid submission status")
	}
	return s.enrollments.ListTeacherCourseSubmissions(teacherID, courseID, submissionStatus)
}

func (s *CourseService) ReviewLessonSubmissionByTeacher(teacherID, courseID, submissionID int64, approve bool, reviewNote string) (*domain.LessonSubmission, *domain.CourseProgress, error) {
	reviewNote = strings.TrimSpace(reviewNote)
	if err := validateTeacherReviewNote(reviewNote); err != nil {
		return nil, nil, err
	}

	submission, err := s.enrollments.GetTeacherCourseSubmissionByID(teacherID, courseID, submissionID)
	if err != nil {
		return nil, nil, err
	}
	if submission == nil {
		return nil, nil, errors.New("submission not found")
	}
	if submission.Status != domain.LessonSubmissionPending {
		return nil, nil, errors.New("submission is already reviewed")
	}

	nextStatus := domain.LessonSubmissionRejected
	var progress *domain.CourseProgress
	if approve {
		nextStatus = domain.LessonSubmissionApproved
		progress, err = s.enrollments.CompleteLesson(submission.StudentID, courseID, submission.LessonID)
		if err != nil {
			return nil, nil, err
		}
	}

	updatedSubmission, err := s.enrollments.ReviewLessonSubmissionByTeacher(teacherID, courseID, submissionID, nextStatus, reviewNote)
	if err != nil {
		return nil, nil, err
	}

	return updatedSubmission, progress, nil
}

func (s *CourseService) PublishByTeacher(teacherID, courseID int64) error {
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return errors.New("course not found")
	}
	if course.TeacherID != teacherID {
		return errors.New("forbidden: course does not belong to teacher")
	}
	return s.courses.SetStatus(courseID, "approved")
}

func (s *CourseService) PublishByAdmin(courseID int64) error {
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return errors.New("course not found")
	}
	return s.courses.SetStatus(courseID, "approved")
}

func (s *CourseService) UnpublishByTeacher(teacherID, courseID int64) error {
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return errors.New("course not found")
	}
	if course.TeacherID != teacherID {
		return errors.New("forbidden: course does not belong to teacher")
	}
	return s.courses.SetStatus(courseID, "pending")
}

func (s *CourseService) UnpublishByAdmin(courseID int64) error {
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return errors.New("course not found")
	}
	return s.courses.SetStatus(courseID, "pending")
}

func (s *CourseService) DeleteByTeacher(teacherID, courseID int64) error {
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return errors.New("course not found")
	}
	if course.TeacherID != teacherID {
		return errors.New("forbidden: course does not belong to teacher")
	}
	return s.courses.DeleteCourse(courseID)
}

func (s *CourseService) RestoreByTeacher(teacherID, courseID int64) error {
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return errors.New("course not found")
	}
	if course.TeacherID != teacherID {
		return errors.New("forbidden: course does not belong to teacher")
	}
	return s.courses.SetStatus(courseID, "pending")
}

func (s *CourseService) UpdateCourseByTeacher(teacherID, courseID int64, title, description string) (*domain.Course, error) {
	title = strings.TrimSpace(title)
	description = strings.TrimSpace(description)
	if err := validateCoursePayload(title, description); err != nil {
		return nil, err
	}
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return nil, err
	}
	if course == nil {
		return nil, errors.New("course not found")
	}
	if course.TeacherID != teacherID {
		return nil, errors.New("forbidden: course does not belong to teacher")
	}
	course.Title = title
	course.Description = description
	if err := s.courses.UpdateCourse(course); err != nil {
		return nil, err
	}
	return course, nil
}

func (s *CourseService) UpdateCourseByAdmin(courseID int64, title, description string) (*domain.Course, error) {
	title = strings.TrimSpace(title)
	description = strings.TrimSpace(description)
	if err := validateCoursePayload(title, description); err != nil {
		return nil, err
	}
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return nil, err
	}
	if course == nil {
		return nil, errors.New("course not found")
	}
	course.Title = title
	course.Description = description
	if err := s.courses.UpdateCourse(course); err != nil {
		return nil, err
	}
	return course, nil
}

func (s *CourseService) RestoreByAdmin(courseID int64) error {
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return errors.New("course not found")
	}
	return s.courses.SetStatus(courseID, "pending")
}

func (s *CourseService) SetCoursePasswordByTeacher(teacherID, courseID int64, password string) error {
	password = strings.TrimSpace(password)
	if err := validateCourseAccessPassword(password); err != nil {
		return err
	}
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return errors.New("course not found")
	}
	if course.TeacherID != teacherID {
		return errors.New("forbidden: course does not belong to teacher")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.courses.SetAccessPasswordHash(courseID, string(hash))
}

func (s *CourseService) ClearCoursePasswordByTeacher(teacherID, courseID int64) error {
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return errors.New("course not found")
	}
	if course.TeacherID != teacherID {
		return errors.New("forbidden: course does not belong to teacher")
	}
	return s.courses.ClearAccessPassword(courseID)
}

func (s *CourseService) SetCoursePasswordByAdmin(courseID int64, password string) error {
	password = strings.TrimSpace(password)
	if err := validateCourseAccessPassword(password); err != nil {
		return err
	}
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return errors.New("course not found")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.courses.SetAccessPasswordHash(courseID, string(hash))
}

func (s *CourseService) ClearCoursePasswordByAdmin(courseID int64) error {
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return errors.New("course not found")
	}
	return s.courses.ClearAccessPassword(courseID)
}

func (s *CourseService) DeleteByAdmin(courseID int64) error {
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return errors.New("course not found")
	}
	return s.courses.DeleteCourse(courseID)
}

func (s *CourseService) PermanentlyDeleteByAdmin(courseID int64) error {
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return errors.New("course not found")
	}
	if course.Status != "rejected" {
		return errors.New("course must be in deleted status")
	}
	return s.courses.PermanentlyDeleteCourse(courseID)
}

func (s *CourseService) AddModuleByTeacher(teacherID, courseID int64, title, description string) (*domain.Module, error) {
	title = strings.TrimSpace(title)
	description = strings.TrimSpace(description)
	if err := validateModulePayload(title, description); err != nil {
		return nil, err
	}

	course, err := s.courses.ByID(courseID)
	if err != nil {
		return nil, err
	}
	if course == nil {
		return nil, errors.New("course not found")
	}
	if course.TeacherID != teacherID {
		return nil, errors.New("forbidden: course does not belong to teacher")
	}

	module := &domain.Module{
		CourseID:    courseID,
		Title:       title,
		Description: description,
	}
	if err := s.courses.AddModule(module); err != nil {
		return nil, err
	}
	return module, nil
}

func (s *CourseService) AddModuleByAdmin(courseID int64, title, description string) (*domain.Module, error) {
	title = strings.TrimSpace(title)
	description = strings.TrimSpace(description)
	if err := validateModulePayload(title, description); err != nil {
		return nil, err
	}

	course, err := s.courses.ByID(courseID)
	if err != nil {
		return nil, err
	}
	if course == nil {
		return nil, errors.New("course not found")
	}

	module := &domain.Module{
		CourseID:    courseID,
		Title:       title,
		Description: description,
	}
	if err := s.courses.AddModule(module); err != nil {
		return nil, err
	}
	return module, nil
}

func (s *CourseService) AddLessonByTeacher(teacherID, courseID int64, moduleID int64, title, content, lessonType, videoURL string, requiresReview bool, attachments []domain.LessonAttachment, test *domain.LessonTest) (*domain.Lesson, error) {
	title = strings.TrimSpace(title)
	content = strings.TrimSpace(content)
	videoURL = strings.TrimSpace(videoURL)
	lessonType = strings.TrimSpace(lessonType)
	if lessonType == "" {
		lessonType = "text"
	}
	if err := validateLessonCommon(title, content, videoURL); err != nil {
		return nil, err
	}
	if lessonType != "text" && lessonType != "video" && lessonType != "test" {
		return nil, errors.New("lesson type must be text, video or test")
	}
	if lessonType == "test" {
		requiresReview = false
	}
	if err := validateLessonAttachments(lessonType, attachments); err != nil {
		return nil, err
	}
	if lessonType == "test" {
		if err := validateLessonTestData(test); err != nil {
			return nil, err
		}
	}

	course, err := s.courses.ByID(courseID)
	if err != nil {
		return nil, err
	}
	if course == nil {
		return nil, errors.New("course not found")
	}
	if course.TeacherID != teacherID {
		return nil, errors.New("forbidden: course does not belong to teacher")
	}

	moduleFound := false
	for _, m := range course.Modules {
		if m.ID == moduleID {
			moduleFound = true
			break
		}
	}
	if !moduleFound {
		return nil, errors.New("module not found in course")
	}

	lesson := &domain.Lesson{
		ModuleID:       moduleID,
		Title:          title,
		Content:        content,
		Type:           lessonType,
		VideoURL:       videoURL,
		RequiresReview: requiresReview,
		Attachments:    attachments,
		Test:           test,
	}
	if err := s.courses.AddLesson(lesson); err != nil {
		return nil, err
	}
	return lesson, nil
}

func (s *CourseService) AddLessonByAdmin(courseID, moduleID int64, title, content, lessonType, videoURL string, requiresReview bool, attachments []domain.LessonAttachment, test *domain.LessonTest) (*domain.Lesson, error) {
	title = strings.TrimSpace(title)
	content = strings.TrimSpace(content)
	videoURL = strings.TrimSpace(videoURL)
	lessonType = strings.TrimSpace(lessonType)
	if lessonType == "" {
		lessonType = "text"
	}
	if err := validateLessonCommon(title, content, videoURL); err != nil {
		return nil, err
	}
	if lessonType != "text" && lessonType != "video" && lessonType != "test" {
		return nil, errors.New("lesson type must be text, video or test")
	}
	if lessonType == "test" {
		requiresReview = false
	}
	if err := validateLessonAttachments(lessonType, attachments); err != nil {
		return nil, err
	}
	if lessonType == "test" {
		if err := validateLessonTestData(test); err != nil {
			return nil, err
		}
	}

	course, err := s.courses.ByID(courseID)
	if err != nil {
		return nil, err
	}
	if course == nil {
		return nil, errors.New("course not found")
	}

	moduleFound := false
	for _, m := range course.Modules {
		if m.ID == moduleID {
			moduleFound = true
			break
		}
	}
	if !moduleFound {
		return nil, errors.New("module not found in course")
	}

	lesson := &domain.Lesson{
		ModuleID:       moduleID,
		Title:          title,
		Content:        content,
		Type:           lessonType,
		VideoURL:       videoURL,
		RequiresReview: requiresReview,
		Attachments:    attachments,
		Test:           test,
	}
	if err := s.courses.AddLesson(lesson); err != nil {
		return nil, err
	}
	return lesson, nil
}

func (s *CourseService) UpdateModuleByTeacher(teacherID, courseID, moduleID int64, title, description string) (*domain.Module, error) {
	title = strings.TrimSpace(title)
	description = strings.TrimSpace(description)
	if err := validateModulePayload(title, description); err != nil {
		return nil, err
	}

	course, err := s.courses.ByID(courseID)
	if err != nil {
		return nil, err
	}
	if course == nil {
		return nil, errors.New("course not found")
	}
	if course.TeacherID != teacherID {
		return nil, errors.New("forbidden: course does not belong to teacher")
	}

	moduleFound := false
	for _, m := range course.Modules {
		if m.ID == moduleID {
			moduleFound = true
			break
		}
	}
	if !moduleFound {
		return nil, errors.New("module not found in course")
	}

	module := &domain.Module{
		ID:          moduleID,
		CourseID:    courseID,
		Title:       title,
		Description: description,
	}
	if err := s.courses.UpdateModule(module); err != nil {
		return nil, err
	}
	return module, nil
}

func (s *CourseService) UpdateModuleByAdmin(courseID, moduleID int64, title, description string) (*domain.Module, error) {
	title = strings.TrimSpace(title)
	description = strings.TrimSpace(description)
	if err := validateModulePayload(title, description); err != nil {
		return nil, err
	}

	course, err := s.courses.ByID(courseID)
	if err != nil {
		return nil, err
	}
	if course == nil {
		return nil, errors.New("course not found")
	}

	moduleFound := false
	for _, m := range course.Modules {
		if m.ID == moduleID {
			moduleFound = true
			break
		}
	}
	if !moduleFound {
		return nil, errors.New("module not found in course")
	}

	module := &domain.Module{
		ID:          moduleID,
		CourseID:    courseID,
		Title:       title,
		Description: description,
	}
	if err := s.courses.UpdateModule(module); err != nil {
		return nil, err
	}
	return module, nil
}

func (s *CourseService) DeleteModuleByTeacher(teacherID, courseID, moduleID int64) error {
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return errors.New("course not found")
	}
	if course.TeacherID != teacherID {
		return errors.New("forbidden: course does not belong to teacher")
	}

	moduleFound := false
	for _, m := range course.Modules {
		if m.ID == moduleID {
			moduleFound = true
			break
		}
	}
	if !moduleFound {
		return errors.New("module not found in course")
	}

	return s.courses.DeleteModule(moduleID)
}

func (s *CourseService) DeleteModuleByAdmin(courseID, moduleID int64) error {
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return errors.New("course not found")
	}

	moduleFound := false
	for _, m := range course.Modules {
		if m.ID == moduleID {
			moduleFound = true
			break
		}
	}
	if !moduleFound {
		return errors.New("module not found in course")
	}

	return s.courses.DeleteModule(moduleID)
}

func (s *CourseService) UpdateLessonByTeacher(teacherID, courseID, moduleID, lessonID int64, title, content, lessonType, videoURL string, requiresReview bool, attachments []domain.LessonAttachment, test *domain.LessonTest) (*domain.Lesson, error) {
	title = strings.TrimSpace(title)
	content = strings.TrimSpace(content)
	videoURL = strings.TrimSpace(videoURL)
	lessonType = strings.TrimSpace(lessonType)
	if lessonType == "" {
		lessonType = "text"
	}
	if err := validateLessonCommon(title, content, videoURL); err != nil {
		return nil, err
	}
	if lessonType != "text" && lessonType != "video" && lessonType != "test" {
		return nil, errors.New("lesson type must be text, video or test")
	}
	if lessonType == "test" {
		requiresReview = false
	}
	if err := validateLessonAttachments(lessonType, attachments); err != nil {
		return nil, err
	}
	if lessonType == "test" {
		if err := validateLessonTestData(test); err != nil {
			return nil, err
		}
	}

	course, err := s.courses.ByID(courseID)
	if err != nil {
		return nil, err
	}
	if course == nil {
		return nil, errors.New("course not found")
	}
	if course.TeacherID != teacherID {
		return nil, errors.New("forbidden: course does not belong to teacher")
	}

	moduleFound := false
	lessonFound := false
	for _, m := range course.Modules {
		if m.ID != moduleID {
			continue
		}
		moduleFound = true
		for _, l := range m.Lessons {
			if l.ID == lessonID {
				lessonFound = true
				break
			}
		}
		break
	}
	if !moduleFound {
		return nil, errors.New("module not found in course")
	}
	if !lessonFound {
		return nil, errors.New("lesson not found in module")
	}

	lesson := &domain.Lesson{
		ID:             lessonID,
		ModuleID:       moduleID,
		Title:          title,
		Content:        content,
		Type:           lessonType,
		VideoURL:       videoURL,
		RequiresReview: requiresReview,
		Attachments:    attachments,
		Test:           test,
	}
	if err := s.courses.UpdateLesson(lesson); err != nil {
		return nil, err
	}
	return lesson, nil
}

func (s *CourseService) UpdateLessonByAdmin(courseID, moduleID, lessonID int64, title, content, lessonType, videoURL string, requiresReview bool, attachments []domain.LessonAttachment, test *domain.LessonTest) (*domain.Lesson, error) {
	title = strings.TrimSpace(title)
	content = strings.TrimSpace(content)
	videoURL = strings.TrimSpace(videoURL)
	lessonType = strings.TrimSpace(lessonType)
	if lessonType == "" {
		lessonType = "text"
	}
	if err := validateLessonCommon(title, content, videoURL); err != nil {
		return nil, err
	}
	if lessonType != "text" && lessonType != "video" && lessonType != "test" {
		return nil, errors.New("lesson type must be text, video or test")
	}
	if lessonType == "test" {
		requiresReview = false
	}
	if err := validateLessonAttachments(lessonType, attachments); err != nil {
		return nil, err
	}
	if lessonType == "test" {
		if err := validateLessonTestData(test); err != nil {
			return nil, err
		}
	}

	course, err := s.courses.ByID(courseID)
	if err != nil {
		return nil, err
	}
	if course == nil {
		return nil, errors.New("course not found")
	}

	moduleFound := false
	lessonFound := false
	for _, m := range course.Modules {
		if m.ID != moduleID {
			continue
		}
		moduleFound = true
		for _, l := range m.Lessons {
			if l.ID == lessonID {
				lessonFound = true
				break
			}
		}
		break
	}
	if !moduleFound {
		return nil, errors.New("module not found in course")
	}
	if !lessonFound {
		return nil, errors.New("lesson not found in module")
	}

	lesson := &domain.Lesson{
		ID:             lessonID,
		ModuleID:       moduleID,
		Title:          title,
		Content:        content,
		Type:           lessonType,
		VideoURL:       videoURL,
		RequiresReview: requiresReview,
		Attachments:    attachments,
		Test:           test,
	}
	if err := s.courses.UpdateLesson(lesson); err != nil {
		return nil, err
	}
	return lesson, nil
}

func (s *CourseService) DeleteLessonByTeacher(teacherID, courseID, moduleID, lessonID int64) error {
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return errors.New("course not found")
	}
	if course.TeacherID != teacherID {
		return errors.New("forbidden: course does not belong to teacher")
	}

	moduleFound := false
	lessonFound := false
	for _, m := range course.Modules {
		if m.ID != moduleID {
			continue
		}
		moduleFound = true
		for _, l := range m.Lessons {
			if l.ID == lessonID {
				lessonFound = true
				break
			}
		}
		break
	}
	if !moduleFound {
		return errors.New("module not found in course")
	}
	if !lessonFound {
		return errors.New("lesson not found in module")
	}

	return s.courses.DeleteLesson(lessonID)
}

func (s *CourseService) DeleteLessonByAdmin(courseID, moduleID, lessonID int64) error {
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return err
	}
	if course == nil {
		return errors.New("course not found")
	}

	moduleFound := false
	lessonFound := false
	for _, m := range course.Modules {
		if m.ID != moduleID {
			continue
		}
		moduleFound = true
		for _, l := range m.Lessons {
			if l.ID == lessonID {
				lessonFound = true
				break
			}
		}
		break
	}
	if !moduleFound {
		return errors.New("module not found in course")
	}
	if !lessonFound {
		return errors.New("lesson not found in module")
	}

	return s.courses.DeleteLesson(lessonID)
}

func (s *CourseService) getCourseLesson(courseID, lessonID int64) (*domain.Course, *domain.Lesson, error) {
	course, err := s.courses.ByID(courseID)
	if err != nil {
		return nil, nil, err
	}
	if course == nil {
		return nil, nil, errors.New("course not found")
	}
	for moduleIndex := range course.Modules {
		for lessonIndex := range course.Modules[moduleIndex].Lessons {
			if course.Modules[moduleIndex].Lessons[lessonIndex].ID == lessonID {
				return course, &course.Modules[moduleIndex].Lessons[lessonIndex], nil
			}
		}
	}
	return nil, nil, errors.New("lesson not found in this course")
}

func normalizeTestSettings(raw domain.LessonTestSettings, totalQuestions int) domain.LessonTestSettings {
	settings := raw
	if settings.PassScore <= 0 {
		settings.PassScore = 70
	}
	if settings.MaxAttempts <= 0 {
		settings.MaxAttempts = 3
	}
	if settings.RandomQuestionCount <= 0 || settings.RandomQuestionCount > totalQuestions {
		settings.RandomQuestionCount = totalQuestions
	}
	return settings
}

func buildAttemptQuestions(source []domain.LessonQuestion, settings domain.LessonTestSettings) ([]domain.LessonQuestion, []domain.LessonTestQuestionPublic, error) {
	if len(source) == 0 {
		return nil, nil, errors.New("test lesson must have at least one question")
	}

	questions := make([]domain.LessonQuestion, 0, len(source))
	for _, question := range source {
		clone := question
		clone.Question = strings.TrimSpace(clone.Question)
		if clone.ID == "" {
			clone.ID = generateQuestionID(clone.Question)
		}
		if clone.Type == "true_false" && len(clone.Options) == 0 {
			clone.Options = []string{"Верно", "Неверно"}
		}
		questions = append(questions, clone)
	}

	if settings.ShuffleQuestions {
		rng := rand.New(rand.NewSource(time.Now().UnixNano()))
		rng.Shuffle(len(questions), func(i, j int) {
			questions[i], questions[j] = questions[j], questions[i]
		})
	}

	if settings.RandomQuestionCount > 0 && settings.RandomQuestionCount < len(questions) {
		questions = questions[:settings.RandomQuestionCount]
	}

	for index := range questions {
		if settings.ShuffleOptions && len(questions[index].Options) > 1 && questions[index].Type != "open" {
			shuffleQuestionOptions(&questions[index])
		}
	}

	publicQuestions := make([]domain.LessonTestQuestionPublic, 0, len(questions))
	for _, question := range questions {
		publicQuestions = append(publicQuestions, domain.LessonTestQuestionPublic{
			ID:       question.ID,
			Type:     question.Type,
			Question: question.Question,
			Options:  question.Options,
		})
	}

	return questions, publicQuestions, nil
}

func generateQuestionID(question string) string {
	base := strings.TrimSpace(strings.ToLower(question))
	if base == "" {
		return strings.ReplaceAll(time.Now().UTC().Format("20060102150405.000000000"), ".", "")
	}
	base = strings.ReplaceAll(base, " ", "-")
	if len(base) > 32 {
		base = base[:32]
	}
	return base + "-" + strings.ReplaceAll(time.Now().UTC().Format("150405000000"), ".", "")
}

func shuffleQuestionOptions(question *domain.LessonQuestion) {
	if question == nil || len(question.Options) < 2 {
		return
	}

	oldToNew := make(map[int]int, len(question.Options))
	indexes := make([]int, len(question.Options))
	for index := range question.Options {
		indexes[index] = index
	}

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	rng.Shuffle(len(indexes), func(i, j int) {
		indexes[i], indexes[j] = indexes[j], indexes[i]
	})

	shuffled := make([]string, len(question.Options))
	for newIndex, oldIndex := range indexes {
		shuffled[newIndex] = question.Options[oldIndex]
		oldToNew[oldIndex] = newIndex
	}
	question.Options = shuffled

	if question.CorrectAnswer != nil {
		if mapped, ok := oldToNew[*question.CorrectAnswer]; ok {
			question.CorrectAnswer = &mapped
		}
	}
	if len(question.CorrectAnswers) > 0 {
		remapped := make([]int, 0, len(question.CorrectAnswers))
		for _, oldIndex := range question.CorrectAnswers {
			if mapped, ok := oldToNew[oldIndex]; ok {
				remapped = append(remapped, mapped)
			}
		}
		sort.Ints(remapped)
		question.CorrectAnswers = remapped
	}
}

func evaluateLessonTestAttempt(questions []domain.LessonQuestion, answers []domain.LessonTestAnswer) ([]domain.LessonTestQuestionResult, int, error) {
	answerByQuestion := make(map[string]domain.LessonTestAnswer, len(answers))
	for _, answer := range answers {
		answerByQuestion[strings.TrimSpace(answer.QuestionID)] = answer
	}

	results := make([]domain.LessonTestQuestionResult, 0, len(questions))
	correctCount := 0

	for _, question := range questions {
		answer := answerByQuestion[strings.TrimSpace(question.ID)]
		result := domain.LessonTestQuestionResult{
			QuestionID: question.ID,
			Question:   question.Question,
			Type:       question.Type,
		}

		switch question.Type {
		case "multiple":
			actual := normalizeOptionSet(answer.Options)
			expected := normalizeOptionSet(question.CorrectAnswers)
			result.StudentAnswer = actual
			result.CorrectAnswer = expected
			result.IsCorrect = equalIntSlices(actual, expected)
		case "open":
			actualText := strings.TrimSpace(strings.ToLower(answer.Text))
			expectedText := strings.TrimSpace(strings.ToLower(question.CorrectText))
			result.StudentAnswer = answer.Text
			result.CorrectAnswer = question.CorrectText
			result.IsCorrect = actualText != "" && actualText == expectedText
		default:
			actual := -1
			if answer.Option != nil {
				actual = *answer.Option
			} else if len(answer.Options) > 0 {
				actual = answer.Options[0]
			}
			expected := -1
			if question.CorrectAnswer != nil {
				expected = *question.CorrectAnswer
			}
			result.StudentAnswer = actual
			result.CorrectAnswer = expected
			result.IsCorrect = actual >= 0 && actual == expected
		}

		if result.IsCorrect {
			correctCount++
		}
		results = append(results, result)
	}

	return results, correctCount, nil
}

func normalizeOptionSet(values []int) []int {
	set := make(map[int]struct{}, len(values))
	for _, value := range values {
		if value < 0 {
			continue
		}
		set[value] = struct{}{}
	}
	out := make([]int, 0, len(set))
	for value := range set {
		out = append(out, value)
	}
	sort.Ints(out)
	return out
}

func equalIntSlices(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for index := range a {
		if a[index] != b[index] {
			return false
		}
	}
	return true
}

func buildLessonTestAnalytics(courseID, lessonID int64, sourceQuestions []domain.LessonQuestion, attempts []domain.LessonTestAttempt) *domain.LessonTestAnalytics {
	studentStats := make(map[int64]*domain.LessonTestStudentStat)
	questionMeta := make(map[string]domain.LessonTestQuestionAnalytics)
	for _, question := range sourceQuestions {
		questionMeta[question.ID] = domain.LessonTestQuestionAnalytics{
			QuestionID: question.ID,
			Question:   question.Question,
		}
	}

	for _, attempt := range attempts {
		if attempt.SubmittedAt == nil {
			continue
		}
		stat, exists := studentStats[attempt.StudentID]
		if !exists {
			stat = &domain.LessonTestStudentStat{
				StudentID:    attempt.StudentID,
				StudentName:  attempt.StudentName,
				StudentEmail: attempt.StudentEmail,
				BestScore:    attempt.Score,
				LastScore:    attempt.Score,
				Passed:       attempt.Passed,
			}
			studentStats[attempt.StudentID] = stat
		}
		stat.AttemptsUsed++
		if attempt.Score > stat.BestScore {
			stat.BestScore = attempt.Score
		}
		stat.LastScore = attempt.Score
		if attempt.Passed {
			stat.Passed = true
		}

		for _, questionResult := range attempt.Results {
			meta := questionMeta[questionResult.QuestionID]
			meta.TimesShown++
			if questionResult.IsCorrect {
				meta.CorrectCount++
			}
			questionMeta[questionResult.QuestionID] = meta
		}
	}

	students := make([]domain.LessonTestStudentStat, 0, len(studentStats))
	passedCount := 0
	for _, stat := range studentStats {
		if stat.Passed {
			passedCount++
		}
		students = append(students, *stat)
	}
	sort.Slice(students, func(i, j int) bool {
		if students[i].StudentName == students[j].StudentName {
			return students[i].StudentID < students[j].StudentID
		}
		return students[i].StudentName < students[j].StudentName
	})

	questions := make([]domain.LessonTestQuestionAnalytics, 0, len(questionMeta))
	for _, meta := range questionMeta {
		if meta.TimesShown > 0 {
			meta.CorrectRate = int(float64(meta.CorrectCount) / float64(meta.TimesShown) * 100.0)
		}
		questions = append(questions, meta)
	}
	sort.Slice(questions, func(i, j int) bool {
		return questions[i].QuestionID < questions[j].QuestionID
	})

	return &domain.LessonTestAnalytics{
		CourseID:       courseID,
		LessonID:       lessonID,
		TotalStudents:  len(students),
		PassedStudents: passedCount,
		FailedStudents: len(students) - passedCount,
		Students:       students,
		Questions:      questions,
	}
}
