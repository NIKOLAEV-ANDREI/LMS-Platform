package domain

import "time"

type Role string

const (
	RoleStudent Role = "student"
	RoleTeacher Role = "teacher"
	RoleAdmin   Role = "admin"
)

type User struct {
	ID           int64  `json:"id"`
	PublicID     string `json:"public_id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	PasswordHash string `json:"-"`
	Role         Role   `json:"role"`
	Blocked      bool   `json:"blocked"`
	AvatarURL    string `json:"avatar_url,omitempty"`
}

type Course struct {
	ID                 int64    `json:"id"`
	PublicID           string   `json:"public_id"`
	Title              string   `json:"title"`
	Description        string   `json:"description"`
	TeacherID          int64    `json:"teacher_id"`
	TeacherPublicID    string   `json:"teacher_public_id,omitempty"`
	TeacherName        string   `json:"teacher_name,omitempty"`
	EnrolledStudents   []int64  `json:"enrolled_students,omitempty"`
	Status             string   `json:"status"`
	HasPassword        bool     `json:"has_password"`
	AccessPasswordHash string   `json:"-"`
	Modules            []Module `json:"modules,omitempty"`
}

type Enrollment struct {
	UserID    int64 `json:"user_id"`
	CourseID  int64 `json:"course_id"`
	Progress  int   `json:"progress"`
	Completed bool  `json:"completed"`
}

type Module struct {
	ID          int64    `json:"id"`
	CourseID    int64    `json:"course_id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Order       int      `json:"order"`
	Lessons     []Lesson `json:"lessons,omitempty"`
}

type Lesson struct {
	ID             int64              `json:"id"`
	ModuleID       int64              `json:"module_id"`
	Title          string             `json:"title"`
	Content        string             `json:"content"`
	Type           string             `json:"type"`
	VideoURL       string             `json:"video_url,omitempty"`
	RequiresReview bool               `json:"requires_review"`
	Attachments    []LessonAttachment `json:"attachments,omitempty"`
	Test           *LessonTest        `json:"test,omitempty"`
	Order          int                `json:"order"`
}

type LessonAttachment struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	ContentType string `json:"contentType"`
	Size        int64  `json:"size"`
	URL         string `json:"url"`
}

type LessonTest struct {
	Questions []LessonQuestion `json:"questions"`
}

type LessonQuestion struct {
	ID             string   `json:"id"`
	Type           string   `json:"type"`
	Question       string   `json:"question"`
	Options        []string `json:"options,omitempty"`
	CorrectAnswer  *int     `json:"correctAnswer,omitempty"`
	CorrectAnswers []int    `json:"correctAnswers,omitempty"`
}

type CourseProgress struct {
	UserID           int64   `json:"user_id"`
	CourseID         int64   `json:"course_id"`
	CompletedLessons []int64 `json:"completed_lessons"`
	Progress         int     `json:"progress"`
}

type LessonSubmissionStatus string

const (
	LessonSubmissionPending  LessonSubmissionStatus = "pending"
	LessonSubmissionApproved LessonSubmissionStatus = "approved"
	LessonSubmissionRejected LessonSubmissionStatus = "rejected"
)

type LessonSubmission struct {
	ID           int64                  `json:"id"`
	CourseID     int64                  `json:"course_id"`
	LessonID     int64                  `json:"lesson_id"`
	StudentID    int64                  `json:"student_id"`
	StudentName  string                 `json:"student_name,omitempty"`
	StudentEmail string                 `json:"student_email,omitempty"`
	TeacherID    int64                  `json:"teacher_id"`
	FileName     string                 `json:"file_name"`
	FileURL      string                 `json:"file_url"`
	StudentNote  string                 `json:"student_note,omitempty"`
	ReviewNote   string                 `json:"review_note,omitempty"`
	Status       LessonSubmissionStatus `json:"status"`
	AttemptCount int                    `json:"attempt_count"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
	ReviewedAt   *time.Time             `json:"reviewed_at,omitempty"`
}
