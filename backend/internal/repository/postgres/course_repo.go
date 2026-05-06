package postgres

import (
	"database/sql"
	"encoding/json"
	"errors"
	"lms-backend/internal/domain"
	"strings"
)

type CourseRepo struct {
	db *sql.DB
}

func NewCourseRepo(db *sql.DB) *CourseRepo { return &CourseRepo{db: db} }

func (r *CourseRepo) Create(course *domain.Course) error {
	return r.db.QueryRow(
		`INSERT INTO courses(public_id,title,description,teacher_id,status) VALUES($1,$2,$3,$4,$5) RETURNING id,public_id`,
		course.PublicID, course.Title, course.Description, course.TeacherID, course.Status,
	).Scan(&course.ID, &course.PublicID)
}

func (r *CourseRepo) ByID(courseID int64) (*domain.Course, error) {
	var c domain.Course
	var accessPasswordHash string
	err := r.db.QueryRow(
		`SELECT c.id,c.public_id,c.title,c.description,c.teacher_id,COALESCE(u.public_id,''),COALESCE(u.name,''),c.status,c.access_password_hash
		 FROM courses c
		 LEFT JOIN users u ON u.id = c.teacher_id
		 WHERE c.id=$1`,
		courseID,
	).Scan(&c.ID, &c.PublicID, &c.Title, &c.Description, &c.TeacherID, &c.TeacherPublicID, &c.TeacherName, &c.Status, &accessPasswordHash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	c.AccessPasswordHash = accessPasswordHash
	c.HasPassword = accessPasswordHash != ""

	modules, err := r.loadModules(c.ID)
	if err != nil {
		return nil, err
	}
	c.Modules = modules
	enrolledStudents, err := r.loadEnrolledStudents(c.ID)
	if err != nil {
		return nil, err
	}
	c.EnrolledStudents = enrolledStudents
	return &c, nil
}

func (r *CourseRepo) ListApproved() ([]domain.Course, error) {
	courses, err := r.listByQuery(`SELECT c.id,c.public_id,c.title,c.description,c.teacher_id,COALESCE(u.public_id,''),COALESCE(u.name,''),c.status,c.access_password_hash
		FROM courses c
		LEFT JOIN users u ON u.id = c.teacher_id
		WHERE c.status='approved' AND c.status <> 'rejected'
		ORDER BY c.id DESC`)
	if err != nil {
		return nil, err
	}
	return r.enrichCoursesWithModules(courses)
}

func (r *CourseRepo) SearchApproved(query, searchBy string) ([]domain.Course, error) {
	query = strings.TrimSpace(query)
	searchBy = strings.TrimSpace(strings.ToLower(searchBy))
	if searchBy == "" {
		searchBy = "all"
	}

	base := `SELECT c.id,c.public_id,c.title,c.description,c.teacher_id,COALESCE(u.public_id,''),COALESCE(u.name,''),c.status,c.access_password_hash
		FROM courses c
		LEFT JOIN users u ON u.id = c.teacher_id
		WHERE c.status='approved' AND c.status <> 'rejected'`

	args := []any{}
	conditions := []string{}
	if query != "" {
		like := "%" + query + "%"
		switch searchBy {
		case "id":
			conditions = append(conditions, `(CAST(c.id AS TEXT) ILIKE $1 OR c.public_id ILIKE $1)`)
			args = append(args, like)
		case "title":
			conditions = append(conditions, `c.title ILIKE $1`)
			args = append(args, like)
		case "teacher":
			conditions = append(conditions, `u.name ILIKE $1`)
			args = append(args, like)
		default:
			conditions = append(conditions, `(CAST(c.id AS TEXT) ILIKE $1 OR c.public_id ILIKE $1 OR c.title ILIKE $1 OR u.name ILIKE $1)`)
			args = append(args, like)
		}
	}

	sqlQuery := base
	if len(conditions) > 0 {
		sqlQuery += " AND " + strings.Join(conditions, " AND ")
	}
	sqlQuery += " ORDER BY c.id DESC"

	rows, err := r.db.Query(sqlQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	courses, err := scanCourses(rows)
	if err != nil {
		return nil, err
	}
	return r.enrichCoursesWithModules(courses)
}

func (r *CourseRepo) ListByTeacher(teacherID int64) ([]domain.Course, error) {
	rows, err := r.db.Query(`SELECT c.id,c.public_id,c.title,c.description,c.teacher_id,COALESCE(u.public_id,''),COALESCE(u.name,''),c.status,c.access_password_hash
		FROM courses c
		LEFT JOIN users u ON u.id = c.teacher_id
		WHERE c.teacher_id=$1 AND c.status <> 'rejected'
		ORDER BY c.id DESC`, teacherID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	courses, err := scanCourses(rows)
	if err != nil {
		return nil, err
	}
	return r.enrichCoursesWithModules(courses)
}

func (r *CourseRepo) ListDeletedByTeacher(teacherID int64) ([]domain.Course, error) {
	rows, err := r.db.Query(`SELECT c.id,c.public_id,c.title,c.description,c.teacher_id,COALESCE(u.public_id,''),COALESCE(u.name,''),c.status,c.access_password_hash
		FROM courses c
		LEFT JOIN users u ON u.id = c.teacher_id
		WHERE c.teacher_id=$1 AND c.status='rejected'
		ORDER BY c.id DESC`, teacherID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	courses, err := scanCourses(rows)
	if err != nil {
		return nil, err
	}
	return r.enrichCoursesWithModules(courses)
}

func (r *CourseRepo) ListAll() ([]domain.Course, error) {
	courses, err := r.listByQuery(`SELECT c.id,c.public_id,c.title,c.description,c.teacher_id,COALESCE(u.public_id,''),COALESCE(u.name,''),c.status,c.access_password_hash
		FROM courses c
		LEFT JOIN users u ON u.id = c.teacher_id
		ORDER BY c.id DESC`)
	if err != nil {
		return nil, err
	}
	return r.enrichCoursesWithModules(courses)
}

func (r *CourseRepo) Approve(courseID int64) error {
	_, err := r.db.Exec(`UPDATE courses SET status='approved' WHERE id=$1`, courseID)
	return err
}

func (r *CourseRepo) SetStatus(courseID int64, status string) error {
	_, err := r.db.Exec(`UPDATE courses SET status=$1 WHERE id=$2`, status, courseID)
	return err
}

func (r *CourseRepo) UpdateCourse(course *domain.Course) error {
	_, err := r.db.Exec(`UPDATE courses SET title=$1, description=$2 WHERE id=$3`, course.Title, course.Description, course.ID)
	return err
}

func (r *CourseRepo) DeleteCourse(courseID int64) error {
	_, err := r.db.Exec(`UPDATE courses SET status='rejected' WHERE id=$1`, courseID)
	return err
}

func (r *CourseRepo) AddModule(module *domain.Module) error {
	var nextOrder int
	if err := r.db.QueryRow(`SELECT COALESCE(MAX(sort_order), -1) + 1 FROM course_modules WHERE course_id=$1`, module.CourseID).Scan(&nextOrder); err != nil {
		return err
	}
	module.Order = nextOrder
	return r.db.QueryRow(
		`INSERT INTO course_modules(course_id,title,description,sort_order) VALUES($1,$2,$3,$4) RETURNING id`,
		module.CourseID, module.Title, module.Description, module.Order,
	).Scan(&module.ID)
}

func (r *CourseRepo) UpdateModule(module *domain.Module) error {
	_, err := r.db.Exec(
		`UPDATE course_modules SET title=$1, description=$2 WHERE id=$3`,
		module.Title, module.Description, module.ID,
	)
	return err
}

func (r *CourseRepo) DeleteModule(moduleID int64) error {
	_, err := r.db.Exec(`DELETE FROM course_modules WHERE id=$1`, moduleID)
	return err
}

func (r *CourseRepo) AddLesson(lesson *domain.Lesson) error {
	var nextOrder int
	if err := r.db.QueryRow(`SELECT COALESCE(MAX(sort_order), -1) + 1 FROM lessons WHERE module_id=$1`, lesson.ModuleID).Scan(&nextOrder); err != nil {
		return err
	}
	lesson.Order = nextOrder

	testData, err := json.Marshal(lesson.Test)
	if err != nil {
		return err
	}
	attachmentsData, err := json.Marshal(lesson.Attachments)
	if err != nil {
		return err
	}

	return r.db.QueryRow(
		`INSERT INTO lessons(module_id,title,content,lesson_type,video_url,requires_review,test_data,attachments,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
		lesson.ModuleID, lesson.Title, lesson.Content, lesson.Type, lesson.VideoURL, lesson.RequiresReview, testData, attachmentsData, lesson.Order,
	).Scan(&lesson.ID)
}

func (r *CourseRepo) UpdateLesson(lesson *domain.Lesson) error {
	testData, err := json.Marshal(lesson.Test)
	if err != nil {
		return err
	}
	attachmentsData, err := json.Marshal(lesson.Attachments)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(
		`UPDATE lessons SET title=$1, content=$2, lesson_type=$3, video_url=$4, requires_review=$5, test_data=$6, attachments=$7 WHERE id=$8`,
		lesson.Title, lesson.Content, lesson.Type, lesson.VideoURL, lesson.RequiresReview, testData, attachmentsData, lesson.ID,
	)
	return err
}

func (r *CourseRepo) DeleteLesson(lessonID int64) error {
	_, err := r.db.Exec(`DELETE FROM lessons WHERE id=$1`, lessonID)
	return err
}

func (r *CourseRepo) SetAccessPasswordHash(courseID int64, passwordHash string) error {
	_, err := r.db.Exec(`UPDATE courses SET access_password_hash=$1 WHERE id=$2`, passwordHash, courseID)
	return err
}

func (r *CourseRepo) ClearAccessPassword(courseID int64) error {
	_, err := r.db.Exec(`UPDATE courses SET access_password_hash='' WHERE id=$1`, courseID)
	return err
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
		var accessPasswordHash string
		if err := rows.Scan(&c.ID, &c.PublicID, &c.Title, &c.Description, &c.TeacherID, &c.TeacherPublicID, &c.TeacherName, &c.Status, &accessPasswordHash); err != nil {
			return nil, err
		}
		c.AccessPasswordHash = accessPasswordHash
		c.HasPassword = accessPasswordHash != ""
		courses = append(courses, c)
	}
	return courses, rows.Err()
}

func (r *CourseRepo) enrichCoursesWithModules(courses []domain.Course) ([]domain.Course, error) {
	for i := range courses {
		modules, err := r.loadModules(courses[i].ID)
		if err != nil {
			return nil, err
		}
		courses[i].Modules = modules

		enrolledStudents, err := r.loadEnrolledStudents(courses[i].ID)
		if err != nil {
			return nil, err
		}
		courses[i].EnrolledStudents = enrolledStudents
	}
	return courses, nil
}

func (r *CourseRepo) loadModules(courseID int64) ([]domain.Module, error) {
	rows, err := r.db.Query(
		`SELECT id,course_id,title,description,sort_order FROM course_modules WHERE course_id=$1 ORDER BY sort_order ASC, id ASC`,
		courseID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var modules []domain.Module
	for rows.Next() {
		var m domain.Module
		if err := rows.Scan(&m.ID, &m.CourseID, &m.Title, &m.Description, &m.Order); err != nil {
			return nil, err
		}
		lessons, err := r.loadLessons(m.ID)
		if err != nil {
			return nil, err
		}
		m.Lessons = lessons
		modules = append(modules, m)
	}
	return modules, rows.Err()
}

func (r *CourseRepo) loadLessons(moduleID int64) ([]domain.Lesson, error) {
	rows, err := r.db.Query(
		`SELECT id,module_id,title,content,lesson_type,video_url,requires_review,test_data,attachments,sort_order FROM lessons WHERE module_id=$1 ORDER BY sort_order ASC, id ASC`,
		moduleID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lessons []domain.Lesson
	for rows.Next() {
		var l domain.Lesson
		var testData []byte
		var attachmentsData []byte
		if err := rows.Scan(&l.ID, &l.ModuleID, &l.Title, &l.Content, &l.Type, &l.VideoURL, &l.RequiresReview, &testData, &attachmentsData, &l.Order); err != nil {
			return nil, err
		}
		if len(testData) > 0 && string(testData) != "null" && string(testData) != "{}" {
			var test domain.LessonTest
			if err := json.Unmarshal(testData, &test); err != nil {
				return nil, err
			}
			l.Test = &test
		}
		if len(attachmentsData) > 0 && string(attachmentsData) != "null" {
			var attachments []domain.LessonAttachment
			if err := json.Unmarshal(attachmentsData, &attachments); err != nil {
				return nil, err
			}
			l.Attachments = attachments
		}
		lessons = append(lessons, l)
	}
	return lessons, rows.Err()
}

func (r *CourseRepo) loadEnrolledStudents(courseID int64) ([]int64, error) {
	rows, err := r.db.Query(`SELECT user_id FROM enrollments WHERE course_id=$1 ORDER BY user_id ASC`, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	studentIDs := make([]int64, 0)
	for rows.Next() {
		var userID int64
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		studentIDs = append(studentIDs, userID)
	}
	return studentIDs, rows.Err()
}
