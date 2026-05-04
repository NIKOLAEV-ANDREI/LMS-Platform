package service

import (
	"errors"
	"strings"

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
	course := &domain.Course{
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

func (s *CourseService) CompleteLesson(studentID, courseID, lessonID int64) (*domain.CourseProgress, error) {
	return s.enrollments.CompleteLesson(studentID, courseID, lessonID)
}

func (s *CourseService) GetCourseProgress(studentID, courseID int64) (*domain.CourseProgress, error) {
	return s.enrollments.GetCourseProgress(studentID, courseID)
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
		ModuleID:    moduleID,
		Title:       title,
		Content:     content,
		Type:        lessonType,
		VideoURL:    videoURL,
		RequiresReview: requiresReview,
		Attachments: attachments,
		Test:        test,
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
		ModuleID:    moduleID,
		Title:       title,
		Content:     content,
		Type:        lessonType,
		VideoURL:    videoURL,
		RequiresReview: requiresReview,
		Attachments: attachments,
		Test:        test,
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
		ID:          lessonID,
		ModuleID:    moduleID,
		Title:       title,
		Content:     content,
		Type:        lessonType,
		VideoURL:    videoURL,
		RequiresReview: requiresReview,
		Attachments: attachments,
		Test:        test,
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
		ID:          lessonID,
		ModuleID:    moduleID,
		Title:       title,
		Content:     content,
		Type:        lessonType,
		VideoURL:    videoURL,
		RequiresReview: requiresReview,
		Attachments: attachments,
		Test:        test,
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
