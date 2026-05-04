package db

import "database/sql"

func Migrate(db *sql.DB) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id BIGSERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL CHECK(role IN ('student','teacher','admin')),
			blocked BOOLEAN NOT NULL DEFAULT FALSE,
			avatar_url TEXT NOT NULL DEFAULT ''
		);`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';`,
		`CREATE TABLE IF NOT EXISTS courses (
			id BIGSERIAL PRIMARY KEY,
			title TEXT NOT NULL,
			description TEXT NOT NULL,
			teacher_id BIGINT NOT NULL REFERENCES users(id),
			status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
			access_password_hash TEXT NOT NULL DEFAULT ''
		);`,
		`ALTER TABLE courses ADD COLUMN IF NOT EXISTS access_password_hash TEXT NOT NULL DEFAULT '';`,
		`CREATE TABLE IF NOT EXISTS enrollments (
			user_id BIGINT NOT NULL REFERENCES users(id),
			course_id BIGINT NOT NULL REFERENCES courses(id),
			progress INTEGER NOT NULL DEFAULT 0,
			completed BOOLEAN NOT NULL DEFAULT FALSE,
			PRIMARY KEY(user_id, course_id)
		);`,
		`CREATE TABLE IF NOT EXISTS course_modules (
			id BIGSERIAL PRIMARY KEY,
			course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
			title TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			sort_order INTEGER NOT NULL DEFAULT 0
		);`,
		`CREATE TABLE IF NOT EXISTS lessons (
			id BIGSERIAL PRIMARY KEY,
			module_id BIGINT NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
			title TEXT NOT NULL,
			content TEXT NOT NULL DEFAULT '',
			lesson_type TEXT NOT NULL CHECK(lesson_type IN ('text','video','test')),
			video_url TEXT NOT NULL DEFAULT '',
			test_data JSONB,
			attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
			sort_order INTEGER NOT NULL DEFAULT 0
		);`,
		`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS test_data JSONB;`,
		`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;`,
		`CREATE TABLE IF NOT EXISTS lesson_progress (
			user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
			lesson_id BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
			completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY(user_id, course_id, lesson_id)
		);`,
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}
