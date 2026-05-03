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
		`INSERT INTO users(name,email,password_hash,role,blocked,avatar_url) VALUES($1,$2,$3,$4,false,$5) RETURNING id`,
		user.Name, user.Email, user.PasswordHash, user.Role, user.AvatarURL,
	).Scan(&user.ID)
}

func (r *UserRepo) ByEmail(email string) (*domain.User, error) {
	var u domain.User
	err := r.db.QueryRow(`SELECT id,name,email,password_hash,role,blocked,avatar_url FROM users WHERE email = $1`, email).
		Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.Blocked, &u.AvatarURL)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (r *UserRepo) ByID(id int64) (*domain.User, error) {
	var u domain.User
	err := r.db.QueryRow(`SELECT id,name,email,password_hash,role,blocked,avatar_url FROM users WHERE id = $1`, id).
		Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.Blocked, &u.AvatarURL)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
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
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.Blocked, &u.AvatarURL); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *UserRepo) SetBlocked(id int64, blocked bool) error {
	_, err := r.db.Exec(`UPDATE users SET blocked = $1 WHERE id = $2`, blocked, id)
	return err
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
