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
			avatar_url TEXT NOT NULL DEFAULT '',
			created_by_admin_id BIGINT REFERENCES users(id)
		);`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_admin_id BIGINT REFERENCES users(id);`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;`,
		`UPDATE users SET blocked_at = NOW() WHERE blocked = TRUE AND blocked_at IS NULL;`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS public_id TEXT;`,
		`UPDATE users
		 SET public_id = md5(random()::text || clock_timestamp()::text || id::text)
		 WHERE public_id IS NULL OR public_id = '';`,
		`ALTER TABLE users ALTER COLUMN public_id SET NOT NULL;`,
		`CREATE UNIQUE INDEX IF NOT EXISTS users_public_id_idx ON users(public_id);`,
		`CREATE TABLE IF NOT EXISTS courses (
			id BIGSERIAL PRIMARY KEY,
			title TEXT NOT NULL,
			description TEXT NOT NULL,
			teacher_id BIGINT NOT NULL REFERENCES users(id),
			status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
			access_password_hash TEXT NOT NULL DEFAULT ''
		);`,
		`ALTER TABLE courses ADD COLUMN IF NOT EXISTS access_password_hash TEXT NOT NULL DEFAULT '';`,
		`ALTER TABLE courses ADD COLUMN IF NOT EXISTS public_id TEXT;`,
		`UPDATE courses
		 SET public_id = md5(random()::text || clock_timestamp()::text || id::text)
		 WHERE public_id IS NULL OR public_id = '';`,
		`ALTER TABLE courses ALTER COLUMN public_id SET NOT NULL;`,
		`CREATE UNIQUE INDEX IF NOT EXISTS courses_public_id_idx ON courses(public_id);`,
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
			requires_review BOOLEAN NOT NULL DEFAULT FALSE,
			test_data JSONB,
			attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
			sort_order INTEGER NOT NULL DEFAULT 0
		);`,
		`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS test_data JSONB;`,
		`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS requires_review BOOLEAN NOT NULL DEFAULT FALSE;`,
		`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;`,
		`CREATE TABLE IF NOT EXISTS lesson_progress (
			user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
			lesson_id BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
			completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY(user_id, course_id, lesson_id)
		);`,
		`CREATE TABLE IF NOT EXISTS lesson_submissions (
			id BIGSERIAL PRIMARY KEY,
			course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
			lesson_id BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
			student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			file_name TEXT NOT NULL,
			file_url TEXT NOT NULL,
			student_note TEXT NOT NULL DEFAULT '',
			review_note TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
			attempt_count INTEGER NOT NULL DEFAULT 1,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			reviewed_at TIMESTAMPTZ,
			UNIQUE(course_id, lesson_id, student_id)
		);`,
		`ALTER TABLE lesson_submissions ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1;`,
		`CREATE TABLE IF NOT EXISTS lesson_test_attempts (
			id BIGSERIAL PRIMARY KEY,
			course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
			lesson_id BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
			student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			attempt_number INTEGER NOT NULL,
			max_attempts INTEGER NOT NULL DEFAULT 3,
			pass_score INTEGER NOT NULL DEFAULT 70,
			time_limit_sec INTEGER NOT NULL DEFAULT 0,
			total_questions INTEGER NOT NULL DEFAULT 0,
			correct_answers INTEGER NOT NULL DEFAULT 0,
			score INTEGER NOT NULL DEFAULT 0,
			passed BOOLEAN NOT NULL DEFAULT FALSE,
			duration_sec INTEGER NOT NULL DEFAULT 0,
			question_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
			answer_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
			result_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
			started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			submitted_at TIMESTAMPTZ,
			UNIQUE(student_id, lesson_id, attempt_number)
		);`,
		`ALTER TABLE lesson_test_attempts ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3;`,
		`ALTER TABLE lesson_test_attempts ADD COLUMN IF NOT EXISTS pass_score INTEGER NOT NULL DEFAULT 70;`,
		`ALTER TABLE lesson_test_attempts ADD COLUMN IF NOT EXISTS time_limit_sec INTEGER NOT NULL DEFAULT 0;`,
		`ALTER TABLE lesson_test_attempts ADD COLUMN IF NOT EXISTS total_questions INTEGER NOT NULL DEFAULT 0;`,
		`ALTER TABLE lesson_test_attempts ADD COLUMN IF NOT EXISTS correct_answers INTEGER NOT NULL DEFAULT 0;`,
		`ALTER TABLE lesson_test_attempts ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;`,
		`ALTER TABLE lesson_test_attempts ADD COLUMN IF NOT EXISTS passed BOOLEAN NOT NULL DEFAULT FALSE;`,
		`ALTER TABLE lesson_test_attempts ADD COLUMN IF NOT EXISTS duration_sec INTEGER NOT NULL DEFAULT 0;`,
		`ALTER TABLE lesson_test_attempts ADD COLUMN IF NOT EXISTS question_payload JSONB NOT NULL DEFAULT '[]'::jsonb;`,
		`ALTER TABLE lesson_test_attempts ADD COLUMN IF NOT EXISTS answer_payload JSONB NOT NULL DEFAULT '[]'::jsonb;`,
		`ALTER TABLE lesson_test_attempts ADD COLUMN IF NOT EXISTS result_payload JSONB NOT NULL DEFAULT '[]'::jsonb;`,
		`ALTER TABLE lesson_test_attempts ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`,
		`ALTER TABLE lesson_test_attempts ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;`,
		`CREATE INDEX IF NOT EXISTS lesson_test_attempts_lesson_student_idx ON lesson_test_attempts(lesson_id, student_id);`,
		`CREATE INDEX IF NOT EXISTS lesson_test_attempts_course_idx ON lesson_test_attempts(course_id);`,
		`CREATE TABLE IF NOT EXISTS admin_audit_logs (
			id BIGSERIAL PRIMARY KEY,
			actor_user_id BIGINT,
			target_user_id BIGINT,
			target_type TEXT NOT NULL DEFAULT '',
			action TEXT NOT NULL,
			result TEXT NOT NULL DEFAULT 'success',
			details TEXT NOT NULL DEFAULT '',
			ip TEXT NOT NULL DEFAULT '',
			user_agent TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);`,
		`ALTER TABLE admin_audit_logs ALTER COLUMN actor_user_id DROP NOT NULL;`,
		`ALTER TABLE admin_audit_logs ALTER COLUMN target_user_id DROP NOT NULL;`,
		`ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT '';`,
		`ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT 'success';`,
		`ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS ip TEXT NOT NULL DEFAULT '';`,
		`ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT NOT NULL DEFAULT '';`,
		`CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_idx ON admin_audit_logs(actor_user_id, created_at DESC);`,
		`CREATE INDEX IF NOT EXISTS admin_audit_logs_target_idx ON admin_audit_logs(target_user_id, created_at DESC);`,
	}

	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			return err
		}
	}
	return nil
}
