# 어드민 스펙

어드민 패널(`/wookicompany/admin`)의 경로, 메뉴, API, 대시보드 지표, CRUD 범위를 정의한다.

## 1. 경로 및 인증

- **베이스 경로**: `/wookicompany/admin`
- **인증**: 기존 Supabase Auth(앱과 동일 로그인) 사용. `profiles.is_admin === true`인 사용자만 접근 가능.
- **접근 제어**: `lib/apiAuth.ts`의 `getAdminFromRequest(request)`로 모든 어드민 API·레이아웃에서 검증. 미로그인/비어드민 시 401/403 또는 로그인 시트·리다이렉트.

## 2. 레이아웃 및 메뉴

- **구성**: 헤더(타이틀, 로그아웃) + 좌측 사이드바(네비) + 메인 영역(페이지 콘텐츠).
- **사이드바 메뉴**

| 메뉴             | 경로                              |
|----------------|-----------------------------------|
| 대시보드         | `/wookicompany/admin`             |
| 캘린더 기록 관리  | `/wookicompany/admin/records`     |
| 공연 리뷰/댓글 관리 | `/wookicompany/admin/reviews`     |
| 공지사항 관리     | `/wookicompany/admin/notices`     |
| 문의 관리        | `/wookicompany/admin/support-inquiries` |
| 광고 관리        | `/wookicompany/admin/ads`         |
| 브랜드 관리      | `/wookicompany/admin/brands`      |
| 회원 관리        | `/wookicompany/admin/members`     |

- **UI**: shadcn/ui Sidebar, Tabs, Table, Card, Button, AlertDialog, Avatar, Pagination 등 사용. 웹(데스크톱) 최적화.

## 3. 대시보드 지표

카드 17개와 일별 추이 차트 4개로 구성(2026-09-20 개편).

### 사용자

| 지표 | 계산 |
|---|---|
| 총 가입자 수 | `auth.users` 전체 행 수(`get_total_auth_users_count()`). **탈퇴자를 포함한다** |
| DAU | `get_active_user_stats()` — 오늘(KST) 활동한 `user_id` DISTINCT |
| WAU | 같은 RPC — 최근 7일 롤링 |
| MAU | 같은 RPC — 최근 30일 롤링 |

**"활동"의 정의**: 유저를 식별할 수 있는 모든 행동. 기록 생성과 수정, 미디어, 반복 등록, 리뷰, 댓글, 리뷰·댓글 좋아요, 티켓, 티켓 사진, 무용수 등록, 브랜드 찜, 저장 4종(장소·선생님·바·센터), 공지 읽기, 팝업 닫기, 문의, 그리고 `user_id`가 있는 공연 조회·예매 클릭·브랜드 링크 클릭. 총 22개 UNION 브랜치.

> **앱 진입 자체를 남기는 테이블이 없다.** 들어와서 아무것도 안 하고 나간 사람은 잡히지 않으므로 실제 방문자보다 적게 나온다. 방문자를 정확히 세려면 세션 로그 테이블이나 GA 연동이 필요하다.

> **`records`는 `created_at`과 `updated_at`을 모두 본다.** 반복 기능 도입 이후 "미리 만들어둔 예정에 감정을 채워 완료로 바꾸는 것"이 핵심 활동이 됐는데, 이건 UPDATE라 `created_at`이 바뀌지 않는다. `created_at`만 보면 이 활동이 통째로 누락돼 이탈로 오판한다.

> **`auth.users`와 `profiles`의 행 수는 다르다.** `profiles` 행은 가입 시점이 아니라 프로필 탭 최초 진입 때 만들어진다(`app/(tabs)/profile/page.tsx`). 차이만큼이 "로그인은 했지만 프로필 탭을 안 열어본 사람"이며 탈퇴자가 아니다. 대시보드는 `auth.users` 기준 한 가지만 쓴다 — 두 숫자를 나란히 두면 탈퇴자 수로 오해하기 쉽고, 실제로 얻는 정보도 적다.

### 캘린더

| 지표 | 계산 |
|---|---|
| 캘린더 사용자 수 | `records`(`deleted_at IS NULL`)의 `user_id` DISTINCT |
| 기록 등록 건수 | 같은 조건의 행 수 |
| 완료된 수업 | 위 조건 + `status = 'done'` |
| 예정된 수업 | 위 조건 + `status = 'planned'` |

### 공연

| 지표 | 계산 |
|---|---|
| 공연 사용자 수 | `get_performance_users_count()` — 리뷰, 댓글, 티켓, 조회, 예매 클릭의 `user_id` UNION DISTINCT |
| 티켓·리뷰·댓글 등록 건수 | 각 테이블 `deleted_at IS NULL` 행 수 |
| 공연 조회 수 | `performance_views` 전체 행 수(익명 포함) |
| 예매 클릭 | `performance_booking_clicks` 전체 행 수(익명 포함) |

### 브랜드

| 지표 | 계산 |
|---|---|
| 브랜드 사용자 수 | `get_brand_users_count()` — 찜과 링크 클릭의 `user_id` UNION DISTINCT |
| 찜 건수 | `brand_likes` 중 `deleted_at IS NULL` |
| 외부 링크 클릭 | `brand_link_clicks` 전체 행 수(익명 포함) |

> **브랜드 조회 수(`brand_views`)는 카드에 넣지 않는다.** `lib/brandLinks.tsx`의 `openBrandLink()`가 홈페이지 링크 클릭 시 `link-click`과 함께 기록하는 값이라, 페이지 조회수가 아니라 인기 랭킹 점수(`view수 + 찜수×10`)에 가깝다. 조회수로 보여주면 전환율을 오독하게 된다.

### 일별 추이 차트

| 차트 | 선 | RPC |
|---|---|---|
| 가입자 현황 | 신규 가입 | `get_daily_signup_stats(days)` |
| 캘린더 현황 | 단건 기록, 반복 등록, 유저 수 | `get_calendar_daily_stats(days)` |
| 공연 현황 | 공연 조회, 예매 클릭 | `get_performance_daily_stats(days)` |
| 브랜드 현황 | 외부 링크 클릭, 찜 | `get_brand_daily_stats(days)` |

모두 `days`를 1~30으로 clamp하고 값이 없는 날은 0으로 채운다. 날짜는 전부 KST(`AT TIME ZONE 'Asia/Seoul'`).

> **브랜드 차트의 찜은 `deleted_at`을 보지 않는다.** 그날 찜을 눌렀다는 사실 자체가 그날의 활동이고, 나중에 취소했다고 과거 그래프가 사후에 바뀌면 추세를 읽을 수 없다. 카드의 "찜 건수"는 반대로 현재 유효한 것만 센다 — **카드는 현재 상태, 차트는 그날의 행위**로 기준이 다르다.

> **캘린더 차트에서 단건과 반복을 나눈 이유**: 반복 등록은 하루에 수십 건이 한꺼번에 생긴다(2026-09-04에 90건). 합쳐서 그리면 그 하루가 나머지 추세를 전부 눌러버린다.

## 4. API 목록

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/admin/me` | 현재 사용자 어드민 여부 확인 (id, email, is_admin) |
| GET | `/api/admin/stats` | 대시보드 지표 17개 |
| GET | `/api/admin/stats/signup-trend` | 가입자 일별 추이 (days=1~30) |
| GET | `/api/admin/stats/calendar-trend` | 캘린더 일별 추이 (단건/반복/유저) |
| GET | `/api/admin/stats/performance-trend` | 공연 일별 추이 (조회/예매 클릭) |
| GET | `/api/admin/stats/brand-trend` | 브랜드 일별 추이 (링크 클릭/찜) |
| GET | `/api/admin/records` | 캘린더 기록 목록 (limit, offset) |
| GET | `/api/admin/records/[id]` | 캘린더 기록 상세 + record_media |
| DELETE | `/api/admin/records/[id]/delete` | 캘린더 기록 소프트 삭제 |
| GET | `/api/admin/reviews` | 공연 리뷰 목록 (limit, offset) |
| GET | `/api/admin/reviews/[id]` | 리뷰 상세 + 신고 목록 |
| DELETE | `/api/admin/reviews/[id]/delete` | 리뷰 소프트 삭제 |
| GET | `/api/admin/review-comments` | 공연 댓글 목록 (limit, offset) |
| GET | `/api/admin/review-comments/[id]` | 댓글 상세 + 신고 목록 |
| DELETE | `/api/admin/review-comments/[id]/delete` | 댓글 소프트 삭제 |
| GET | `/api/admin/support-inquiries` | 문의 목록 (limit, offset, q 검색) |
| GET | `/api/admin/support-inquiries/[id]` | 문의 상세 |
| GET | `/api/admin/notices` | 공지 목록 (limit, offset, 전체) |
| GET | `/api/admin/notices/[id]` | 공지 상세 (미게시 포함) |
| POST | `/api/admin/notices` | 공지 등록 |
| PATCH | `/api/admin/notices/[id]` | 공지 수정 |
| DELETE | `/api/admin/notices/[id]` | 공지 삭제 (물리 삭제) |
| GET | `/api/admin/ads` | 광고 목록 (limit, offset) |
| GET | `/api/admin/ads/[id]` | 광고 상세 |
| POST | `/api/admin/ads` | 광고 등록 |
| PATCH | `/api/admin/ads/[id]` | 광고 수정 |
| DELETE | `/api/admin/ads/[id]` | 광고 삭제 (물리 삭제) |
| GET | `/api/admin/members` | 회원 목록 (limit, offset) |
| GET | `/api/admin/members/[id]` | 회원 상세 + 활동 요약(기록/리뷰/댓글 건수) |
| GET | `/api/ads` | 앱 광고 슬롯 조회 (placement 기준, 활성 1건) |
| POST | `/api/ads/[id]/click` | 광고 클릭 집계(+1) |

모든 어드민 API는 `Authorization: Bearer <session.access_token>` 필요. `getAdminFromRequest` 실패 시 401/403 반환.

## 5. CRUD 범위

### 캘린더 기록 관리

- **목록**: records + profiles(nickname, avatar_url), deleted_at IS NULL, 페이징.
- **상세**: 단일 record + record_media. 수정 폼은 제공하지 않음(계획상 수정 API 없음).
- **삭제**: 소프트 삭제(`deleted_at` 설정)만.

### 공연 리뷰/댓글 관리

- **리뷰/댓글 목록**: 각각 목록 API, 신고 건수 표시.
- **상세**: 리뷰 또는 댓글 + 신고 목록(reason_code, reason_detail, reporter, created_at). `lib/reports.ts`의 REPORT_REASON_OPTIONS로 reason_code 라벨 매핑.
- **삭제**: 리뷰/댓글 각각 소프트 삭제.

### 공지사항 관리

- **목록**: notices 전체(is_published 무관), 페이징(limit, offset).
- **상세**: 단일 공지(미게시 포함). 수정 폼(제목, 내용, 게시여부), 삭제(물리 삭제) 제공.
- **등록**: POST로 title, content, is_published. 게시 시 published_at 설정.
- **수정**: PATCH로 title, content, is_published. 미게시→게시 전환 시 published_at 설정.
- **삭제**: 물리 삭제(notices 테이블에 deleted_at 없음).

### 문의 관리

- **목록**: `support_inquiries` (deleted_at IS NULL), 제목/내용 검색(q), 페이징. `created_at DESC` 정렬.
- **상세**: 단일 문의 조회. 수정·삭제 기능 없음(읽기 전용).

### 광고 관리

- **범위**: `calendar_home`, `performance_home`, `profile_home` 3개 슬롯 관리.
- **등록/수정 필드**: placement, title, description(선택), image_url, target_url, is_active, start_at/end_at(KST 입력).
- **정책**: 초기 공급자는 `b2b` 고정. 동일 슬롯에서 기간이 겹치는 활성 광고는 1건만 허용.
- **조회/노출**: 앱은 `/api/ads?placement=...`로 현재 시점 유효 광고 1건 조회(활성 + 기간 내).
- **집계**: 클릭 시 `/api/ads/[id]/click` 호출로 `click_count`, `last_clicked_at` 업데이트.
- **삭제**: 물리 삭제(ads 테이블).

### 회원 관리

- **목록**: profiles (deleted_at IS NULL), nickname, created_at, (선택) 기록 수/리뷰 수. 기록 수는 **전체 기준(완료+예정 모두 포함, deleted_at 제외)** — 어드민 전 영역이 전체 기준으로 일관(2026-09-04, `get_activity_counts_by_user_ids` RPC에서 status 필터 제거).
- **상세**: 프로필 정보 + 해당 사용자의 records/reviews/comments 건수. 활동 정지 기능 없음. 삭제(회원 탈퇴/소프트 삭제)는 별도 정책에 따라 구현 가능하며 1차는 조회 위주.

## 6. DB

- **어드민 권한**: `profiles.is_admin` (boolean, 기본값 false). Supabase 대시보드에서 수동으로 true 설정.
- **마이그레이션**: `docs/sql/add_profiles_is_admin.sql` 참고.
- **광고 테이블**: `ads` (`placement`, `provider`, `title`, `image_url`, `target_url`, `is_active`, `start_at`, `end_at`, `click_count`, `last_clicked_at`, `created_at`, `updated_at`).
- **광고 마이그레이션**: `docs/sql/create_ads_table.sql` 참고.
- **인덱스**: `support_inquiries_created_at_idx` (`created_at DESC`) — ORDER BY 성능 개선용으로 추가됨.
- **인덱스**: `idx_ad_dismissals_user_id` (`ad_dismissals.user_id`) — 미인덱스 FK 해소용(2026-07-14 추가). PK가 `(ad_id, user_id)` 복합이라 user_id 단독 조회가 커버되지 않던 문제를 보완. `ad_dismissals_user_id_fkey → auth.users [ON DELETE CASCADE]`라 계정 완전삭제(purge) 시 CASCADE 검사가 seq scan 되던 것을 인덱스 스캔으로 개선.

### 대시보드 지표용 RPC (2026-09-20)

| 함수 | 용도 |
|---|---|
| `get_active_user_stats()` | DAU/WAU/MAU를 한 번에 반환. 22개 UNION 브랜치 |
| `get_total_auth_users_count()` | 총 가입자(탈퇴 포함) |
| `get_calendar_users_count()` | 기록을 남긴 유저 수 |
| `get_performance_users_count()` | 리뷰, 댓글, 티켓, 조회, 예매 클릭 UNION |
| `get_brand_users_count()` | 찜, 링크 클릭 UNION |
| `get_daily_signup_stats(days)` | 가입자 일별 |
| `get_calendar_daily_stats(days)` | 캘린더 일별(단건/반복/유저) |
| `get_performance_daily_stats(days)` | 공연 일별(조회/예매) |
| `get_brand_daily_stats(days)` | 브랜드 일별(링크 클릭/찜) |

모두 `SECURITY DEFINER` + `search_path` 고정 + **`service_role`에만 `EXECUTE`**. 어드민 API 라우트가 service role 클라이언트로만 호출한다. `anon`/`authenticated`에는 권한을 주지 않는다.

> `get_active_user_stats()`는 22개 테이블을 훑어 약 65ms 걸린다. 대시보드 진입 시 한 번만 호출되므로 문제없지만, 3개로 쪼개면 같은 UNION을 세 번 스캔하게 되므로 하나로 둔다.

### 조회·클릭 로그의 `user_id` (2026-09-20)

`performance_views`, `performance_booking_clicks`, `brand_link_clicks`에 `user_id uuid NULL`(FK → `auth.users`, `ON DELETE SET NULL`)과 부분 인덱스(`WHERE user_id IS NOT NULL`)를 추가했다. 공연·브랜드 사용자 수에 조회자와 클릭자를 포함하기 위해서다.

- **nullable이어야 한다** — 비로그인 방문자의 조회도 그대로 집계해야 하고, 추가 이전 행은 전부 NULL이다.
- 기록은 `getOptionalUserFromRequest()`(`lib/apiAuth.ts`)를 쓴다. 토큰이 없거나 검증에 실패해도 401을 내지 않고 익명으로 남긴다. `getUserFromRequest`를 쓰면 비로그인 조회가 통째로 막힌다.
- 클라이언트는 `useAuth()`의 `session`에서 토큰을 꺼내 **인자로 넘긴다**. 함수 안에서 `getSession()`을 `await`하면 사용자 제스처 컨텍스트가 끊겨 `window.open`이 팝업 차단에 걸린다.
- **세 테이블의 공개 SELECT 정책을 제거했다.** 집계 카운트를 누구나 읽도록 열려 있었는데, `user_id`가 붙으면 "누가 어떤 공연을 봤는지"가 노출된다. 화면이 쓰는 조회수는 `performance_engagement_summaries`, `brand_engagement_summaries` 뷰(`relrowsecurity = false`, `COUNT(*)`만 노출)를 통해서만 읽으므로 닫아도 영향이 없다.

### 활동 집계용 인덱스 (2026-09-20)

`get_active_user_stats()`가 날짜로 훑는 테이블 중 `created_at` 인덱스가 3개뿐이어서 15개를 추가했다(`records`는 `updated_at`도). 현재 데이터량(수천 건)에서는 없어도 빠르지만 계속 커지는 테이블들이다.

> **정리(purge) 정책은 아직 없다.** 조회·클릭 로그와 `cron_job_runs`에 오래된 행을 지우는 작업이 전혀 없다. 지금 규모(전부 합쳐 1,300행)에서는 문제가 아니지만 언젠가 필요해진다.
