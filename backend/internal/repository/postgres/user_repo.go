package postgres

import (
	"database/sql"
	"errors"
	"lms-backend/internal/domain"
)

type UserRepo struct {
	db *sql.DB
}

func NewUserRepo(db *sql.DB) *UserRepo { return &UserRepo{db: db} }

func (r *UserRepo) Create(user *domain.User) error {
	return r.db.QueryRow(
		`INSERT INTO users(name,email,password_hash,role,blocked,avatar_url,public_id,created_by_admin_id) VALUES($1,$2,$3,$4,false,$5,$6,$7) RETURNING id`,
		user.Name, user.Email, user.PasswordHash, user.Role, user.AvatarURL, user.PublicID, user.CreatedByAdminID,
	).Scan(&user.ID)
}

func (r *UserRepo) ByEmail(email string) (*domain.User, error) {
	var u domain.User
	var createdByAdminID sql.NullInt64
	var blockedAt sql.NullTime
	err := r.db.QueryRow(`SELECT id,public_id,name,email,password_hash,role,blocked,blocked_at,avatar_url,created_by_admin_id FROM users WHERE email = $1`, email).
		Scan(&u.ID, &u.PublicID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.Blocked, &blockedAt, &u.AvatarURL, &createdByAdminID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if blockedAt.Valid {
		u.BlockedAt = &blockedAt.Time
	}
	if createdByAdminID.Valid {
		u.CreatedByAdminID = &createdByAdminID.Int64
	}
	return &u, nil
}

func (r *UserRepo) ByID(id int64) (*domain.User, error) {
	var u domain.User
	var createdByAdminID sql.NullInt64
	var blockedAt sql.NullTime
	err := r.db.QueryRow(`SELECT id,public_id,name,email,password_hash,role,blocked,blocked_at,avatar_url,created_by_admin_id FROM users WHERE id = $1`, id).
		Scan(&u.ID, &u.PublicID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.Blocked, &blockedAt, &u.AvatarURL, &createdByAdminID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if blockedAt.Valid {
		u.BlockedAt = &blockedAt.Time
	}
	if createdByAdminID.Valid {
		u.CreatedByAdminID = &createdByAdminID.Int64
	}
	return &u, nil
}

func (r *UserRepo) ByPublicID(publicID string) (*domain.User, error) {
	var u domain.User
	var createdByAdminID sql.NullInt64
	var blockedAt sql.NullTime
	err := r.db.QueryRow(`SELECT id,public_id,name,email,password_hash,role,blocked,blocked_at,avatar_url,created_by_admin_id FROM users WHERE public_id = $1`, publicID).
		Scan(&u.ID, &u.PublicID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.Blocked, &blockedAt, &u.AvatarURL, &createdByAdminID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if blockedAt.Valid {
		u.BlockedAt = &blockedAt.Time
	}
	if createdByAdminID.Valid {
		u.CreatedByAdminID = &createdByAdminID.Int64
	}
	return &u, nil
}

func (r *UserRepo) List() ([]domain.User, error) {
	rows, err := r.db.Query(`SELECT id,public_id,name,email,password_hash,role,blocked,blocked_at,avatar_url,created_by_admin_id FROM users ORDER BY id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []domain.User
	for rows.Next() {
		var u domain.User
		var createdByAdminID sql.NullInt64
		var blockedAt sql.NullTime
		if err := rows.Scan(&u.ID, &u.PublicID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.Blocked, &blockedAt, &u.AvatarURL, &createdByAdminID); err != nil {
			return nil, err
		}
		if blockedAt.Valid {
			u.BlockedAt = &blockedAt.Time
		}
		if createdByAdminID.Valid {
			u.CreatedByAdminID = &createdByAdminID.Int64
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *UserRepo) SetBlocked(id int64, blocked bool) error {
	_, err := r.db.Exec(`
		UPDATE users
		SET blocked = $1,
		    blocked_at = CASE
		        WHEN $1 THEN COALESCE(blocked_at, NOW())
		        ELSE NULL
		    END
		WHERE id = $2
	`, blocked, id)
	return err
}

func (r *UserRepo) GetPermanentDeleteConstraints(id int64) (*domain.UserPermanentDeleteConstraints, error) {
	constraints := &domain.UserPermanentDeleteConstraints{}
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM courses WHERE teacher_id = $1 AND status <> 'rejected'`, id).Scan(&constraints.ActiveCourses); err != nil {
		return nil, err
	}
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM courses WHERE teacher_id = $1 AND status = 'rejected'`, id).Scan(&constraints.DeletedCourses); err != nil {
		return nil, err
	}
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM enrollments WHERE user_id = $1`, id).Scan(&constraints.Enrollments); err != nil {
		return nil, err
	}
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM lesson_submissions WHERE teacher_id = $1 AND status = 'pending'`, id).Scan(&constraints.PendingTeacherSubmissions); err != nil {
		return nil, err
	}
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM lesson_submissions WHERE student_id = $1 AND status = 'pending'`, id).Scan(&constraints.PendingStudentSubmissions); err != nil {
		return nil, err
	}
	if err := r.db.QueryRow(`SELECT COUNT(*) FROM users WHERE created_by_admin_id = $1`, id).Scan(&constraints.CreatedAdmins); err != nil {
		return nil, err
	}
	return constraints, nil
}

func (r *UserRepo) PermanentlyDeleteWithAudit(targetUserID, actorUserID int64, action, details string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec(
		`INSERT INTO admin_audit_logs(actor_user_id,target_user_id,target_type,action,result,details,ip,user_agent,created_at)
		 VALUES($1,$2,'user',$3,'success',$4,'','',NOW())`,
		actorUserID,
		targetUserID,
		action,
		details,
	); err != nil {
		return err
	}

	if _, err := tx.Exec(`DELETE FROM enrollments WHERE user_id = $1`, targetUserID); err != nil {
		return err
	}

	result, err := tx.Exec(`DELETE FROM users WHERE id = $1`, targetUserID)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("user not found")
	}

	return tx.Commit()
}

func (r *UserRepo) SetRole(id int64, role domain.Role) error {
	_, err := r.db.Exec(`UPDATE users SET role = $1 WHERE id = $2`, role, id)
	return err
}

func (r *UserRepo) UpdateProfile(id int64, name, email string) error {
	_, err := r.db.Exec(`UPDATE users SET name = $1, email = $2 WHERE id = $3`, name, email, id)
	return err
}

func (r *UserRepo) SetPasswordHash(id int64, passwordHash string) error {
	_, err := r.db.Exec(`UPDATE users SET password_hash = $1 WHERE id = $2`, passwordHash, id)
	return err
}

func (r *UserRepo) SetAvatar(id int64, avatarURL string) error {
	_, err := r.db.Exec(`UPDATE users SET avatar_url = $1 WHERE id = $2`, avatarURL, id)
	return err
}
