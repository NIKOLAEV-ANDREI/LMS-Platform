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
