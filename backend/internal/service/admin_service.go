package service

import (
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"lms-backend/internal/domain"
	"lms-backend/internal/repository"
)

type AdminService struct {
	users   repository.UserRepository
	courses repository.CourseRepository
}

func NewAdminService(users repository.UserRepository, courses repository.CourseRepository) *AdminService {
	return &AdminService{users: users, courses: courses}
}

func (s *AdminService) CreateUser(name, email, password string, role domain.Role) (*domain.User, error) {
	name = strings.TrimSpace(name)
	email = strings.TrimSpace(strings.ToLower(email))
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
	if role != domain.RoleStudent && role != domain.RoleTeacher && role != domain.RoleAdmin {
		return nil, errors.New("invalid role")
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
	publicID, err := generatePublicID()
	if err != nil {
		return nil, err
	}

	user := &domain.User{
		Name:         name,
		Email:        email,
		PasswordHash: string(hash),
		Role:         role,
		PublicID:     publicID,
	}
	if err := s.users.Create(user); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *AdminService) ListUsers() ([]domain.User, error) { return s.users.List() }

func (s *AdminService) BlockUser(id int64, blocked bool) error {
	if blocked {
		teacherCourses, err := s.courses.ListByTeacher(id)
		if err != nil {
			return err
		}
		for _, course := range teacherCourses {
			if course.Status != "approved" {
				continue
			}
			if err := s.courses.SetStatus(course.ID, "pending"); err != nil {
				return err
			}
		}
	}
	return s.users.SetBlocked(id, blocked)
}

func (s *AdminService) SetRole(id int64, role domain.Role) error {
	if role != domain.RoleStudent && role != domain.RoleTeacher && role != domain.RoleAdmin {
		return errors.New("invalid role")
	}
	return s.users.SetRole(id, role)
}

func (s *AdminService) ApproveCourse(courseID int64) error { return s.courses.Approve(courseID) }

func (s *AdminService) AllCourses() ([]domain.Course, error) { return s.courses.ListAll() }

func (s *AdminService) UserByID(id int64) (*domain.User, error) {
	return s.users.ByID(id)
}

func (s *AdminService) UserByPublicID(publicID string) (*domain.User, error) {
	return s.users.ByPublicID(publicID)
}

func (s *AdminService) UpdateUserProfile(id int64, name, email, password string, avatarURL *string, removeAvatar bool) error {
	user, err := s.users.ByID(id)
	if err != nil {
		return err
	}
	if user == nil {
		return errors.New("user not found")
	}

	name = strings.TrimSpace(name)
	email = strings.TrimSpace(strings.ToLower(email))
	password = strings.TrimSpace(password)
	if name == "" {
		name = user.Name
	}
	if email == "" {
		email = user.Email
	}
	if err := validateUserName(name); err != nil {
		return err
	}
	if err := validateEmail(email); err != nil {
		return err
	}
	if err := validateOptionalPassword(password); err != nil {
		return err
	}

	if email != user.Email {
		existing, err := s.users.ByEmail(email)
		if err != nil {
			return err
		}
		if existing != nil && existing.ID != id {
			return errors.New("email already exists")
		}
	}

	if err := s.users.UpdateProfile(id, name, email); err != nil {
		return err
	}

	if password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		if err := s.users.SetPasswordHash(id, string(hash)); err != nil {
			return err
		}
	}

	if removeAvatar {
		if err := s.users.SetAvatar(id, ""); err != nil {
			return err
		}
	} else if avatarURL != nil {
		normalizedAvatarURL, err := normalizeAvatarURL(*avatarURL)
		if err != nil {
			return err
		}
		if err := s.users.SetAvatar(id, normalizedAvatarURL); err != nil {
			return err
		}
	}
	return nil
}

func normalizeAvatarURL(avatarURL string) (string, error) {
	avatarURL = strings.TrimSpace(avatarURL)
	if err := validateAvatarURL(avatarURL); err != nil {
		return "", err
	}
	return avatarURL, nil
}
