package sqlite

import (
	"database/sql"
	"errors"
	"lms-backend/internal/domain"
)

type EnrollmentRepo struct {
	db *sql.DB
}

func NewEnrollmentRepo(db *sql.DB) *EnrollmentRepo { return &EnrollmentRepo{db: db} }

func (r *EnrollmentRepo) Enroll(userID, courseID int64) error {
	_, err := r.db.Exec(`INSERT OR IGNORE INTO enrollments(user_id,course_id,progress,completed) VALUES(?,?,0,0)`, userID, courseID)
	return err
}

func (r *EnrollmentRepo) Unenroll(userID, courseID int64) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec(`DELETE FROM lesson_progress WHERE user_id=? AND course_id=?`, userID, courseID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM enrollments WHERE user_id=? AND course_id=?`, userID, courseID); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *EnrollmentRepo) SetProgress(userID, courseID int64, progress int) error {
	completed := 0
	if progress >= 100 {
		completed = 1
		progress = 100
	}
	_, err := r.db.Exec(`UPDATE enrollments SET progress=?, completed=? WHERE user_id=? AND course_id=?`, progress, completed, userID, courseID)
	return err
}

func (r *EnrollmentRepo) ListByStudent(userID int64) ([]domain.Enrollment, error) {
	rows, err := r.db.Query(`SELECT user_id,course_id,progress,completed FROM enrollments WHERE user_id=? ORDER BY course_id DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.Enrollment
	for rows.Next() {
		var e domain.Enrollment
		var completed int
		if err := rows.Scan(&e.UserID, &e.CourseID, &e.Progress, &completed); err != nil {
			return nil, err
		}
		e.Completed = completed == 1
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *EnrollmentRepo) ListCourseStudentsByTeacher(teacherID, courseID int64) ([]domain.User, error) {
	return nil, errors.New("not implemented")
}

func (r *EnrollmentRepo) CompleteLesson(userID, courseID, lessonID int64) (*domain.CourseProgress, error) {
	return nil, errors.New("not implemented")
}

func (r *EnrollmentRepo) GetCourseProgress(userID, courseID int64) (*domain.CourseProgress, error) {
	return nil, errors.New("not implemented")
}

func (r *EnrollmentRepo) SubmitLessonWork(studentID, courseID, lessonID int64, fileName, fileURL, studentNote string) (*domain.LessonSubmission, error) {
	return nil, errors.New("not implemented")
}

func (r *EnrollmentRepo) ListTeacherCourseSubmissions(teacherID, courseID int64, status domain.LessonSubmissionStatus) ([]domain.LessonSubmission, error) {
	return nil, errors.New("not implemented")
}

func (r *EnrollmentRepo) ListStudentCourseSubmissions(studentID, courseID int64) ([]domain.LessonSubmission, error) {
	return nil, errors.New("not implemented")
}

func (r *EnrollmentRepo) GetTeacherCourseSubmissionByID(teacherID, courseID, submissionID int64) (*domain.LessonSubmission, error) {
	return nil, errors.New("not implemented")
}

func (r *EnrollmentRepo) ReviewLessonSubmissionByTeacher(teacherID, courseID, submissionID int64, status domain.LessonSubmissionStatus, reviewNote string) (*domain.LessonSubmission, error) {
	return nil, errors.New("not implemented")
}

func (r *EnrollmentRepo) CountStudentLessonTestAttempts(studentID, lessonID int64) (int, error) {
	return 0, errors.New("not implemented")
}

func (r *EnrollmentRepo) CreateLessonTestAttempt(attempt *domain.LessonTestAttempt) error {
	return errors.New("not implemented")
}

func (r *EnrollmentRepo) GetStudentLessonTestAttemptByID(studentID, courseID, lessonID, attemptID int64) (*domain.LessonTestAttempt, error) {
	return nil, errors.New("not implemented")
}

func (r *EnrollmentRepo) SubmitLessonTestAttempt(attempt *domain.LessonTestAttempt) error {
	return errors.New("not implemented")
}

func (r *EnrollmentRepo) ListStudentLessonTestAttempts(studentID, courseID, lessonID int64) ([]domain.LessonTestAttempt, error) {
	return nil, errors.New("not implemented")
}

func (r *EnrollmentRepo) ListTeacherLessonTestAttempts(teacherID, courseID, lessonID int64) ([]domain.LessonTestAttempt, error) {
	return nil, errors.New("not implemented")
}

func (r *EnrollmentRepo) ListAdminLessonTestAttempts(courseID, lessonID int64) ([]domain.LessonTestAttempt, error) {
	return nil, errors.New("not implemented")
}

func (r *EnrollmentRepo) ResetStudentLessonTestResultsByTeacher(teacherID, courseID, lessonID, studentID int64) error {
	return errors.New("not implemented")
}

func (r *EnrollmentRepo) ResetStudentLessonTestResultsByAdmin(courseID, lessonID, studentID int64) error {
	return errors.New("not implemented")
}
