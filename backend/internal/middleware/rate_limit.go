package middleware

import (
	"encoding/json"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type RateLimitRule struct {
	Name     string
	Method   string
	PathHas  string
	Limit    int
	Window   time.Duration
	BlockFor time.Duration
}

type rateLimitState struct {
	WindowStart time.Time
	Count       int
	BlockedTill time.Time
}

type RateLimiter struct {
	mu     sync.Mutex
	states map[string]rateLimitState
	rules  []RateLimitRule
}

func NewDefaultRateLimiter() *RateLimiter {
	return &RateLimiter{
		states: make(map[string]rateLimitState, 256),
		rules: []RateLimitRule{
			{Name: "auth_login", Method: http.MethodPost, PathHas: "/api/auth/login", Limit: 5, Window: time.Minute, BlockFor: 15 * time.Minute},
			{Name: "auth_register", Method: http.MethodPost, PathHas: "/api/auth/register", Limit: 3, Window: 10 * time.Minute, BlockFor: 15 * time.Minute},
			{Name: "submission_upload", Method: http.MethodPost, PathHas: "/submission", Limit: 10, Window: time.Minute},
			{Name: "admin_destructive", Method: http.MethodDelete, PathHas: "/api/admin/users/", Limit: 20, Window: time.Minute},
			{Name: "admin_destructive", Method: http.MethodPatch, PathHas: "/api/admin/users/", Limit: 20, Window: time.Minute},
		},
	}
}

func (rl *RateLimiter) Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rule, ok := rl.matchRule(r.Method, r.URL.Path)
			if !ok {
				next.ServeHTTP(w, r)
				return
			}

			ip := extractClientIP(r)
			key := rule.Name + "|" + ip
			now := time.Now().UTC()

			allowed, retryAfterSec := rl.allow(key, rule, now)
			if !allowed {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", strconv.Itoa(retryAfterSec))
				w.WriteHeader(http.StatusTooManyRequests)
				_ = json.NewEncoder(w).Encode(map[string]string{"error": "rate limit exceeded"})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func (rl *RateLimiter) matchRule(method, path string) (RateLimitRule, bool) {
	for _, rule := range rl.rules {
		if rule.Method != "" && !strings.EqualFold(rule.Method, method) {
			continue
		}
		if rule.PathHas != "" && !strings.Contains(path, rule.PathHas) {
			continue
		}
		return rule, true
	}
	return RateLimitRule{}, false
}

func (rl *RateLimiter) allow(key string, rule RateLimitRule, now time.Time) (bool, int) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	state := rl.states[key]
	if !state.BlockedTill.IsZero() && now.Before(state.BlockedTill) {
		return false, int(time.Until(state.BlockedTill).Seconds()) + 1
	}

	if state.WindowStart.IsZero() || now.Sub(state.WindowStart) >= rule.Window {
		state.WindowStart = now
		state.Count = 0
		state.BlockedTill = time.Time{}
	}

	state.Count++
	if state.Count > rule.Limit {
		if rule.BlockFor > 0 {
			state.BlockedTill = now.Add(rule.BlockFor)
			rl.states[key] = state
			return false, int(rule.BlockFor.Seconds()) + 1
		}
		retry := int(rule.Window.Seconds()-now.Sub(state.WindowStart).Seconds()) + 1
		if retry < 1 {
			retry = 1
		}
		rl.states[key] = state
		return false, retry
	}

	rl.states[key] = state
	return true, 0
}

func extractClientIP(r *http.Request) string {
	xForwardedFor := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if xForwardedFor != "" {
		parts := strings.Split(xForwardedFor, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}

	xRealIP := strings.TrimSpace(r.Header.Get("X-Real-IP"))
	if xRealIP != "" {
		return xRealIP
	}

	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}
