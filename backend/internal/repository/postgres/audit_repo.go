package postgres

import (
	"database/sql"

	"lms-backend/internal/domain"
)

type AuditRepo struct {
	db *sql.DB
}

func NewAuditRepo(db *sql.DB) *AuditRepo { return &AuditRepo{db: db} }

func (r *AuditRepo) Create(entry *domain.AdminAuditLog) error {
	return r.db.QueryRow(`
		INSERT INTO admin_audit_logs(
			actor_user_id, target_type, target_id, action, result, details, ip, user_agent, created_at
		)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW())
		RETURNING id, created_at
	`,
		entry.ActorUserID,
		entry.TargetType,
		entry.TargetID,
		entry.Action,
		entry.Result,
		entry.Details,
		entry.IP,
		entry.UserAgent,
	).Scan(&entry.ID, &entry.CreatedAt)
}
