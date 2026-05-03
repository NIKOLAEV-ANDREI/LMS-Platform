# CODEx Project Context (Update Every Change)

Last updated: 2026-05-02
Project root: `C:\Users\an477\OneDrive\Desktop\prompt`

## 1) Goal
LMS platform (distance learning) with role model:
- student
- teacher
- admin
Backend: Go
Frontend: React

## 2) Current structure
- `backend` Р Р†Р вЂљРІР‚Сњ Go API (`handler -> service -> repository`)
- `frontend` Р Р†Р вЂљРІР‚Сњ migrated Figma-based React UI
- `docker-compose.yml` Р Р†Р вЂљРІР‚Сњ optional PostgreSQL container config
- `README.md` Р Р†Р вЂљРІР‚Сњ main run instructions

## 3) Backend status
Implemented now:
- auth: register/login (JWT)
- roles: student/teacher/admin
- student: enroll, progress update endpoint, dashboard data
- teacher: create courses, list own courses
- admin: list users, block user, change role, approve courses

Database:
- PostgreSQL (pgx driver)
- tables: `users`, `courses`, `enrollments`

Important files:
- `backend/cmd/server/main.go`
- `backend/internal/handler/http/handler.go`
- `backend/internal/service/*`
- `backend/internal/repository/postgres/*`

## 4) Frontend status
- Figma UI is fully moved to `prompt/frontend`
- API adapter is switched to local backend (`/api` via Vite proxy)
- dev server: `5173`
- proxy target: `http://localhost:8080`

Important files:
- `frontend/src/app/routes.tsx`
- `frontend/src/app/utils/api.ts`
- `frontend/src/app/components/*`
- `frontend/vite.config.ts`

## 5) Current known gaps
Not fully implemented yet in backend (UI partially expects these):
- modules
- lessons
- tests/questions/answers
- test submission flow
- teacher per-student analytics
- recommendation system

In `frontend/src/app/utils/api.ts` these methods still return MVP placeholders/errors:
- `submitTest`
- `getStudentsProgress`
- `updateCourse`

## 6) Local run config (current)
Backend env example currently expects local postgres:
- `DATABASE_URL=postgres://postgres:0000@localhost:5432/lms?sslmode=disable`

Backend:
- `cd backend`
- `go run ./cmd/server`

Frontend:
- `cd frontend`
- `npm install`
- `npm run dev`

## 7) Dev admin access (local)
Current local admin user:
- email: `123@123`
- password: `123123`

## 8) Legacy/tech debt notes
- `backend/internal/repository/sqlite/*` still exists (legacy, not used)
- `backend/lms.db` exists (legacy SQLite file)
- `frontend/supabase/*` and `frontend/utils/supabase/*` are legacy artifacts from Figma export, not used by current Go backend flow

## 9) Rule for future changes
This file MUST be updated after every meaningful project change:
- architecture
- routes/API
- db schema
- env/ports
- auth/roles
- run commands
- credentials used for local dev

If you changed code but did not update this file, context is incomplete for the next Codex chat.

## 10) Recent UI fix (2026-05-02)
- Fixed admin navbar active-state bug in `frontend/src/app/components/Layout.tsx`.
- Before: on `/admin/dashboard` both buttons `Р В РІР‚СљР В Р’В»Р В Р’В°Р В Р вЂ Р В Р вЂ¦Р В Р’В°Р РЋР РЏ` and `Р В РЎСџР В РЎвЂўР В Р’В»Р РЋР Р‰Р В Р’В·Р В РЎвЂўР В Р вЂ Р В Р’В°Р РЋРІР‚С™Р В Р’ВµР В Р’В»Р В РЎвЂ` looked active.
- Now: for role `admin`, button `Р В РІР‚СљР В Р’В»Р В Р’В°Р В Р вЂ Р В Р вЂ¦Р В Р’В°Р РЋР РЏ` is hidden; only `Р В РЎСџР В РЎвЂўР В Р’В»Р РЋР Р‰Р В Р’В·Р В РЎвЂўР В Р вЂ Р В Р’В°Р РЋРІР‚С™Р В Р’ВµР В Р’В»Р В РЎвЂ` represents admin dashboard.
## 11) Modules editor backend integration (2026-05-02)
Implemented for teacher flow:
- New DB tables: `course_modules`, `lessons`
- New backend endpoints:
  - `GET /api/courses/{courseID}` (course with modules/lessons)
  - `POST /api/teacher/courses/{courseID}/modules`
  - `POST /api/teacher/courses/{courseID}/modules/{moduleID}/lessons`
- Backend services/repository extended to create and load modules/lessons.
- Frontend API updated:
  - `getCourse` now requests `/api/courses/{id}`
  - `addModule` and `addLesson` now call real backend endpoints (no placeholders)
  - nested module/lesson mapping normalized (`video_url -> videoUrl`).

Still pending in this area:
- update/edit/delete modules/lessons
- test entity persistence and submission endpoints
## 12) Teacher publish + student visibility + module count fix (2026-05-02)
Implemented:
- Teacher can publish own course via new endpoint:
  - `POST /api/teacher/courses/{courseID}/publish`
- Student catalog uses only approved courses; published course now appears for students.
- Course list endpoints now include modules structure, so teacher dashboard module counts are up to date after edits.
- Frontend teacher dashboard:
  - added `РћРїСѓР±Р»РёРєРѕРІР°С‚СЊ РєСѓСЂСЃ` button with confirmation dialog in `РњРѕРё РєСѓСЂСЃС‹`.
  - course status badges: `Р§РµСЂРЅРѕРІРёРє` / `РћРїСѓР±Р»РёРєРѕРІР°РЅ`.

Updated files:
- `backend/internal/repository/interfaces.go`
- `backend/internal/repository/postgres/course_repo.go`
- `backend/internal/service/course_service.go`
- `backend/internal/handler/http/handler.go`
- `frontend/src/app/utils/api.ts`
- `frontend/src/app/components/dashboards/TeacherDashboard.tsx`
## 13) Course page runtime fix (2026-05-02)
- Fixed `ReferenceError: TrendingUp is not defined` on student `Продолжить` flow.
- Cause: `TrendingUp` icon was used in `CoursePage` but missing in import list.
- File fixed: `frontend/src/app/components/courses/CoursePage.tsx`.
## 14) Student lesson completion flow (2026-05-02)
Implemented end-to-end lesson completion for students:
- New DB table: `lesson_progress` (`user_id`, `course_id`, `lesson_id`, `completed_at`).
- Backend endpoints (student-only):
  - `POST /api/courses/{courseID}/lessons/{lessonID}/complete`
  - `GET /api/progress/{courseID}`
- Completion logic:
  - validates enrollment
  - validates that lesson belongs to course
  - idempotent save in `lesson_progress`
  - recalculates progress by completed lessons / total lessons
  - updates `enrollments.progress` and `enrollments.completed`.
- Frontend API updated:
  - `completeLesson` now calls real backend endpoint
  - `getProgress` now loads per-course progress from backend.
- UX behavior:
  - In `LessonViewer`, after `��������� ����` student sees success toast and is redirected back to the course page.

## 15) Test lesson persistence + rendering fix (2026-05-02)
Fixed bug where student could not see test questions/options.

Implemented:
- Backend lesson model now supports embedded test payload (`test.questions`).
- DB migration updated for `lessons.test_data` (JSONB):
  - added in `CREATE TABLE lessons`
  - `ALTER TABLE lessons ADD COLUMN IF NOT EXISTS test_data JSONB`
- Teacher lesson creation now accepts test payload and validates:
  - test must include at least 1 question
  - question text required
  - question type must be `single` / `multiple` / `open`
  - non-open questions require at least 2 options.
- Repository now stores `test_data` and returns it in course/lesson responses.
- Frontend API now:
  - sends `test` in `addLesson`
  - maps returned `lesson.test.questions` in `mapCourse`
  - implements working `submitTest` scoring (instead of placeholder error).
- Student lesson page now:
  - shows clear warning if test lesson has no configured questions
  - auto-marks lesson completed after successful test pass (>=70%).

Affected files:
- `backend/internal/domain/models.go`
- `backend/internal/db/migrate.go`
- `backend/internal/handler/http/handler.go`
- `backend/internal/service/course_service.go`
- `backend/internal/repository/postgres/course_repo.go`
- `frontend/src/app/utils/api.ts`
- `frontend/src/app/components/courses/LessonViewer.tsx`

## 16) Teacher course/module/lesson management �������� (2026-05-02)
Implemented:
- Teacher course visibility controls:
  - `POST /api/teacher/courses/{courseID}/publish`
  - `POST /api/teacher/courses/{courseID}/unpublish`
  - `DELETE /api/teacher/courses/{courseID}`
- Teacher module CRUD additions:
  - `PATCH /api/teacher/courses/{courseID}/modules/{moduleID}`
  - `DELETE /api/teacher/courses/{courseID}/modules/{moduleID}`
- Teacher lesson CRUD additions:
  - `PATCH /api/teacher/courses/{courseID}/modules/{moduleID}/lessons/{lessonID}`
  - `DELETE /api/teacher/courses/{courseID}/modules/{moduleID}/lessons/{lessonID}`
- Service layer now validates ownership and membership for all edit/delete actions.
- Postgres repository now supports:
  - delete course (including enrollments cleanup)
  - update/delete module
  - update/delete lesson.

Frontend:
- Teacher dashboard:
  - added delete icon button on each course card with confirmation
  - added `����� � ����������` action for published courses.
- Course editor:
  - added module edit/delete buttons (right side)
  - added lesson edit/delete buttons (right side)
  - added edit dialogs for module and lesson (text/video/test).

Updated files:
- `backend/internal/repository/interfaces.go`
- `backend/internal/repository/postgres/course_repo.go`
- `backend/internal/service/course_service.go`
- `backend/internal/handler/http/handler.go`
- `frontend/src/app/utils/api.ts`
- `frontend/src/app/components/dashboards/TeacherDashboard.tsx`
- `frontend/src/app/components/courses/CourseEditor.tsx`

## 17) Encoding fix for teacher edit UI (2026-05-02)
- Fixed broken text encoding in teacher edit pages caused by non-UTF8 file write.
- Converted files to UTF-8:
  - `frontend/src/app/components/courses/CourseEditor.tsx`
  - `frontend/src/app/components/dashboards/TeacherDashboard.tsx`
- Verified there are no replacement characters `?` in `CourseEditor.tsx` and frontend build passes.

## 18) Global mojibake cleanup finalized (2026-05-02)
- Root cause: `frontend/src/app/components/dashboards/TeacherDashboard.tsx` contained mojibake Russian literals.
- Applied deterministic recovery (cp1251-bytes -> UTF-8 decode) and saved file in UTF-8.
- Re-scanned `frontend/src` for mojibake markers (`�/�/�/�/�/�/�/?/П�...`) and no matches remain.
- Frontend build verified after fix.

## 19) Admin user management + deep profile + restore flows (2026-05-02)
Implemented end-to-end admin enhancements:

Backend:
- New admin user endpoints:
  - `GET /api/admin/users/{id}` (user details; teacher includes active+deleted courses)
  - `PATCH /api/admin/users/{id}` (update name/email/password)
  - `PATCH /api/admin/users/{id}/restore` (restore blocked user)
- Teacher course endpoints extended:
  - `POST /api/teacher/courses/{courseID}/restore`
  - `PATCH /api/teacher/courses/{courseID}` (update title/description)
- Admin course control endpoints:
  - `PATCH /api/admin/courses/{id}`
  - `POST /api/admin/courses/{id}/publish`
  - `POST /api/admin/courses/{id}/unpublish`
  - `POST /api/admin/courses/{id}/restore`
  - `DELETE /api/admin/courses/{id}`
- Admin module/lesson CRUD endpoints:
  - `POST/PATCH/DELETE /api/admin/courses/{courseID}/modules/{moduleID?}`
  - `POST/PATCH/DELETE /api/admin/courses/{courseID}/modules/{moduleID}/lessons/{lessonID?}`
- User repository extended with:
  - `UpdateProfile`, `SetPasswordHash`
- Course repository/service extended with:
  - teacher deleted courses list (`status='rejected'`),
  - admin CRUD helpers,
  - course soft-delete behavior (`DeleteCourse` now archives by `status='rejected'`).

Frontend:
- Admin dashboard rewritten/fixed:
  - user row click opens user detail page (`/admin/users/:id`)
  - users table has tabs: `��������` / `���������`
  - delete now moves user to deleted tab; restore action added
- New page: `AdminUserPage.tsx`
  - edit user name/email/password
  - for teacher: shows active courses + deleted courses
  - restore deleted teacher courses
  - admin controls for publish/unpublish/delete
  - navigation to admin course editor for module/lesson editing
- Routes added:
  - `/admin/users/:id`
  - `/admin/courses/:id/edit`
- `CourseEditor` upgraded to dual-mode:
  - teacher mode uses teacher endpoints
  - admin mode (path `/admin/courses/:id/edit`) uses admin endpoints
  - added course title/description edit block.

Bug fix delivered:
- "Deleted user still shown in list": now active table filters out blocked users and deleted users are shown in a separate restore tab.

## 20) Avatar upload/crop/delete for users + admin control (2026-05-02)
Implemented end-to-end avatar management with square crop:

Backend:
- `domain.User` now includes `avatar_url`.
- DB migration includes `users.avatar_url TEXT NOT NULL DEFAULT ''`.
- `UserRepository` extended with `SetAvatar(id, avatarURL)`.
- `AdminService.UpdateUserProfile(...)` now supports:
  - set avatar (`avatar_url`)
  - remove avatar (`remove_avatar`)
  - validation:
    - allowed formats: `data:image/*`, `http://`, `https://`
    - max length: `2_000_000` chars
- Routes already used for profile/user updates now accept avatar fields:
  - `PATCH /api/me`
  - `PATCH /api/admin/users/{id}`

Frontend:
- Added reusable square crop workflow with `react-easy-crop`:
  - `frontend/src/app/components/shared/AvatarCropDialog.tsx`
  - `frontend/src/app/components/shared/AvatarField.tsx`
  - `frontend/src/app/utils/avatar.ts`
- User profile page (`Profile.tsx`):
  - upload avatar
  - crop/resize to square before save
  - delete avatar
  - also supports updating name/email/password via `PATCH /api/me`.
- Admin user page (`AdminUserPage.tsx`):
  - view target user avatar
  - upload/change avatar with square crop
  - delete avatar
  - uses `PATCH /api/admin/users/{id}`.

Compatibility:
- Updated legacy sqlite user repo methods for interface completeness:
  - `UpdateProfile`, `SetPasswordHash`, `SetAvatar`
  - avatar column read/write support in sqlite repo queries.

Verification:
- Backend: `go build ./...` passed.
- Frontend: `npm run build` passed.

## 21) Avatar action UI refinement (2026-05-02)
Updated avatar controls in UI to match Telegram-like interaction:
- Removed separate inline buttons near avatar.
- Added hover overlay camera icon directly on avatar.
- Click on camera opens dropdown with two actions:
  - `�������� ����������`
  - `������� ����`
- Replaced fallback initials with standard gray profile placeholder icon.
- Works in both `Profile.tsx` and `AdminUserPage.tsx` via shared `AvatarField` component.
- Frontend build verified: `npm run build` passed.

## 22) Teacher name consistency fix in student catalog (2026-05-02)
Fixed bug: after publishing a course, student saw incorrect teacher display name.

Root cause:
- Backend course endpoints returned only `teacher_id`.
- Frontend fell back to `Teacher #id` when teacher name was absent.

Implemented:
- `domain.Course` now includes `teacher_name`.
- Postgres course queries now join `users` and return teacher name for:
  - `ByID`
  - `ListApproved`
  - `ListByTeacher`
  - `ListDeletedByTeacher`
  - `ListAll`
- Frontend mapping now prioritizes `teacher_name` from backend.

Verification:
- `go build ./...` passed.
- `npm run build` passed.

## 23) Student course preview before enrollment (2026-05-02)
Implemented student preview flow before course enrollment:

Frontend:
- In `StudentDashboard` available-course cards now have two actions:
  - `�����������` (opens `/courses/{id}` without enrollment)
  - `����������` (direct enrollment)
- In `CoursePage` for non-enrolled students added a dedicated preview block with CTA button:
  - `���������� �� ����`
  - after successful enrollment, page data refreshes and student can start lessons.
- Existing lesson access behavior from course page is preserved:
  - lesson start buttons appear only when student is enrolled.

Verification:
- Frontend build passed (`npm run build`).

## 24) Encoding repair for student dashboard (2026-05-02)
- Fully rewrote `frontend/src/app/components/dashboards/StudentDashboard.tsx` in clean UTF-8.
- Replaced all mojibake UI strings with correct Russian text.
- Preserved previous functionality, including course preview before enrollment (`�����������` + `����������`).
- Frontend build passed after fix (`npm run build`).

## 25) Additional encoding cleanup in student flow pages (2026-05-02)
- Rewrote `CoursePage.tsx` and `LessonViewer.tsx` in clean UTF-8.
- Replaced mojibake Russian texts with normal Russian UI labels/messages.
- Preserved logic:
  - course preview before enrollment,
  - enrollment CTA on course page,
  - lesson completion flow,
  - test submission/retry flow.
- Frontend build passed after cleanup (`npm run build`).

## 26) Global field limits + overflow-safe text entry (2026-05-02)
Implemented standardized character limits across backend and frontend forms.

Backend:
- Added centralized limits and validators in:
  - `backend/internal/service/field_limits.go`
- Enforced in services:
  - `auth_service.go` (name/email/password on register, bounded login payload)
  - `admin_service.go` (name/email/password/avatar updates)
  - `course_service.go` (course/module/lesson/test question and option lengths)
- Includes standard constraints for:
  - name, email, password
  - course/module/lesson titles and descriptions/content
  - video URL
  - test question text/options
  - avatar payload size/format.

Frontend:
- Added shared limits and overflow warning helper:
  - `frontend/src/app/utils/limits.ts`
- Added reusable char counter:
  - `frontend/src/app/components/shared/CharCounter.tsx`
- Added field-level limit enforcement + over-limit notifications + counters in forms:
  - `auth/Login.tsx`
  - `auth/Register.tsx`
  - `Profile.tsx`
  - `dashboards/AdminUserPage.tsx`
  - `dashboards/TeacherDashboard.tsx`
  - `courses/CourseEditor.tsx`
- Added reliable long-text wrapping inside textareas:
  - `frontend/src/app/components/ui/textarea.tsx`
  - classes now force wrap for long unbroken text (`break-words` + `overflow-wrap:anywhere`).

Additional cleanup:
- Rewrote `Profile.tsx` and `AdminUserPage.tsx` in clean UTF-8 while applying limits.

Verification:
- `go build ./...` passed.
- `npm run build` passed.

## 27) Limits/counters UX + long-text overflow hardening (2026-05-03)
Implemented per latest UI refinement:

- Field counters removed where requested (limits kept):
  - auth forms: email/password/name counters removed
  - profile page: counters removed
  - admin user edit page: counters removed
  - URL fields: removed counters in teacher course create form and lesson video URL form
- Password placeholder updated to show minimum length:
  - register/login: `Минимум 6 символов`
  - optional password fields in profile/admin user page: `Оставьте пустым (минимум 6 символов)`
- Name limit reduced to 30 symbols on both layers:
  - frontend: `LIMITS.userName = 30`
  - backend: `MaxUserNameLen = 30`
- Fixed long-text layout issues:
  - removed `field-sizing-content` from shared `Textarea` to prevent growth-driven layout break
  - teacher/student course cards: title/description now clamp with safe wrapping and ellipsis
  - course view page: long course title/description now wrap by words/anywhere
  - module headers in editor and course page: long module titles now truncate with ellipsis
  - lesson rows on course page keep action button stable via `min-w-0 + truncate`

Files updated:
- `backend/internal/service/field_limits.go`
- `frontend/src/app/utils/limits.ts`
- `frontend/src/app/components/ui/textarea.tsx`
- `frontend/src/app/components/auth/Register.tsx`
- `frontend/src/app/components/auth/Login.tsx`
- `frontend/src/app/components/Profile.tsx`
- `frontend/src/app/components/dashboards/AdminUserPage.tsx`
- `frontend/src/app/components/dashboards/TeacherDashboard.tsx`
- `frontend/src/app/components/dashboards/StudentDashboard.tsx`
- `frontend/src/app/components/courses/CoursePage.tsx`
- `frontend/src/app/components/courses/CourseEditor.tsx`

Verification:
- Backend: `go build ./...` passed.
- Frontend: `npm run build` passed.

## 28) Encoding stabilization + mojibake fix (2026-05-03)
- Fixed broken Russian text encoding in UI pages:
  - `frontend/src/app/components/Profile.tsx`
  - `frontend/src/app/components/dashboards/AdminUserPage.tsx`
- Root cause addressed:
  - added repository-wide editor encoding policy in `.editorconfig` (`charset = utf-8`)
  - added line-ending normalization in `.gitattributes`
- Added automated frontend encoding guard:
  - `frontend/scripts/check-encoding.mjs`
  - npm script: `npm run check:encoding`
  - checker fails if typical mojibake markers are found in `frontend/src`
- Verification:
  - `npm run check:encoding` passed
  - `npm run build` passed
- Added workspace editor defaults: `.vscode/settings.json` (`files.encoding=utf8`, `autoGuessEncoding=false`).

## 29) Student module UX improvements in course flow (2026-05-03)
Implemented course/module usability enhancements for students:

- Module completion marker:
  - In `CoursePage`, module header turns green (`bg-green-50`) and shows badge `Пройден` when all lessons in module are completed by student.
- Auto-scroll on open module:
  - `CoursePage` accordion is now controlled.
  - On module open, page smooth-scrolls to that module block automatically.
- Keep module open after lesson completion:
  - `LessonViewer` now detects parent module of current lesson.
  - After `Завершить урок` (and after successful test return), navigation back to course sends state `{ openModuleId }`.
  - `CoursePage` reads this state, auto-opens the exact module and scrolls to it.

Files updated:
- `frontend/src/app/components/courses/CoursePage.tsx`
- `frontend/src/app/components/courses/LessonViewer.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 30) Fixed module auto-scroll for all roles (2026-05-03)
- Root cause: `AccordionItem` wrapper in `ui/accordion.tsx` did not forward refs, so `CoursePage` could not reliably call `scrollIntoView` on opened module blocks.
- Fix: converted `AccordionItem` to `React.forwardRef(...)` and forwarded ref to `AccordionPrimitive.Item`.
- Result: automatic scroll on module open now works consistently across student/teacher/admin course views.

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 31) Student dashboard card alignment fix (2026-05-03)
- Fixed drifting positions of progress bar and action buttons in course cards (`Мои курсы` / `Доступные курсы`).
- `StudentDashboard` cards now use stable vertical layout:
  - card container: `flex h-full flex-col`
  - content block: `mt-auto flex flex-1 flex-col justify-end`
  - title/description areas have minimum heights to normalize card header height across different text lengths.
- Result: progress and `Просмотреть/Продолжить` buttons stay on consistent vertical positions in each row.

Updated file:
- `frontend/src/app/components/dashboards/StudentDashboard.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 32) Password placeholder encoding fix (2026-05-03)
- Fixed broken placeholder text encoding for `Новый пароль` field.
- Updated both profile edit forms to clean UTF-8 string:
  - `Оставьте пустым (минимум 6 символов)`

Files:
- `frontend/src/app/components/Profile.tsx`
- `frontend/src/app/components/dashboards/AdminUserPage.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 33) Added LMS favicon for browser tab (2026-05-03)
- Added site tab icon matching the LMS header style (blue tile + white graduation cap).
- Updated `index.html` head:
  - set proper UTF-8 Russian title: `Платформа дистанционного обучения`
  - added favicon link: `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`
- New file:
  - `frontend/favicon.svg`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed
- Updated browser tab title in `frontend/index.html` to `LMS Platform` (2026-05-03).

## 34) Added laconic educational gray background pattern (2026-05-03)
- Implemented a global LMS background pattern for app pages rendered via `Layout`.
- Added custom CSS class in `theme.css`:
  - `lms-learning-background`
  - includes subtle gray repeating SVG motifs (education-themed icons) + soft radial gray accents
  - keeps overall minimalist Telegram-like style without visual overload
- Applied class in `Layout.tsx` on the main content area.

Files:
- `frontend/src/styles/theme.css`
- `frontend/src/app/components/Layout.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 35) Background pattern restyle + auth pages coverage (2026-05-03)
Updated background pattern to match the reference style more closely:
- Replaced dense micro-pattern with a larger, more spaced educational line-art tile.
- Icons are visually bolder (increased stroke width) and less frequent (larger tile size).
- Kept neutral gray icon color consistent with previous scheme.

Implementation:
- Added new static pattern asset:
  - `frontend/learning-pattern.svg`
- Updated global class:
  - `frontend/src/styles/theme.css`
  - `.lms-learning-background` now uses `url('/learning-pattern.svg')`, `repeat`, and larger `background-size: 620px 620px`.
- Applied pattern to auth screens as requested:
  - `frontend/src/app/components/auth/Login.tsx`
  - `frontend/src/app/components/auth/Register.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 36) Background pattern redesigned with requested large icon set (2026-05-03)
Pattern updated to a more diverse, modern, bold educational style using the exact requested motifs:
- calendar
- coffee cup
- pen
- open book
- graduation cap
- laptop

Design changes:
- icons are significantly larger
- stroke weight increased for a bolder look
- lower density (more spacing)
- varied rotations for a more natural/harmonic composition
- kept neutral gray color scheme consistent with current style

Implementation:
- Replaced `frontend/learning-pattern.svg` with new large icon composition.
- Updated tile scale in `frontend/src/styles/theme.css`:
  - `.lms-learning-background { background-size: 980px 980px; }`

Coverage:
- Pattern remains active on main platform pages via `Layout`
- Pattern remains active on auth screens (`Login`, `Register`) from previous step

Verification:
- `npm run check:encoding` passed
- `npm run build` passed
- Reverted background to solid color only (disabled pattern in `.lms-learning-background`, kept `#f8fafc`) on 2026-05-03.
- Reinitialized git strictly at project root `C:\Users\an477\OneDrive\Desktop\prompt` and added root `.gitignore` (2026-05-03). Previous parent-level repo at `C:\Users\an477` is no longer used for project operations.

## 37) Student dashboard "My Courses" summary row + profile shortcut (2026-05-03)
Implemented requested main-page behavior for student role:
- In `StudentDashboard`, section `Мои курсы` now shows only a compact preview (up to 3 most recent enrolled courses).
- Added shortcut action near section title:
  - `Все курсы` with arrow icon
  - navigates to `/profile` where full enrolled courses list remains available.
- Recent ordering logic:
  - builds enrolled list using `user.enrolledCourses` reversed order, then maps ids to course entities.

Updated file:
- `frontend/src/app/components/dashboards/StudentDashboard.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 38) Profile page student courses grid redesign (2026-05-03)
- Reworked student profile section to include dedicated block:
  - `Мои курсы`
  - subtitle: `Все курсы, на которые вы записаны`
- Enrolled courses in profile are now displayed as cards in responsive grid:
  - desktop: 3 cards per row (`lg:grid-cols-3`)
  - tablet/mobile preserved responsive behavior (`md:grid-cols-2`, `grid-cols-1`)
- Card style aligned with student dashboard cards:
  - stable header heights
  - progress bar + modules count + action button
  - action button `Просмотреть` / `Продолжить` based on progress
- Also rewrote `Profile.tsx` in clean UTF-8 to avoid residual encoding/layout artifacts.

Updated file:
- `frontend/src/app/components/Profile.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed
- Student dashboard: moved profile navigation arrow next to `Мои курсы` title and made only arrow icon clickable (removed full text button) on 2026-05-03.
- Student dashboard: increased arrow size near section title and adjusted heading line-height for visual vertical centering (2026-05-03).
- Student dashboard: refined Мои курсы arrow alignment and enlarged icon (h-8 w-8, button h-11 w-11, slight vertical offset) for better centering with title (2026-05-03).
- Replaced student dashboard section arrow with user-provided SVG (`public/icons/right-arrow.svg`) and wired it in `StudentDashboard.tsx` (2026-05-03).
- Reduced custom student dashboard arrow SVG size from 28px to 24px (h-6 w-6) on 2026-05-03.
- Replaced student dashboard arrow asset with user-provided rrow_right_icon_128385.svg (copied to rontend/public/icons/right-arrow.svg) on 2026-05-03.
- Student dashboard arrow now rendered via SVG mask (/icons/right-arrow.svg) with currentColor; on hover button turns primary and arrow turns white (hover:text-white) on 2026-05-03.
- Student dashboard: adjusted profile-arrow button to be smaller and rectangular (h-9 w-10 rounded-md) while keeping arrow icon size unchanged (2026-05-03).

## 39) Profile text, password placeholder, avatar menu radius, and RU plurals fixed (2026-05-03)
Implemented requested UX/text corrections:
- Profile description changed:
  - from: `Управление личными данными и аватаркой`
  - to: `Управление личными данными.`
- `Новый пароль` placeholder changed to: `Минимум 6 символов`
  - updated in user profile and admin user-edit page.
- Avatar action popup rounding reduced to match app style:
  - `DropdownMenuContent` in `AvatarField` changed from `rounded-2xl` to `rounded-lg`.
- Replaced incorrect forms like `модуль(ей)`, `урок(ов)`, `студент(ов)` with proper Russian declension by count.

Implementation details:
- Added utility `frontend/src/app/utils/plural.ts` with:
  - `getRuNounForm(...)`
  - `formatRuCount(...)`
- Integrated plural formatting in:
  - `frontend/src/app/components/Profile.tsx`
  - `frontend/src/app/components/courses/CoursePage.tsx`
  - `frontend/src/app/components/dashboards/StudentDashboard.tsx`
- Rewrote `frontend/src/app/components/shared/AvatarField.tsx` in clean UTF-8 to remove mojibake in toasts/menu labels and keep Russian strings readable.

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 40) Student dashboard: always show "Доступные курсы" with empty-state banner (2026-05-03)
Updated student dashboard behavior when user is enrolled in all courses:
- Section `Доступные курсы` is now always rendered.
- If no available courses remain, shows an empty-state card styled like other dashboard placeholders:
  - `Доступных курсов больше нет`
  - `Вы уже подписались на все курсы`
- If available courses exist, previous cards grid is shown unchanged.

Updated file:
- `frontend/src/app/components/dashboards/StudentDashboard.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 41) Student profile: unsubscribe icon on course cards + backend unenroll API (2026-05-03)
Implemented per-course unsubscribe action in student profile.

Frontend:
- Added unsubscribe icon button on every student course card in profile (`UserMinus` icon, top-right).
- Added confirmation before unsubscribe.
- After successful unsubscribe:
  - shows success toast
  - reloads profile data (courses/progress list updates immediately).
- Added API client method:
  - `api.unenrollCourse(courseId)` -> `DELETE /courses/{courseId}/enroll`
  - updates cached local user `enrolledCourses`.

Backend:
- Added student unenroll endpoint:
  - `DELETE /api/courses/{courseID}/enroll` (student role required).
- Added handler method `unenroll`.
- Added service method `CourseService.Unenroll(...)`.
- Extended repository contract with `Unenroll(userID, courseID)`.
- Implemented unenroll in Postgres and SQLite enrollment repositories:
  - deletes related `lesson_progress`
  - deletes enrollment row
  - wrapped in transaction.

Updated files:
- `frontend/src/app/components/Profile.tsx`
- `frontend/src/app/utils/api.ts`
- `backend/internal/handler/http/handler.go`
- `backend/internal/service/course_service.go`
- `backend/internal/repository/interfaces.go`
- `backend/internal/repository/postgres/enrollment_repo.go`
- `backend/internal/repository/sqlite/enrollment_repo.go`

Verification:
- `go build ./cmd/server` passed
- `npm run check:encoding` passed
- `npm run build` passed

## 42) Student profile: split active/completed courses, disable unsubscribe for completed (2026-05-03)
Implemented requested behavior for student profile courses:
- Student course cards are now split into two sections:
  - `Мои курсы` (only active courses with progress < 100%)
  - `Завершенные курсы` (only completed courses with progress = 100%)
- Unsubscribe icon/action remains only on active course cards.
- Completed course cards do not show unsubscribe action.
- Added guard in unsubscribe handler: if course is completed, unsubscribe is blocked with toast message.
- Empty states added for both sections:
  - `Нет активных курсов`
  - `Пока нет завершенных курсов`

Updated file:
- `frontend/src/app/components/Profile.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 43) Teacher courses UX: fixed card button alignment + dashboard/profile parity with student flow (2026-05-03)
Implemented requested teacher-side improvements.

Teacher dashboard (`TeacherDashboard`):
- Fixed course-card alignment drift:
  - cards now use stable vertical layout (`flex h-full flex-col`)
  - title/description have fixed visual blocks (`min-h-*` + clamping)
  - action area pinned to bottom (`mt-auto`, uniform button heights).
- Updated `Мои курсы` section behavior to match student pattern:
  - shows only 3 most recent courses on main dashboard
  - added arrow button near `Мои курсы` title to navigate to `/profile`
  - arrow uses same SVG-mask style as student dashboard (`/icons/right-arrow.svg`).

Profile (`Profile`, teacher role):
- Replaced teacher plain list with responsive cards grid (`1/2/3 columns`).
- Added full teacher courses display in profile as cards with:
  - image/title/description/status badge
  - students/modules/lessons stats
  - buttons: `Редактировать` and `Просмотр`.

Updated files:
- `frontend/src/app/components/dashboards/TeacherDashboard.tsx`
- `frontend/src/app/components/Profile.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 44) Teacher profile cards: publish/unpublish controls added (2026-05-03)
Added missing publish controls on teacher profile course cards:
- Each teacher course card in profile now shows:
  - `Опубликовать курс` when status is not approved
  - `Снять с публикации` when status is approved
- Actions call existing teacher API methods and reload profile data after completion.
- Added action lock state (`courseActionId`) to prevent duplicate clicks during request.

Updated file:
- `frontend/src/app/components/Profile.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 45) Teacher profile cards: delete course button with confirmation (2026-05-03)
Added delete action to each teacher course card in profile:
- New `Удалить курс` button on every teacher card.
- Action uses confirmation dialog (`AlertDialog`).
- On confirm:
  - calls teacher API `removeCourse`
  - shows toast
  - reloads profile course list.
- Uses existing `courseActionId` lock to prevent duplicate requests.

Updated file:
- `frontend/src/app/components/Profile.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 46) Teacher profile cards synced to main dashboard card layout (2026-05-03)
Adjusted teacher profile cards to match teacher dashboard cards visually and structurally.

What was aligned:
- Delete action moved to top-right icon button (`Trash2`) with confirmation dialog.
- Card header/body spacing and fixed-height text blocks aligned (`min-h-*`, clamped title/description).
- Stats block now matches main teacher card structure (`Студенты`, `Модули`).
- Action buttons match dashboard styling and placement:
  - `Редактировать` (with `Edit` icon)
  - `Просмотр`
  - publish/unpublish full-width action below.
- Removed extra bottom destructive delete button so profile card layout mirrors main page cards.

Updated file:
- `frontend/src/app/components/Profile.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 47) Admin users table: search by name/email + role sorting (2026-05-03)
Implemented requested user-management table controls on admin dashboard:
- Added search field for `Имя` and `Email`.
- Added role sorting selector with options:
  - `Без сортировки`
  - `Студент → Учитель → Админ`
  - `Админ → Учитель → Студент`
- Added empty-state row: `Пользователи не найдены` when filters return no matches.

Technical note:
- Rewrote `AdminDashboard.tsx` in clean UTF-8 while preserving existing business logic
  (tabs active/deleted, role change, delete/restore actions, row navigation).

Updated file:
- `frontend/src/app/components/dashboards/AdminDashboard.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 48) Admin users table: role-based filtering (students/teachers/admins) (2026-05-03)
Updated admin users controls per request:
- Replaced role sorting selector with explicit role filter selector:
  - `Все роли`
  - `Только студенты`
  - `Только учителя`
  - `Только администраторы`
- Search by `Имя`/`Email` now works together with selected role filter.

Updated file:
- `frontend/src/app/components/dashboards/AdminDashboard.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 49) Teacher profile: added "Создать курс" button with same dialog as teacher dashboard (2026-05-03)
Implemented requested control for teacher profile:
- Added `Создать курс` button in teacher profile courses section.
- Added the same creation dialog flow as on teacher dashboard:
  - fields: title, description, optional image URL
  - same text limits + live counters
  - submit creates course via API and refreshes list.

Updated file:
- `frontend/src/app/components/Profile.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 50) Course-creation dialogs switched to fullscreen editing mode (2026-05-03)
Updated creation/editing dialogs to fullscreen UX for course-authoring flow.

Fullscreen dialogs applied to:
- Teacher dashboard: `Создать курс`
- Teacher profile: `Создать курс`
- Course editor: `Добавить/Редактировать модуль`
- Course editor: `Добавить/Редактировать урок`

Applied class preset:
- `w-screen max-w-screen h-screen max-h-screen rounded-none border-0 p-6 sm:p-8 overflow-y-auto`

Updated files:
- `frontend/src/app/components/dashboards/TeacherDashboard.tsx`
- `frontend/src/app/components/Profile.tsx`
- `frontend/src/app/components/courses/CourseEditor.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 51) Reverted fullscreen course-authoring dialogs back to previous sizing (2026-05-03)
Rolled back the last fullscreen-dialog change as requested.

Reverted to previous dialog behavior:
- Teacher dashboard `Создать курс`: default dialog sizing restored.
- Teacher profile `Создать курс`: default dialog sizing restored.
- Course editor module dialog: default dialog sizing restored.
- Course editor lesson dialog: restored prior constrained size
  (`max-w-2xl max-h-[90vh] overflow-y-auto`).

Updated files:
- `frontend/src/app/components/dashboards/TeacherDashboard.tsx`
- `frontend/src/app/components/Profile.tsx`
- `frontend/src/app/components/courses/CourseEditor.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 52) Lesson creation flow redesigned: minimal create dialog + separate fullscreen lesson editor page (2026-05-03)
Implemented requested authoring UX split.

Changes:
- `Добавить урок` in course editor is now minimal:
  - only `Название урока`
  - only `Тип урока`
  - no `Содержание урока` in this creation dialog.
- Lesson edit action (pencil on lesson row) no longer opens dialog.
  - now opens dedicated lesson page with title and subtitle `Редактор урока`.
- Added new fullscreen lesson editor page for detailed editing:
  - text lesson content editing
  - video URL + description editing
  - full test questions editor
  - save lesson action.

Routing:
- Added teacher route: `/courses/:courseId/lessons/:lessonId/edit`
- Added admin route: `/admin/courses/:courseId/lessons/:lessonId/edit`

Layout:
- Added optional `fullWidth` mode in `Layout`.
- New lesson editor page uses `Layout fullWidth` for full-width workspace.

Files updated:
- `frontend/src/app/components/Layout.tsx`
- `frontend/src/app/components/courses/CourseEditor.tsx`
- `frontend/src/app/components/courses/LessonEditor.tsx` (new)
- `frontend/src/app/routes.tsx`

Note:
- For quick creation of test lessons from minimal dialog, a valid placeholder test question is generated automatically; details should be finalized in the new lesson editor.

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 53) Course editor title now updates live while typing (2026-05-03)
Aligned course editor heading behavior with lesson editor:
- In `CourseEditor`, page H1 now uses current form state (`courseForm.title`) with fallback to original `course.title`.
- Result: title changes are reflected immediately in the page header while typing.

Updated file:
- `frontend/src/app/components/courses/CourseEditor.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 54) Lesson editor: full rich text formatting for text lessons (2026-05-03)
Implemented a full rich text authoring mode in lesson editor content.

What was added:
- New reusable component: `RichTextEditor`
  - Toolbar buttons: bold, italic, underline, strikethrough.
  - Heading block switch: paragraph, H1, H2, H3.
  - Text color picker with 7 preset colors.
  - Content limit enforcement by plain-text length (`LIMITS.lessonContent`) with validation toast.
- Text lesson editing in `LessonEditor` now uses `RichTextEditor` instead of plain textarea.
- Lesson save now sanitizes text-lesson HTML before sending to backend.
- Lesson viewing now safely renders formatted HTML content for students (`sanitizeRichText` + `dangerouslySetInnerHTML`).
- Added rich-text CSS rules for placeholder and rendered typography.

Encoding hardening:
- Rewrote `LessonEditor.tsx` in UTF-8 to remove mojibake markers and stabilize Cyrillic text rendering.

Updated files:
- `frontend/src/app/components/shared/RichTextEditor.tsx` (new)
- `frontend/src/app/components/courses/LessonEditor.tsx`
- `frontend/src/app/components/courses/LessonViewer.tsx`
- `frontend/src/styles/theme.css`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 55) Rich text editor UX fixes: color selection, cursor stability, active toolbar states (2026-05-03)
Fixed the lesson text editor interaction bugs and improved formatting UX.

Problems fixed:
- Color buttons previously moved cursor to the start and did not apply color reliably.
- Formatting controls had no active-state indication.

What was changed:
- Reworked `RichTextEditor` internal sync logic to avoid resetting editor HTML on each local input.
  - Added emitted-value tracking to prevent caret jumps caused by parent re-render.
- Prevented focus loss on toolbar click using `onMouseDown(event.preventDefault())`.
  - Selection/caret stays in editor while applying commands.
- Added active visual states for formatting controls:
  - bold/italic/underline/strikethrough buttons now highlighted when active.
  - heading mode buttons (`P`, `H1`, `H2`, `H3`) now highlighted for current block type.
- Added selected-color indicator:
  - chosen color button gets blue ring (`ring-primary`).
- Added toolbar state tracking from current selection/caret:
  - listens to `selectionchange`, `keyup`, `mouseup` and syncs active states.
- Enabled CSS-styled formatting mode (`styleWithCSS`) for consistent color application.

Behavior clarification now:
- Color applies to selected text.
- If no text is selected, color is applied at caret and used for newly typed text.

Updated file:
- `frontend/src/app/components/shared/RichTextEditor.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 56) Rich text regression fix: bold/italic/underline/strike restored (2026-05-03)
Fixed regression where text formatting stopped working (except headings/color).

Root cause:
- `RichTextEditor` forced `document.execCommand("styleWithCSS", true)` behavior.
- Bold/italic/underline/strike were emitted as inline styles on `<span>`.
- Sanitizer keeps only color style and strips other styles, so formatting disappeared.

Fix:
- Switched editor back to non-CSS command mode:
  - `document.execCommand("styleWithCSS", false, false)`
- Formatting now emits semantic tags (`<b>`, `<i>`, `<u>`, `<strike>`) that are allowed by sanitizer.

Updated file:
- `frontend/src/app/components/shared/RichTextEditor.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 57) Lesson editor draft autosave + restore after reload (2026-05-03)
Implemented draft persistence for lesson editing so data is not lost on page refresh.

What was added:
- In `LessonEditor`, added local draft storage in `localStorage` per lesson key:
  - key format: `lms:lesson-editor-draft:{courseId}:{lessonId}`
- Autosave while editing (debounced ~300ms):
  - saves current `lessonForm` and `testQuestions`.
- Restore on lesson editor load:
  - if draft exists, editor restores draft values instead of server snapshot.
  - shows toast: `Черновик урока восстановлен`.
- On successful lesson save:
  - corresponding draft is removed from `localStorage`.

Result:
- Typed lesson content (including rich text), title, type, video fields, and test question edits survive page reloads until user explicitly saves lesson.

Updated file:
- `frontend/src/app/components/courses/LessonEditor.tsx`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed

## 58) Rich text color fix: support rgb() color values in sanitizer (2026-05-03)
Fixed remaining issue where text color formatting was not preserved.

Root cause:
- Browser/editor may emit color as `rgb(r, g, b)`.
- `sanitizeRichText` previously accepted only hex (`#RRGGBB`) in both:
  - `<font color="...">` conversion
  - inline style color normalization
- As a result, color was stripped during sanitize pass.

Fix:
- Replaced hex-only normalizer with `normalizeColor` supporting:
  - `#RRGGBB`
  - `rgb(r, g, b)`
- Converted rgb values to uppercase hex before allow-list check.
- Applied new normalization for both font color attribute and style color.

Updated file:
- `frontend/src/app/utils/richText.ts`

Verification:
- `npm run check:encoding` passed
- `npm run build` passed
