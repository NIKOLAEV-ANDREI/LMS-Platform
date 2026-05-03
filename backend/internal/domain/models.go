package domain

type Role string

const (
	RoleStudent Role = "student"
	RoleTeacher Role = "teacher"
	RoleAdmin   Role = "admin"
)

type User struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	PasswordHash string `json:"-"`
	Role         Role   `json:"role"`
	Blocked      bool   `json:"blocked"`
	AvatarURL    string `json:"avatar_url,omitempty"`
}

type Course struct {
	ID          int64    `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	TeacherID   int64    `json:"teacher_id"`
	TeacherName string   `json:"teacher_name,omitempty"`
	Status      string   `json:"status"`
	Modules     []Module `json:"modules,omitempty"`
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
	ID       int64       `json:"id"`
	ModuleID int64       `json:"module_id"`
	Title    string      `json:"title"`
	Content  string      `json:"content"`
	Type     string      `json:"type"`
	VideoURL string      `json:"video_url,omitempty"`
	Test     *LessonTest `json:"test,omitempty"`
	Order    int         `json:"order"`
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
