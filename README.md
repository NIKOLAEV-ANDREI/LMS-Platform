# LMS (Go + React)

Проект теперь единый в папке `prompt`:
- `backend` - Go API (REST, JWT, PostgreSQL)
- `frontend` - перенесенный UI из Figma (React + Vite + Tailwind)

## Архитектура backend
- `cmd/server` - entrypoint
- `internal/handler/http` - HTTP handlers
- `internal/service` - бизнес-логика
- `internal/repository` - интерфейсы
- `internal/repository/postgres` - PostgreSQL реализация
- `internal/db` - миграции

Поток: `handler -> service -> repository`.

## Запуск backend
```bash
cd backend
go run ./cmd/server
```

`.env` параметры (см. `backend/.env.example`):
- `PORT=8080`
- `DATABASE_URL=postgres://postgres:0000@localhost:5432/lms?sslmode=disable`
- `JWT_SECRET=change-me-in-production`
- `ALLOWED_ORIGIN=http://localhost:5173`

## Запуск frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend работает на `5173` и ходит в backend через Vite proxy:
- `/api -> http://localhost:8080`

## Важно
Старый MVP-фронтенд сохранен в бэкапе:
- `frontend_backup_20260502_162156`

Можно удалить его позже, когда убедишься, что новый фронтенд тебе больше не нужен как fallback.
