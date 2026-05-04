package service

import (
	"errors"
	"fmt"
	"lms-backend/internal/domain"
	"strings"
	"unicode/utf8"
)

const (
	MinPasswordLen = 6
	MaxPasswordLen = 128

	MaxUserNameLen = 30
	MaxEmailLen    = 254

	MaxCourseTitleLen       = 120
	MaxCourseDescriptionLen = 2000
	MinCoursePasswordLen    = 4
	MaxCoursePasswordLen    = 10

	MaxModuleTitleLen       = 120
	MaxModuleDescriptionLen = 1500

	MaxLessonTitleLen   = 150
	MaxLessonContentLen = 10000
	MaxVideoURLLen      = 2048
	MaxLessonFilesCount = 5
	MaxLessonFileName   = 180
	MaxLessonFileType   = 120
	MaxLessonFileSize   = 15 * 1024 * 1024
	MaxLessonFileURLLen = 20_000_000

	MaxQuestionIDLen     = 64
	MaxQuestionTextLen   = 500
	MaxQuestionOptionLen = 200

	MaxAvatarURLLen = 2_000_000
)

func runeCount(value string) int {
	return utf8.RuneCountInString(value)
}

func ensureRequired(field, value string) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("%s is required", field)
	}
	return nil
}

func ensureMaxLen(field, value string, max int) error {
	if runeCount(value) > max {
		return fmt.Errorf("%s is too long (max %d chars)", field, max)
	}
	return nil
}

func ensureMinLen(field, value string, min int) error {
	if runeCount(value) < min {
		return fmt.Errorf("%s is too short (min %d chars)", field, min)
	}
	return nil
}

func validateUserName(name string) error {
	if err := ensureRequired("name", name); err != nil {
		return err
	}
	return ensureMaxLen("name", name, MaxUserNameLen)
}

func validateEmail(email string) error {
	if err := ensureRequired("email", email); err != nil {
		return err
	}
	return ensureMaxLen("email", email, MaxEmailLen)
}

func validatePassword(password string) error {
	if err := ensureRequired("password", password); err != nil {
		return err
	}
	if err := ensureMinLen("password", password, MinPasswordLen); err != nil {
		return err
	}
	return ensureMaxLen("password", password, MaxPasswordLen)
}

func validateOptionalPassword(password string) error {
	if strings.TrimSpace(password) == "" {
		return nil
	}
	return validatePassword(password)
}

func validateCoursePayload(title, description string) error {
	if err := ensureRequired("title", title); err != nil {
		return err
	}
	if err := ensureRequired("description", description); err != nil {
		return err
	}
	if err := ensureMaxLen("title", title, MaxCourseTitleLen); err != nil {
		return err
	}
	return ensureMaxLen("description", description, MaxCourseDescriptionLen)
}

func validateCourseAccessPassword(password string) error {
	password = strings.TrimSpace(password)
	if err := ensureRequired("course password", password); err != nil {
		return err
	}
	if err := ensureMinLen("course password", password, MinCoursePasswordLen); err != nil {
		return err
	}
	return ensureMaxLen("course password", password, MaxCoursePasswordLen)
}

func validateModulePayload(title, description string) error {
	if err := ensureRequired("module title", title); err != nil {
		return err
	}
	if err := ensureMaxLen("module title", title, MaxModuleTitleLen); err != nil {
		return err
	}
	return ensureMaxLen("module description", description, MaxModuleDescriptionLen)
}

func validateLessonCommon(title, content, videoURL string) error {
	if err := ensureRequired("lesson title", title); err != nil {
		return err
	}
	if err := ensureMaxLen("lesson title", title, MaxLessonTitleLen); err != nil {
		return err
	}
	if err := ensureMaxLen("lesson content", content, MaxLessonContentLen); err != nil {
		return err
	}
	return ensureMaxLen("video url", videoURL, MaxVideoURLLen)
}

func validateLessonAttachments(lessonType string, attachments []domain.LessonAttachment) error {
	if len(attachments) == 0 {
		return nil
	}
	if lessonType != "text" && lessonType != "video" {
		return errors.New("attachments are allowed only for text and video lessons")
	}
	if len(attachments) > MaxLessonFilesCount {
		return fmt.Errorf("too many attachments (max %d)", MaxLessonFilesCount)
	}
	for index := range attachments {
		attachment := &attachments[index]
		attachment.ID = strings.TrimSpace(attachment.ID)
		attachment.Name = strings.TrimSpace(attachment.Name)
		attachment.ContentType = strings.TrimSpace(attachment.ContentType)
		attachment.URL = strings.TrimSpace(attachment.URL)

		if err := ensureRequired(fmt.Sprintf("attachment %d id", index+1), attachment.ID); err != nil {
			return err
		}
		if err := ensureMaxLen(fmt.Sprintf("attachment %d id", index+1), attachment.ID, MaxQuestionIDLen); err != nil {
			return err
		}
		if err := ensureRequired(fmt.Sprintf("attachment %d name", index+1), attachment.Name); err != nil {
			return err
		}
		if err := ensureMaxLen(fmt.Sprintf("attachment %d name", index+1), attachment.Name, MaxLessonFileName); err != nil {
			return err
		}
		if err := ensureRequired(fmt.Sprintf("attachment %d content type", index+1), attachment.ContentType); err != nil {
			return err
		}
		if err := ensureMaxLen(fmt.Sprintf("attachment %d content type", index+1), attachment.ContentType, MaxLessonFileType); err != nil {
			return err
		}
		if attachment.Size < 0 || attachment.Size > MaxLessonFileSize {
			return fmt.Errorf("attachment %d size must be 0..%d bytes", index+1, MaxLessonFileSize)
		}
		if err := ensureRequired(fmt.Sprintf("attachment %d url", index+1), attachment.URL); err != nil {
			return err
		}
		if err := ensureMaxLen(fmt.Sprintf("attachment %d url", index+1), attachment.URL, MaxLessonFileURLLen); err != nil {
			return err
		}
		if !strings.HasPrefix(attachment.URL, "data:") && !strings.HasPrefix(attachment.URL, "https://") && !strings.HasPrefix(attachment.URL, "http://") {
			return fmt.Errorf("attachment %d has invalid url format", index+1)
		}
	}
	return nil
}

func validateAvatarURL(avatarURL string) error {
	avatarURL = strings.TrimSpace(avatarURL)
	if avatarURL == "" {
		return nil
	}
	if runeCount(avatarURL) > MaxAvatarURLLen {
		return errors.New("avatar is too large")
	}
	allowedPrefixes := []string{"data:image/", "https://", "http://"}
	for _, prefix := range allowedPrefixes {
		if strings.HasPrefix(avatarURL, prefix) {
			return nil
		}
	}
	return errors.New("invalid avatar format")
}

func validateLessonTestData(test *domain.LessonTest) error {
	if test == nil || len(test.Questions) == 0 {
		return errors.New("test lesson must have at least one question")
	}
	for i := range test.Questions {
		question := &test.Questions[i]
		question.Type = strings.TrimSpace(question.Type)
		question.Question = strings.TrimSpace(question.Question)
		if question.Type == "" {
			question.Type = "single"
		}
		if question.Type != "single" && question.Type != "multiple" && question.Type != "open" {
			return fmt.Errorf("question %d type must be single, multiple or open", i+1)
		}
		if err := ensureMaxLen("question id", question.ID, MaxQuestionIDLen); err != nil {
			return err
		}
		if err := ensureRequired(fmt.Sprintf("question %d text", i+1), question.Question); err != nil {
			return err
		}
		if err := ensureMaxLen(fmt.Sprintf("question %d text", i+1), question.Question, MaxQuestionTextLen); err != nil {
			return err
		}
		if question.Type != "open" {
			if len(question.Options) < 2 {
				return fmt.Errorf("question %d must have at least 2 options", i+1)
			}
			for optionIndex := range question.Options {
				question.Options[optionIndex] = strings.TrimSpace(question.Options[optionIndex])
				if err := ensureRequired(fmt.Sprintf("question %d option %d", i+1, optionIndex+1), question.Options[optionIndex]); err != nil {
					return err
				}
				if err := ensureMaxLen(
					fmt.Sprintf("question %d option %d", i+1, optionIndex+1),
					question.Options[optionIndex],
					MaxQuestionOptionLen,
				); err != nil {
					return err
				}
			}
		}
	}
	return nil
}
