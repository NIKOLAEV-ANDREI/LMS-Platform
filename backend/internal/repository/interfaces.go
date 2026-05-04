package repository

import "lms-backend/internal/domain"

type UserRepository interface {
	Create(user *domain.User) error
	ByEmail(email string) (*domain.User, error)
	ByID(id int64) (*domain.User, error)
	List() ([]domain.User, error)
	SetBlocked(id int64, blocked bool) error
	SetRole(id int64, role domain.Role) error
	UpdateProfile(id int64, name, email string) error
	SetPasswordHash(id int64, passwordHash string) error
	SetAvatar(id int64, avatarURL string) error
}

type CourseRepository interface {
	Create(course *domain.Course) error
	ByID(courseID int64) (*domain.Course, error)
	ListApproved() ([]domain.Course, error)
	ListByTeacher(teacherID int64) ([]domain.Course, error)
	ListDeletedByTeacher(teacherID int64) ([]domain.Course, error)
	ListAll() ([]domain.Course, error)
	Approve(courseID int64) error
	SetStatus(courseID int64, status string) error
	UpdateCourse(course *domain.Course) error
	DeleteCourse(courseID int64) error
	AddModule(module *domain.Module) error
	UpdateModule(module *domain.Module) error
	DeleteModule(moduleID int64) error
	AddLesson(lesson *domain.Lesson) error
	UpdateLesson(lesson *domain.Lesson) error
	DeleteLesson(lessonID int64) error
	SetAccessPasswordHash(courseID int64, passwordHash string) error
	ClearAccessPassword(courseID int64) error
}

type EnrollmentRepository interface {
	Enroll(userID, courseID int64) error
	Unenroll(userID, courseID int64) error
	SetProgress(userID, courseID int64, progress int) error
	ListByStudent(userID int64) ([]domain.Enrollment, error)
	CompleteLesson(userID, courseID, lessonID int64) (*domain.CourseProgress, error)
	GetCourseProgress(userID, courseID int64) (*domain.CourseProgress, error)
}
