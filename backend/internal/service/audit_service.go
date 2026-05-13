package service

import (
	"strings"

	"lms-backend/internal/domain"
	"lms-backend/internal/repository"
)

type AuditService struct {
	repo repository.AuditRepository
}

func NewAuditService(repo repository.AuditRepository) *AuditService {
	return &AuditService{repo: repo}
}

func (s *AuditService) Log(actorUserID *int64, targetType string, targetID *int64, action, result, details, ip, userAgent string) error {
	if s == nil || s.repo == nil {
		return nil
	}
	entry := &domain.AdminAuditLog{
		ActorUserID: actorUserID,
		TargetType:  trimAndCut(targetType, 64),
		TargetID:    targetID,
		Action:      trimAndCut(action, 128),
		Result:      trimAndCut(result, 32),
		Details:     trimAndCut(details, 2000),
		IP:          trimAndCut(ip, 128),
		UserAgent:   trimAndCut(userAgent, 512),
	}
	return s.repo.Create(entry)
}

func trimAndCut(value string, maxLen int) string {
	value = strings.TrimSpace(value)
	if maxLen <= 0 {
		return ""
	}
	if len(value) <= maxLen {
		return value
	}
	return value[:maxLen]
}
