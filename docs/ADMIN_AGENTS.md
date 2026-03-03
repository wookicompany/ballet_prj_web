# ADMIN AGENTS 작업 규칙 (어드민/웹 전용)

이 문서는 어드민 패널(`/wookicompany/admin`) 및 웹 전용 영역에서 작업하는 에이전트가 따라야 할 규칙을 정의한다. 일반 앱 규칙은 [docs/APP_AGENTS.md](APP_AGENTS.md)를 따른다.

## 적용 범위

- `/wookicompany/admin` 하위 모든 라우트 및 `app/api/admin/*` API.
- 웹(데스크톱)에 최적화된 UI. 모바일 전용 패턴(MobileContainer, max-w-[430px] 중앙 정렬)은 사용하지 않는다.

## 인증

- 어드민 API·레이아웃에서는 `lib/apiAuth.ts`의 `getAdminFromRequest(request)`를 사용한다.
- `getAdminFromRequest`는 `getUserFromRequest`로 사용자 조회 후 `profiles.is_admin === true` 확인. 아니면 403.
- 클라이언트에서 API 호출 시 `supabase.auth.getSession()`으로 `session.access_token`을 취득해 `Authorization: Bearer <token>` 헤더로 전달한다.

## UI/컴포넌트

- shadcn/ui를 적극 활용한다. Sidebar, Tabs, Table, Card, Button, AlertDialog, Avatar, Pagination, Badge, Skeleton 등.
- 아이콘은 `lucide-react` 사용.
- 삭제 확인은 `AlertDialog` 사용. 소프트 삭제 시 "소프트 삭제합니다" 등 안내 문구를 명시한다.
- 관리자 페이지 상단 헤더는 기본적으로 `description` 없이 제목 중심으로 구성한다(필요 시에만 예외적으로 사용).

## API 설계

- 어드민 API는 모두 `app/api/admin/` 하위에 둔다.
- 모든 핸들러에서 `getAdminFromRequest(request)`를 호출하고, `admin: false`이면 `errorResponse`를 그대로 반환한다.
- 목록 API는 `limit`, `offset` 쿼리 지원. 기본 limit 20, 최대 100.
- 응답 형식은 JSON. 목록은 `{ items, total, limit, offset }` 또는 도메인별 키(records, reviews, members 등)로 통일한다.

## 데이터 정책

- 조회 시 `deleted_at IS NULL` 조건을 적용한다(records, performance_reviews, performance_review_comments, profiles 등).
- 삭제는 소프트 삭제(`deleted_at` 설정)로만 수행한다. 기존 앱 정책과 동일.

## 문서

- 어드민 경로·메뉴·API·지표·CRUD 범위는 [docs/admin_spec.md](admin_spec.md)에 기록한다.
- 스펙 변경 시 admin_spec.md를 함께 갱신한다.
