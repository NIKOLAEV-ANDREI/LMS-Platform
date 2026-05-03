package sqlite

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
	res, err := r.db.Exec(
		`INSERT INTO users(name,email,password_hash,role,blocked,avatar_url) VALUES(?,?,?,?,0,?)`,
		user.Name,
		user.Email,
		user.PasswordHash,
		user.Role,
		user.AvatarURL,
	)
	if err != nil {
		return err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	user.ID = id
	return nil
}

func (r *UserRepo) ByEmail(email string) (*domain.User, error) {
	var u domain.User
	var blocked int
	err := r.db.QueryRow(`SELECT id,name,email,password_hash,role,blocked,avatar_url FROM users WHERE email = ?`, email).
		Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &blocked, &u.AvatarURL)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	u.Blocked = blocked == 1
	return &u, nil
}

func (r *UserRepo) ByID(id int64) (*domain.User, error) {
	var u domain.User
	var blocked int
	err := r.db.QueryRow(`SELECT id,name,email,password_hash,role,blocked,avatar_url FROM users WHERE id = ?`, id).
		Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &blocked, &u.AvatarURL)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	u.Blocked = blocked == 1
	return &u, nil
}

func (r *UserRepo) List() ([]domain.User, error) {
	rows, err := r.db.Query(`SELECT id,name,email,password_hash,role,blocked,avatar_url FROM users ORDER BY id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []domain.User
	for rows.Next() {
		var u domain.User
		var blocked int
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &blocked, &u.AvatarURL); err != nil {
			return nil, err
		}
		u.Blocked = blocked == 1
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *UserRepo) SetBlocked(id int64, blocked bool) error {
	v := 0
	if blocked {
		v = 1
	}
	_, err := r.db.Exec(`UPDATE users SET blocked = ? WHERE id = ?`, v, id)
	return err
}

func (r *UserRepo) SetRole(id int64, role domain.Role) error {
	_, err := r.db.Exec(`UPDATE users SET role = ? WHERE id = ?`, role, id)
	return err
}

func (r *UserRepo) UpdateProfile(id int64, name, email string) error {
	_, err := r.db.Exec(`UPDATE users SET name = ?, email = ? WHERE id = ?`, name, email, id)
	return err
}

func (r *UserRepo) SetPasswordHash(id int64, passwordHash string) error {
	_, err := r.db.Exec(`UPDATE users SET password_hash = ? WHERE id = ?`, passwordHash, id)
	return err
}

func (r *UserRepo) SetAvatar(id int64, avatarURL string) error {
	_, err := r.db.Exec(`UPDATE users SET avatar_url = ? WHERE id = ?`, avatarURL, id)
	return err
}
