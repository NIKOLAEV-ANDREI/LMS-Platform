package sqlite

import (
	"database/sql"
	"errors"
	"lms-backend/internal/domain"
)

type CourseRepo struct {
	db *sql.DB
}

func NewCourseRepo(db *sql.DB) *CourseRepo { return &CourseRepo{db: db} }

func (r *CourseRepo) Create(course *domain.Course) error {
	res, err := r.db.Exec(
		`INSERT INTO courses(public_id,title,description,teacher_id,status) VALUES(?,?,?,?,?)`,
		course.PublicID, course.Title, course.Description, course.TeacherID, course.Status,
	)
	if err != nil {
		return err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	course.ID = id
	return nil
}

func (r *CourseRepo) ListApproved() ([]domain.Course, error) {
	return r.listByQuery(`SELECT id,public_id,title,description,teacher_id,status FROM courses WHERE status='approved' ORDER BY id DESC`)
}

func (r *CourseRepo) SearchApproved(query, searchBy string) ([]domain.Course, error) {
	return nil, errors.New("not implemented")
}

func (r *CourseRepo) ListByTeacher(teacherID int64) ([]domain.Course, error) {
	rows, err := r.db.Query(`SELECT id,public_id,title,description,teacher_id,status FROM courses WHERE teacher_id=? ORDER BY id DESC`, teacherID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCourses(rows)
}

func (r *CourseRepo) ListAll() ([]domain.Course, error) {
	return r.listByQuery(`SELECT id,public_id,title,description,teacher_id,status FROM courses ORDER BY id DESC`)
}

func (r *CourseRepo) Approve(courseID int64) error {
	_, err := r.db.Exec(`UPDATE courses SET status='approved' WHERE id=?`, courseID)
	return err
}

func (r *CourseRepo) PermanentlyDeleteCourse(courseID int64) error {
	return errors.New("not implemented")
}

func (r *CourseRepo) listByQuery(q string) ([]domain.Course, error) {
	rows, err := r.db.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanCourses(rows)
}

func scanCourses(rows *sql.Rows) ([]domain.Course, error) {
	var courses []domain.Course
	for rows.Next() {
		var c domain.Course
		if err := rows.Scan(&c.ID, &c.PublicID, &c.Title, &c.Description, &c.TeacherID, &c.Status); err != nil {
			return nil, err
		}
		courses = append(courses, c)
	}
	return courses, rows.Err()
}
