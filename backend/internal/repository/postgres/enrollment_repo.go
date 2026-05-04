package postgres

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
	_, err := r.db.Exec(`INSERT INTO enrollments(user_id,course_id,progress,completed) VALUES($1,$2,0,false) ON CONFLICT (user_id, course_id) DO NOTHING`, userID, courseID)
	return err
}

func (r *EnrollmentRepo) Unenroll(userID, courseID int64) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec(`DELETE FROM lesson_progress WHERE user_id=$1 AND course_id=$2`, userID, courseID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM enrollments WHERE user_id=$1 AND course_id=$2`, userID, courseID); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *EnrollmentRepo) SetProgress(userID, courseID int64, progress int) error {
	completed := false
	if progress >= 100 {
		completed = true
		progress = 100
	}
	_, err := r.db.Exec(`UPDATE enrollments SET progress=$1, completed=$2 WHERE user_id=$3 AND course_id=$4`, progress, completed, userID, courseID)
	return err
}

func (r *EnrollmentRepo) ListByStudent(userID int64) ([]domain.Enrollment, error) {
	rows, err := r.db.Query(`SELECT user_id,course_id,progress,completed FROM enrollments WHERE user_id=$1 ORDER BY course_id DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.Enrollment
	for rows.Next() {
		var e domain.Enrollment
		if err := rows.Scan(&e.UserID, &e.CourseID, &e.Progress, &e.Completed); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *EnrollmentRepo) CompleteLesson(userID, courseID, lessonID int64) (*domain.CourseProgress, error) {
	var enrolled bool
	if err := r.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2)`, userID, courseID).Scan(&enrolled); err != nil {
		return nil, err
	}
	if !enrolled {
		return nil, errors.New("student is not enrolled in this course")
	}

	var lessonInCourse bool
	if err := r.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1
			FROM lessons l
			JOIN course_modules m ON m.id = l.module_id
			WHERE l.id=$1 AND m.course_id=$2
		)
	`, lessonID, courseID).Scan(&lessonInCourse); err != nil {
		return nil, err
	}
	if !lessonInCourse {
		return nil, errors.New("lesson not found in this course")
	}

	if _, err := r.db.Exec(`
		INSERT INTO lesson_progress(user_id,course_id,lesson_id,completed_at)
		VALUES($1,$2,$3,NOW())
		ON CONFLICT (user_id,course_id,lesson_id) DO NOTHING
	`, userID, courseID, lessonID); err != nil {
		return nil, err
	}

	progress, err := r.GetCourseProgress(userID, courseID)
	if err != nil {
		return nil, err
	}
	if progress == nil {
		return nil, errors.New("progress not found")
	}

	completed := progress.Progress >= 100
	if _, err := r.db.Exec(`UPDATE enrollments SET progress=$1, completed=$2 WHERE user_id=$3 AND course_id=$4`, progress.Progress, completed, userID, courseID); err != nil {
		return nil, err
	}

	return progress, nil
}

func (r *EnrollmentRepo) GetCourseProgress(userID, courseID int64) (*domain.CourseProgress, error) {
	var totalLessons int
	if err := r.db.QueryRow(`
		SELECT COUNT(*)
		FROM lessons l
		JOIN course_modules m ON m.id = l.module_id
		WHERE m.course_id=$1
	`, courseID).Scan(&totalLessons); err != nil {
		return nil, err
	}

	rows, err := r.db.Query(`
		SELECT lesson_id
		FROM lesson_progress
		WHERE user_id=$1 AND course_id=$2
		ORDER BY completed_at ASC, lesson_id ASC
	`, userID, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	completedLessons := make([]int64, 0, 16)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		completedLessons = append(completedLessons, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	progressValue := 0
	if totalLessons > 0 {
		progressValue = int((len(completedLessons) * 100) / totalLessons)
	}

	return &domain.CourseProgress{
		UserID:           userID,
		CourseID:         courseID,
		CompletedLessons: completedLessons,
		Progress:         progressValue,
	}, nil
}

func (r *EnrollmentRepo) SubmitLessonWork(studentID, courseID, lessonID int64, fileName, fileURL, studentNote string) (*domain.LessonSubmission, error) {
	var enrolled bool
	if err := r.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM enrollments WHERE user_id=$1 AND course_id=$2)`, studentID, courseID).Scan(&enrolled); err != nil {
		return nil, err
	}
	if !enrolled {
		return nil, errors.New("student is not enrolled in this course")
	}

	var teacherID int64
	err := r.db.QueryRow(`
		SELECT c.teacher_id
		FROM courses c
		JOIN course_modules m ON m.course_id = c.id
		JOIN lessons l ON l.module_id = m.id
		WHERE c.id=$1 AND l.id=$2
	`, courseID, lessonID).Scan(&teacherID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("lesson not found in this course")
		}
		return nil, err
	}

	var submission domain.LessonSubmission
	var status string
	err = r.db.QueryRow(`
		INSERT INTO lesson_submissions(
			course_id, lesson_id, student_id, teacher_id, file_name, file_url, student_note, review_note, status, attempt_count, created_at, updated_at, reviewed_at
		)
		VALUES($1,$2,$3,$4,$5,$6,$7,'','pending',1,NOW(),NOW(),NULL)
		ON CONFLICT(course_id, lesson_id, student_id) DO UPDATE SET
			teacher_id = EXCLUDED.teacher_id,
			file_name = EXCLUDED.file_name,
			file_url = EXCLUDED.file_url,
			student_note = EXCLUDED.student_note,
			review_note = '',
			status = 'pending',
			attempt_count = lesson_submissions.attempt_count + 1,
			updated_at = NOW(),
			reviewed_at = NULL
		RETURNING id, course_id, lesson_id, student_id, teacher_id, file_name, file_url, student_note, review_note, status, attempt_count, created_at, updated_at, reviewed_at
	`, courseID, lessonID, studentID, teacherID, fileName, fileURL, studentNote).Scan(
		&submission.ID,
		&submission.CourseID,
		&submission.LessonID,
		&submission.StudentID,
		&submission.TeacherID,
		&submission.FileName,
		&submission.FileURL,
		&submission.StudentNote,
		&submission.ReviewNote,
		&status,
		&submission.AttemptCount,
		&submission.CreatedAt,
		&submission.UpdatedAt,
		&submission.ReviewedAt,
	)
	if err != nil {
		return nil, err
	}
	submission.Status = domain.LessonSubmissionStatus(status)
	return &submission, nil
}

func (r *EnrollmentRepo) ListTeacherCourseSubmissions(teacherID, courseID int64, status domain.LessonSubmissionStatus) ([]domain.LessonSubmission, error) {
	var courseTeacherID int64
	err := r.db.QueryRow(`SELECT teacher_id FROM courses WHERE id=$1`, courseID).Scan(&courseTeacherID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("course not found")
		}
		return nil, err
	}
	if courseTeacherID != teacherID {
		return nil, errors.New("forbidden: course does not belong to teacher")
	}

	query := `
		SELECT s.id, s.course_id, s.lesson_id, s.student_id, COALESCE(u.name, ''), COALESCE(u.email, ''), s.teacher_id,
		       s.file_name, s.file_url, s.student_note, s.review_note, s.status, s.attempt_count, s.created_at, s.updated_at, s.reviewed_at
		FROM lesson_submissions s
		LEFT JOIN users u ON u.id = s.student_id
		WHERE s.course_id=$1
	`
	args := []any{courseID}
	if status != "" {
		query += ` AND s.status=$2`
		args = append(args, string(status))
	}
	query += ` ORDER BY s.updated_at DESC, s.id DESC`

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	submissions := make([]domain.LessonSubmission, 0, 16)
	for rows.Next() {
		submission, err := scanSubmissionRow(rows)
		if err != nil {
			return nil, err
		}
		submissions = append(submissions, submission)
	}
	return submissions, rows.Err()
}

func (r *EnrollmentRepo) ListStudentCourseSubmissions(studentID, courseID int64) ([]domain.LessonSubmission, error) {
	rows, err := r.db.Query(`
		SELECT s.id, s.course_id, s.lesson_id, s.student_id, COALESCE(u.name, ''), COALESCE(u.email, ''), s.teacher_id,
		       s.file_name, s.file_url, s.student_note, s.review_note, s.status, s.attempt_count, s.created_at, s.updated_at, s.reviewed_at
		FROM lesson_submissions s
		LEFT JOIN users u ON u.id = s.student_id
		WHERE s.student_id=$1 AND s.course_id=$2
		ORDER BY s.updated_at DESC, s.id DESC
	`, studentID, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	submissions := make([]domain.LessonSubmission, 0, 16)
	for rows.Next() {
		submission, err := scanSubmissionRow(rows)
		if err != nil {
			return nil, err
		}
		submissions = append(submissions, submission)
	}
	return submissions, rows.Err()
}

func (r *EnrollmentRepo) GetTeacherCourseSubmissionByID(teacherID, courseID, submissionID int64) (*domain.LessonSubmission, error) {
	row := r.db.QueryRow(`
		SELECT s.id, s.course_id, s.lesson_id, s.student_id, COALESCE(u.name, ''), COALESCE(u.email, ''), s.teacher_id,
		       s.file_name, s.file_url, s.student_note, s.review_note, s.status, s.attempt_count, s.created_at, s.updated_at, s.reviewed_at
		FROM lesson_submissions s
		LEFT JOIN users u ON u.id = s.student_id
		WHERE s.id=$1 AND s.course_id=$2 AND s.teacher_id=$3
	`, submissionID, courseID, teacherID)

	submission, err := scanSubmissionQueryRow(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("submission not found")
		}
		return nil, err
	}
	return submission, nil
}

func (r *EnrollmentRepo) ReviewLessonSubmissionByTeacher(teacherID, courseID, submissionID int64, status domain.LessonSubmissionStatus, reviewNote string) (*domain.LessonSubmission, error) {
	var submission domain.LessonSubmission
	var statusValue string
	err := r.db.QueryRow(`
		UPDATE lesson_submissions
		SET status=$1, review_note=$2, reviewed_at=NOW(), updated_at=NOW()
		WHERE id=$3 AND course_id=$4 AND teacher_id=$5
		RETURNING id, course_id, lesson_id, student_id, teacher_id, file_name, file_url, student_note, review_note, status, attempt_count, created_at, updated_at, reviewed_at
	`, string(status), reviewNote, submissionID, courseID, teacherID).Scan(
		&submission.ID,
		&submission.CourseID,
		&submission.LessonID,
		&submission.StudentID,
		&submission.TeacherID,
		&submission.FileName,
		&submission.FileURL,
		&submission.StudentNote,
		&submission.ReviewNote,
		&statusValue,
		&submission.AttemptCount,
		&submission.CreatedAt,
		&submission.UpdatedAt,
		&submission.ReviewedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("submission not found")
		}
		return nil, err
	}
	submission.Status = domain.LessonSubmissionStatus(statusValue)
	return &submission, nil
}

func scanSubmissionRow(rows *sql.Rows) (domain.LessonSubmission, error) {
	var submission domain.LessonSubmission
	var status string
	if err := rows.Scan(
		&submission.ID,
		&submission.CourseID,
		&submission.LessonID,
		&submission.StudentID,
		&submission.StudentName,
		&submission.StudentEmail,
		&submission.TeacherID,
		&submission.FileName,
		&submission.FileURL,
		&submission.StudentNote,
		&submission.ReviewNote,
		&status,
		&submission.AttemptCount,
		&submission.CreatedAt,
		&submission.UpdatedAt,
		&submission.ReviewedAt,
	); err != nil {
		return domain.LessonSubmission{}, err
	}
	submission.Status = domain.LessonSubmissionStatus(status)
	return submission, nil
}

func scanSubmissionQueryRow(row *sql.Row) (*domain.LessonSubmission, error) {
	var submission domain.LessonSubmission
	var status string
	if err := row.Scan(
		&submission.ID,
		&submission.CourseID,
		&submission.LessonID,
		&submission.StudentID,
		&submission.StudentName,
		&submission.StudentEmail,
		&submission.TeacherID,
		&submission.FileName,
		&submission.FileURL,
		&submission.StudentNote,
		&submission.ReviewNote,
		&status,
		&submission.AttemptCount,
		&submission.CreatedAt,
		&submission.UpdatedAt,
		&submission.ReviewedAt,
	); err != nil {
		return nil, err
	}
	submission.Status = domain.LessonSubmissionStatus(status)
	return &submission, nil
}
