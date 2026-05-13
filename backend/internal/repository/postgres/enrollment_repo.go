package postgres

import (
	"database/sql"
	"encoding/json"
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

func (r *EnrollmentRepo) ListCourseStudentsByTeacher(teacherID, courseID int64) ([]domain.User, error) {
	var courseTeacherID int64
	if err := r.db.QueryRow(`SELECT teacher_id FROM courses WHERE id=$1`, courseID).Scan(&courseTeacherID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("course not found")
		}
		return nil, err
	}
	if courseTeacherID != teacherID {
		return nil, errors.New("forbidden: course does not belong to teacher")
	}

	rows, err := r.db.Query(`
		SELECT u.id, u.public_id, u.name, u.email, u.role, u.blocked, u.avatar_url
		FROM enrollments e
		JOIN users u ON u.id = e.user_id
		WHERE e.course_id=$1
		ORDER BY u.name ASC, u.id ASC
	`, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	students := make([]domain.User, 0, 16)
	for rows.Next() {
		var user domain.User
		if err := rows.Scan(&user.ID, &user.PublicID, &user.Name, &user.Email, &user.Role, &user.Blocked, &user.AvatarURL); err != nil {
			return nil, err
		}
		students = append(students, user)
	}
	return students, rows.Err()
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

func (r *EnrollmentRepo) CountStudentLessonTestAttempts(studentID, lessonID int64) (int, error) {
	var count int
	if err := r.db.QueryRow(
		`SELECT COUNT(*) FROM lesson_test_attempts WHERE student_id=$1 AND lesson_id=$2`,
		studentID,
		lessonID,
	).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *EnrollmentRepo) CreateLessonTestAttempt(attempt *domain.LessonTestAttempt) error {
	questionPayload, err := json.Marshal(attempt.Questions)
	if err != nil {
		return err
	}

	var submittedAt any
	if attempt.SubmittedAt != nil {
		submittedAt = *attempt.SubmittedAt
	}

	return r.db.QueryRow(`
		INSERT INTO lesson_test_attempts(
			course_id, lesson_id, student_id, attempt_number, max_attempts, pass_score, time_limit_sec,
			total_questions, correct_answers, score, passed, duration_sec,
			question_payload, answer_payload, result_payload, started_at, submitted_at
		)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'[]'::jsonb,'[]'::jsonb,$14,$15)
		RETURNING id
	`,
		attempt.CourseID,
		attempt.LessonID,
		attempt.StudentID,
		attempt.AttemptNumber,
		attempt.MaxAttempts,
		attempt.PassScore,
		attempt.TimeLimitSec,
		attempt.TotalQuestions,
		attempt.CorrectAnswers,
		attempt.Score,
		attempt.Passed,
		attempt.DurationSec,
		questionPayload,
		attempt.StartedAt,
		submittedAt,
	).Scan(&attempt.ID)
}

func (r *EnrollmentRepo) GetStudentLessonTestAttemptByID(studentID, courseID, lessonID, attemptID int64) (*domain.LessonTestAttempt, error) {
	row := r.db.QueryRow(`
		SELECT id, course_id, lesson_id, student_id, attempt_number, max_attempts, pass_score, time_limit_sec,
		       total_questions, correct_answers, score, passed, duration_sec,
		       question_payload, answer_payload, result_payload, started_at, submitted_at
		FROM lesson_test_attempts
		WHERE id=$1 AND student_id=$2 AND course_id=$3 AND lesson_id=$4
	`,
		attemptID,
		studentID,
		courseID,
		lessonID,
	)

	attempt, err := scanLessonTestAttemptRow(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("test attempt not found")
		}
		return nil, err
	}
	return attempt, nil
}

func (r *EnrollmentRepo) SubmitLessonTestAttempt(attempt *domain.LessonTestAttempt) error {
	answersPayload, err := json.Marshal(attempt.Answers)
	if err != nil {
		return err
	}
	resultsPayload, err := json.Marshal(attempt.Results)
	if err != nil {
		return err
	}

	var submittedAt any
	if attempt.SubmittedAt != nil {
		submittedAt = *attempt.SubmittedAt
	}

	_, err = r.db.Exec(`
		UPDATE lesson_test_attempts
		SET total_questions=$1,
		    correct_answers=$2,
		    score=$3,
		    passed=$4,
		    duration_sec=$5,
		    answer_payload=$6,
		    submitted_at=$7,
		    result_payload=$8
		WHERE id=$9
	`,
		attempt.TotalQuestions,
		attempt.CorrectAnswers,
		attempt.Score,
		attempt.Passed,
		attempt.DurationSec,
		answersPayload,
		submittedAt,
		resultsPayload,
		attempt.ID,
	)
	return err
}

func (r *EnrollmentRepo) ListStudentLessonTestAttempts(studentID, courseID, lessonID int64) ([]domain.LessonTestAttempt, error) {
	rows, err := r.db.Query(`
		SELECT id, course_id, lesson_id, student_id, attempt_number, max_attempts, pass_score, time_limit_sec,
		       total_questions, correct_answers, score, passed, duration_sec,
		       question_payload, answer_payload, result_payload, started_at, submitted_at
		FROM lesson_test_attempts
		WHERE student_id=$1 AND course_id=$2 AND lesson_id=$3 AND submitted_at IS NOT NULL
		ORDER BY attempt_number DESC
	`, studentID, courseID, lessonID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.LessonTestAttempt, 0, 8)
	for rows.Next() {
		attempt, err := scanLessonTestAttemptRows(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, attempt)
	}
	return out, rows.Err()
}

func (r *EnrollmentRepo) ListTeacherLessonTestAttempts(teacherID, courseID, lessonID int64) ([]domain.LessonTestAttempt, error) {
	var courseTeacherID int64
	if err := r.db.QueryRow(`SELECT teacher_id FROM courses WHERE id=$1`, courseID).Scan(&courseTeacherID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("course not found")
		}
		return nil, err
	}
	if courseTeacherID != teacherID {
		return nil, errors.New("forbidden: course does not belong to teacher")
	}
	return r.listLessonTestAttemptsWithStudent(courseID, lessonID)
}

func (r *EnrollmentRepo) ListAdminLessonTestAttempts(courseID, lessonID int64) ([]domain.LessonTestAttempt, error) {
	var exists bool
	if err := r.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM courses WHERE id=$1)`, courseID).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, errors.New("course not found")
	}
	return r.listLessonTestAttemptsWithStudent(courseID, lessonID)
}

func (r *EnrollmentRepo) ResetStudentLessonTestResultsByTeacher(teacherID, courseID, lessonID, studentID int64) error {
	var courseTeacherID int64
	if err := r.db.QueryRow(`SELECT teacher_id FROM courses WHERE id=$1`, courseID).Scan(&courseTeacherID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("course not found")
		}
		return err
	}
	if courseTeacherID != teacherID {
		return errors.New("forbidden: course does not belong to teacher")
	}
	return r.resetStudentLessonTestResults(courseID, lessonID, studentID)
}

func (r *EnrollmentRepo) ResetStudentLessonTestResultsByAdmin(courseID, lessonID, studentID int64) error {
	var exists bool
	if err := r.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM courses WHERE id=$1)`, courseID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return errors.New("course not found")
	}
	return r.resetStudentLessonTestResults(courseID, lessonID, studentID)
}

func (r *EnrollmentRepo) resetStudentLessonTestResults(courseID, lessonID, studentID int64) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var lessonInCourse bool
	if err := tx.QueryRow(`
		SELECT EXISTS(
			SELECT 1
			FROM lessons l
			JOIN course_modules m ON m.id = l.module_id
			WHERE l.id=$1 AND m.course_id=$2
		)
	`, lessonID, courseID).Scan(&lessonInCourse); err != nil {
		return err
	}
	if !lessonInCourse {
		return errors.New("lesson not found in this course")
	}

	if _, err := tx.Exec(`
		DELETE FROM lesson_test_attempts
		WHERE course_id=$1 AND lesson_id=$2 AND student_id=$3
	`, courseID, lessonID, studentID); err != nil {
		return err
	}

	if _, err := tx.Exec(`
		DELETE FROM lesson_progress
		WHERE user_id=$1 AND course_id=$2 AND lesson_id=$3
	`, studentID, courseID, lessonID); err != nil {
		return err
	}

	var totalLessons int
	if err := tx.QueryRow(`
		SELECT COUNT(*)
		FROM lessons l
		JOIN course_modules m ON m.id = l.module_id
		WHERE m.course_id=$1
	`, courseID).Scan(&totalLessons); err != nil {
		return err
	}

	var completedLessons int
	if err := tx.QueryRow(`
		SELECT COUNT(*)
		FROM lesson_progress
		WHERE user_id=$1 AND course_id=$2
	`, studentID, courseID).Scan(&completedLessons); err != nil {
		return err
	}

	progress := 0
	if totalLessons > 0 {
		progress = int((completedLessons * 100) / totalLessons)
	}
	completed := progress >= 100

	if _, err := tx.Exec(`
		UPDATE enrollments
		SET progress=$1, completed=$2
		WHERE user_id=$3 AND course_id=$4
	`, progress, completed, studentID, courseID); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *EnrollmentRepo) listLessonTestAttemptsWithStudent(courseID, lessonID int64) ([]domain.LessonTestAttempt, error) {
	rows, err := r.db.Query(`
		SELECT a.id, a.course_id, a.lesson_id, a.student_id, COALESCE(u.name,''), COALESCE(u.email,''),
		       a.attempt_number, a.max_attempts, a.pass_score, a.time_limit_sec,
		       a.total_questions, a.correct_answers, a.score, a.passed, a.duration_sec,
		       a.question_payload, a.answer_payload, a.result_payload, a.started_at, a.submitted_at
		FROM lesson_test_attempts a
		LEFT JOIN users u ON u.id = a.student_id
		WHERE a.course_id=$1 AND a.lesson_id=$2 AND a.submitted_at IS NOT NULL
		ORDER BY a.submitted_at DESC NULLS LAST, a.attempt_number DESC
	`, courseID, lessonID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.LessonTestAttempt, 0, 16)
	for rows.Next() {
		attempt, err := scanLessonTestAttemptRowsWithStudent(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, attempt)
	}
	return out, rows.Err()
}

func scanLessonTestAttemptRows(rows *sql.Rows) (domain.LessonTestAttempt, error) {
	var attempt domain.LessonTestAttempt
	var questionsPayload []byte
	var answersPayload []byte
	var resultsPayload []byte
	if err := rows.Scan(
		&attempt.ID,
		&attempt.CourseID,
		&attempt.LessonID,
		&attempt.StudentID,
		&attempt.AttemptNumber,
		&attempt.MaxAttempts,
		&attempt.PassScore,
		&attempt.TimeLimitSec,
		&attempt.TotalQuestions,
		&attempt.CorrectAnswers,
		&attempt.Score,
		&attempt.Passed,
		&attempt.DurationSec,
		&questionsPayload,
		&answersPayload,
		&resultsPayload,
		&attempt.StartedAt,
		&attempt.SubmittedAt,
	); err != nil {
		return domain.LessonTestAttempt{}, err
	}
	if err := decodeAttemptPayload(&attempt, questionsPayload, answersPayload, resultsPayload); err != nil {
		return domain.LessonTestAttempt{}, err
	}
	return attempt, nil
}

func scanLessonTestAttemptRowsWithStudent(rows *sql.Rows) (domain.LessonTestAttempt, error) {
	var attempt domain.LessonTestAttempt
	var questionsPayload []byte
	var answersPayload []byte
	var resultsPayload []byte
	if err := rows.Scan(
		&attempt.ID,
		&attempt.CourseID,
		&attempt.LessonID,
		&attempt.StudentID,
		&attempt.StudentName,
		&attempt.StudentEmail,
		&attempt.AttemptNumber,
		&attempt.MaxAttempts,
		&attempt.PassScore,
		&attempt.TimeLimitSec,
		&attempt.TotalQuestions,
		&attempt.CorrectAnswers,
		&attempt.Score,
		&attempt.Passed,
		&attempt.DurationSec,
		&questionsPayload,
		&answersPayload,
		&resultsPayload,
		&attempt.StartedAt,
		&attempt.SubmittedAt,
	); err != nil {
		return domain.LessonTestAttempt{}, err
	}
	if err := decodeAttemptPayload(&attempt, questionsPayload, answersPayload, resultsPayload); err != nil {
		return domain.LessonTestAttempt{}, err
	}
	return attempt, nil
}

func scanLessonTestAttemptRow(row *sql.Row) (*domain.LessonTestAttempt, error) {
	var attempt domain.LessonTestAttempt
	var questionsPayload []byte
	var answersPayload []byte
	var resultsPayload []byte
	if err := row.Scan(
		&attempt.ID,
		&attempt.CourseID,
		&attempt.LessonID,
		&attempt.StudentID,
		&attempt.AttemptNumber,
		&attempt.MaxAttempts,
		&attempt.PassScore,
		&attempt.TimeLimitSec,
		&attempt.TotalQuestions,
		&attempt.CorrectAnswers,
		&attempt.Score,
		&attempt.Passed,
		&attempt.DurationSec,
		&questionsPayload,
		&answersPayload,
		&resultsPayload,
		&attempt.StartedAt,
		&attempt.SubmittedAt,
	); err != nil {
		return nil, err
	}
	if err := decodeAttemptPayload(&attempt, questionsPayload, answersPayload, resultsPayload); err != nil {
		return nil, err
	}
	return &attempt, nil
}

func decodeAttemptPayload(attempt *domain.LessonTestAttempt, questionsPayload, answersPayload, resultsPayload []byte) error {
	if len(questionsPayload) > 0 && string(questionsPayload) != "null" {
		_ = json.Unmarshal(questionsPayload, &attempt.Questions)
	}
	if len(answersPayload) > 0 && string(answersPayload) != "null" {
		if err := json.Unmarshal(answersPayload, &attempt.Answers); err != nil {
			return err
		}
	}
	if len(resultsPayload) > 0 && string(resultsPayload) != "null" {
		if err := json.Unmarshal(resultsPayload, &attempt.Results); err != nil {
			return err
		}
	}
	return nil
}
