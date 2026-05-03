package middleware

import (
	"context"
	"net/http"
	"strings"

	"lms-backend/internal/domain"
	jwtpkg "lms-backend/pkg/auth"
)

type ctxKey string

const (
	ctxUserIDKey ctxKey = "user_id"
	ctxRoleKey   ctxKey = "role"
)

func Auth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "missing auth header", http.StatusUnauthorized)
				return
			}
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				http.Error(w, "invalid auth header", http.StatusUnauthorized)
				return
			}
			claims, err := jwtpkg.ParseToken(parts[1], jwtSecret)
			if err != nil {
				http.Error(w, "invalid token", http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), ctxUserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, ctxRoleKey, claims.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireRole(roles ...domain.Role) func(http.Handler) http.Handler {
	set := map[domain.Role]struct{}{}
	for _, r := range roles {
		set[r] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := r.Context().Value(ctxRoleKey).(domain.Role)
			if !ok {
				http.Error(w, "role not found", http.StatusForbidden)
				return
			}
			if _, exists := set[role]; !exists {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func UserIDFromContext(ctx context.Context) int64 {
	id, _ := ctx.Value(ctxUserIDKey).(int64)
	return id
}

func RoleFromContext(ctx context.Context) domain.Role {
	role, _ := ctx.Value(ctxRoleKey).(domain.Role)
	return role
}
