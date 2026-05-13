package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	_ "github.com/jackc/pgx/v5/stdlib"

	"lms-backend/internal/config"
	"lms-backend/internal/db"
	httpHandler "lms-backend/internal/handler/http"
	"lms-backend/internal/middleware"
	postgresRepo "lms-backend/internal/repository/postgres"
	"lms-backend/internal/service"
)

func main() {
	cfg := config.Load()

	database, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer database.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := database.PingContext(ctx); err != nil {
		log.Fatalf("postgres is unavailable, check DATABASE_URL: %v", err)
	}

	if err := db.Migrate(database); err != nil {
		log.Fatalf("migrate db: %v", err)
	}

	userRepo := postgresRepo.NewUserRepo(database)
	courseRepo := postgresRepo.NewCourseRepo(database)
	enrollmentRepo := postgresRepo.NewEnrollmentRepo(database)
	auditRepo := postgresRepo.NewAuditRepo(database)

	authService := service.NewAuthService(userRepo, cfg.JWTSecret)
	courseService := service.NewCourseService(courseRepo, enrollmentRepo)
	adminService := service.NewAdminService(userRepo, courseRepo)
	auditService := service.NewAuditService(auditRepo)

	h := httpHandler.NewHandler(authService, courseService, adminService, auditService)
	r := chi.NewRouter()
	r.Use(middleware.SecurityHeaders())
	r.Use(middleware.NewDefaultRateLimiter().Middleware())
	r.Use(middleware.CORS(cfg.AllowedOrigin))
	h.RegisterRoutes(r, cfg.JWTSecret)

	log.Printf("server is running on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
