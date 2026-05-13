package service

import (
	"errors"
	"fmt"
	"lms-backend/internal/domain"
	"regexp"
	"sort"
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

	MaxQuestionIDLen       = 64
	MaxQuestionTextLen     = 500
	MaxQuestionOptionLen   = 200
	MinQuestionOptions     = 2
	MaxQuestionOptions     = 8
	MinTestPassScore       = 1
	MaxTestPassScore       = 100
	MinTestAttempts        = 1
	MaxTestAttempts        = 20
	MaxTestTimeLimitSec    = 300 * 60
	MaxTestRandomQuestions = 100

	MaxAvatarURLLen = 2_000_000

	MaxSubmissionFileNameLen = 180
	MaxSubmissionFileURLLen  = 20_000_000
	MaxSubmissionStudentNote = 1500
	MaxSubmissionTeacherNote = 2000
)

var emailRegex = regexp.MustCompile(`^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$`)

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
	email = strings.TrimSpace(email)
	if err := ensureRequired("email", email); err != nil {
		return err
	}
	if err := ensureMaxLen("email", email, MaxEmailLen); err != nil {
		return err
	}
	if !emailRegex.MatchString(email) {
		return errors.New("invalid email format")
	}
	return nil
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
	settings := normalizeLessonTestSettings(test.Settings, len(test.Questions))
	if settings.PassScore < MinTestPassScore || settings.PassScore > MaxTestPassScore {
		return fmt.Errorf("test pass score must be %d..%d", MinTestPassScore, MaxTestPassScore)
	}
	if settings.MaxAttempts < MinTestAttempts || settings.MaxAttempts > MaxTestAttempts {
		return fmt.Errorf("test max attempts must be %d..%d", MinTestAttempts, MaxTestAttempts)
	}
	if settings.TimeLimitSec < 0 || settings.TimeLimitSec > MaxTestTimeLimitSec {
		return fmt.Errorf("test time limit must be 0..%d seconds", MaxTestTimeLimitSec)
	}
	maxRandomQuestions := len(test.Questions)
	if maxRandomQuestions > MaxTestRandomQuestions {
		maxRandomQuestions = MaxTestRandomQuestions
	}
	if settings.RandomQuestionCount < 0 || settings.RandomQuestionCount > maxRandomQuestions {
		return fmt.Errorf("test random question count must be 0..%d", maxRandomQuestions)
	}
	test.Settings = settings

	for i := range test.Questions {
		question := &test.Questions[i]
		question.Type = strings.TrimSpace(question.Type)
		question.Question = strings.TrimSpace(question.Question)
		if question.Type == "" {
			question.Type = "single"
		}
		if question.Type != "single" && question.Type != "multiple" && question.Type != "open" && question.Type != "true_false" {
			return fmt.Errorf("question %d type must be single, multiple, open or true_false", i+1)
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
		if question.Type == "open" {
			question.CorrectText = strings.TrimSpace(question.CorrectText)
			if err := ensureRequired(fmt.Sprintf("question %d correct text", i+1), question.CorrectText); err != nil {
				return err
			}
			if err := ensureMaxLen(fmt.Sprintf("question %d correct text", i+1), question.CorrectText, MaxQuestionOptionLen); err != nil {
				return err
			}
			question.Options = nil
			question.CorrectAnswer = nil
			question.CorrectAnswers = nil
			continue
		}

		if question.Type == "true_false" && len(question.Options) == 0 {
			question.Options = []string{"Верно", "Неверно"}
		}
		if question.Type == "true_false" && len(question.Options) != 2 {
			return fmt.Errorf("question %d options count must be 2..2", i+1)
		}

		if len(question.Options) < MinQuestionOptions || len(question.Options) > MaxQuestionOptions {
			return fmt.Errorf("question %d options count must be %d..%d", i+1, MinQuestionOptions, MaxQuestionOptions)
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
		if question.Type == "multiple" {
			if len(question.CorrectAnswers) == 0 {
				return fmt.Errorf("question %d must have at least 1 correct option", i+1)
			}
			seen := make(map[int]struct{}, len(question.CorrectAnswers))
			for _, index := range question.CorrectAnswers {
				if index < 0 || index >= len(question.Options) {
					return fmt.Errorf("question %d has invalid correct option index", i+1)
				}
				seen[index] = struct{}{}
			}
			normalized := make([]int, 0, len(seen))
			for index := range seen {
				normalized = append(normalized, index)
			}
			sort.Ints(normalized)
			question.CorrectAnswers = normalized
			question.CorrectAnswer = nil
		} else {
			if question.CorrectAnswer == nil {
				return fmt.Errorf("question %d must have correct answer", i+1)
			}
			if *question.CorrectAnswer < 0 || *question.CorrectAnswer >= len(question.Options) {
				return fmt.Errorf("question %d has invalid correct answer index", i+1)
			}
			question.CorrectAnswers = nil
		}
		question.CorrectText = ""
	}
	return nil
}

func normalizeLessonTestSettings(settings domain.LessonTestSettings, questionCount int) domain.LessonTestSettings {
	if settings.PassScore == 0 {
		settings.PassScore = 70
	}
	if settings.MaxAttempts == 0 {
		settings.MaxAttempts = 3
	}
	maxRandomQuestions := questionCount
	if maxRandomQuestions > MaxTestRandomQuestions {
		maxRandomQuestions = MaxTestRandomQuestions
	}
	if settings.RandomQuestionCount < 0 || settings.RandomQuestionCount > maxRandomQuestions {
		settings.RandomQuestionCount = maxRandomQuestions
	}
	if settings.RandomQuestionCount == 0 {
		settings.RandomQuestionCount = questionCount
	}
	return settings
}

func validateLessonSubmissionPayload(fileName, fileURL, studentNote string) error {
	fileName = strings.TrimSpace(fileName)
	fileURL = strings.TrimSpace(fileURL)
	studentNote = strings.TrimSpace(studentNote)

	if err := ensureRequired("submission file name", fileName); err != nil {
		return err
	}
	if err := ensureMaxLen("submission file name", fileName, MaxSubmissionFileNameLen); err != nil {
		return err
	}
	if err := ensureRequired("submission file url", fileURL); err != nil {
		return err
	}
	if err := ensureMaxLen("submission file url", fileURL, MaxSubmissionFileURLLen); err != nil {
		return err
	}
	if err := ensureMaxLen("submission note", studentNote, MaxSubmissionStudentNote); err != nil {
		return err
	}
	if !strings.HasPrefix(fileURL, "data:") && !strings.HasPrefix(fileURL, "https://") && !strings.HasPrefix(fileURL, "http://") {
		return errors.New("submission file has invalid format")
	}
	return nil
}

func validateTeacherReviewNote(reviewNote string) error {
	return ensureMaxLen("review note", strings.TrimSpace(reviewNote), MaxSubmissionTeacherNote)
}
