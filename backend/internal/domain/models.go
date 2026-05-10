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
	Settings  LessonTestSettings `json:"settings"`
	Questions []LessonQuestion   `json:"questions"`
}

type LessonTestSettings struct {
	TimeLimitSec        int  `json:"timeLimitSec"`
	PassScore           int  `json:"passScore"`
	MaxAttempts         int  `json:"maxAttempts"`
	RandomQuestionCount int  `json:"randomQuestionCount"`
	ShuffleQuestions    bool `json:"shuffleQuestions"`
	ShuffleOptions      bool `json:"shuffleOptions"`
	ShowCorrectAnswers  bool `json:"showCorrectAnswers"`
}

type LessonQuestion struct {
	ID             string   `json:"id"`
	Type           string   `json:"type"`
	Question       string   `json:"question"`
	Options        []string `json:"options,omitempty"`
	CorrectAnswer  *int     `json:"correctAnswer,omitempty"`
	CorrectAnswers []int    `json:"correctAnswers,omitempty"`
	CorrectText    string   `json:"correctText,omitempty"`
	Difficulty     int      `json:"difficulty,omitempty"`
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

type LessonTestQuestionPublic struct {
	ID         string   `json:"id"`
	Type       string   `json:"type"`
	Question   string   `json:"question"`
	Options    []string `json:"options,omitempty"`
	Difficulty int      `json:"difficulty,omitempty"`
}

type LessonTestAnswer struct {
	QuestionID string `json:"questionId"`
	Option     *int   `json:"option,omitempty"`
	Options    []int  `json:"options,omitempty"`
	Text       string `json:"text,omitempty"`
}

type LessonTestQuestionResult struct {
	QuestionID    string `json:"questionId"`
	Question      string `json:"question"`
	Type          string `json:"type"`
	IsCorrect     bool   `json:"isCorrect"`
	StudentAnswer any    `json:"studentAnswer,omitempty"`
	CorrectAnswer any    `json:"correctAnswer,omitempty"`
}

type LessonTestAttempt struct {
	ID             int64                      `json:"id"`
	CourseID       int64                      `json:"course_id"`
	LessonID       int64                      `json:"lesson_id"`
	StudentID      int64                      `json:"student_id"`
	StudentName    string                     `json:"student_name,omitempty"`
	StudentEmail   string                     `json:"student_email,omitempty"`
	AttemptNumber  int                        `json:"attempt_number"`
	TotalQuestions int                        `json:"total_questions"`
	CorrectAnswers int                        `json:"correct_answers"`
	Score          int                        `json:"score"`
	Passed         bool                       `json:"passed"`
	MaxAttempts    int                        `json:"max_attempts"`
	PassScore      int                        `json:"pass_score"`
	TimeLimitSec   int                        `json:"time_limit_sec"`
	DurationSec    int                        `json:"duration_sec"`
	Questions      []LessonQuestion           `json:"questions,omitempty"`
	Answers        []LessonTestAnswer         `json:"answers,omitempty"`
	Results        []LessonTestQuestionResult `json:"results,omitempty"`
	StartedAt      time.Time                  `json:"started_at"`
	SubmittedAt    *time.Time                 `json:"submitted_at,omitempty"`
}

type LessonTestAttemptStart struct {
	AttemptID     int64                      `json:"attemptId"`
	AttemptNumber int                        `json:"attemptNumber"`
	MaxAttempts   int                        `json:"maxAttempts"`
	PassScore     int                        `json:"passScore"`
	TimeLimitSec  int                        `json:"timeLimitSec"`
	Questions     []LessonTestQuestionPublic `json:"questions"`
	StartedAt     time.Time                  `json:"startedAt"`
}

type LessonTestAttemptSubmitResult struct {
	AttemptID      int64                      `json:"attemptId"`
	AttemptNumber  int                        `json:"attemptNumber"`
	Score          int                        `json:"score"`
	Passed         bool                       `json:"passed"`
	TimeExpired    bool                       `json:"timeExpired"`
	PassScore      int                        `json:"passScore"`
	CorrectAnswers int                        `json:"correctAnswers"`
	TotalQuestions int                        `json:"totalQuestions"`
	DurationSec    int                        `json:"durationSec"`
	ShowAnswers    bool                       `json:"showAnswers"`
	Results        []LessonTestQuestionResult `json:"results,omitempty"`
	SubmittedAt    time.Time                  `json:"submittedAt"`
}

type LessonTestStudentStat struct {
	StudentID    int64  `json:"student_id"`
	StudentName  string `json:"student_name"`
	StudentEmail string `json:"student_email"`
	AttemptsUsed int    `json:"attempts_used"`
	BestScore    int    `json:"best_score"`
	LastScore    int    `json:"last_score"`
	Passed       bool   `json:"passed"`
}

type LessonTestQuestionAnalytics struct {
	QuestionID   string `json:"question_id"`
	Question     string `json:"question"`
	Difficulty   int    `json:"difficulty"`
	TimesShown   int    `json:"times_shown"`
	CorrectCount int    `json:"correct_count"`
	CorrectRate  int    `json:"correct_rate"`
}

type LessonTestAnalytics struct {
	CourseID       int64                         `json:"course_id"`
	LessonID       int64                         `json:"lesson_id"`
	TotalStudents  int                           `json:"total_students"`
	PassedStudents int                           `json:"passed_students"`
	FailedStudents int                           `json:"failed_students"`
	Students       []LessonTestStudentStat       `json:"students"`
	Questions      []LessonTestQuestionAnalytics `json:"questions"`
}
