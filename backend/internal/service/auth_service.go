package service

import (
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"lms-backend/internal/domain"
	"lms-backend/internal/repository"
	jwtpkg "lms-backend/pkg/auth"
)

type AuthService struct {
	users     repository.UserRepository
	jwtSecret string
}

func NewAuthService(users repository.UserRepository, jwtSecret string) *AuthService {
	return &AuthService{users: users, jwtSecret: jwtSecret}
}

func (s *AuthService) Register(name, email, password string, role domain.Role) (*domain.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	name = strings.TrimSpace(name)
	password = strings.TrimSpace(password)
	if err := validateUserName(name); err != nil {
		return nil, err
	}
	if err := validateEmail(email); err != nil {
		return nil, err
	}
	if err := validatePassword(password); err != nil {
		return nil, err
	}
	if role != domain.RoleStudent && role != domain.RoleTeacher {
		return nil, errors.New("public registration allows only student or teacher")
	}
	existing, err := s.users.ByEmail(email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, errors.New("email already exists")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	user := &domain.User{Name: name, Email: email, PasswordHash: string(hash), Role: role}
	if err := s.users.Create(user); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *AuthService) Login(email, password string) (string, *domain.User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	password = strings.TrimSpace(password)
	if err := validateEmail(email); err != nil {
		return "", nil, errors.New("invalid credentials")
	}
	if err := validatePassword(password); err != nil {
		return "", nil, errors.New("invalid credentials")
	}
	user, err := s.users.ByEmail(email)
	if err != nil {
		return "", nil, err
	}
	if user == nil {
		return "", nil, errors.New("invalid credentials")
	}
	if user.Blocked {
		return "", nil, errors.New("user is blocked")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return "", nil, errors.New("invalid credentials")
	}
	token, err := jwtpkg.GenerateToken(user.ID, user.Role, s.jwtSecret)
	if err != nil {
		return "", nil, err
	}
	return token, user, nil
}
