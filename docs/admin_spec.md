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

- **사용자 유입**
  - 총 가입자 수: `profiles` 중 `deleted_at IS NULL` 행 수.
- **캘린더**
  - 캘린더 기록 등록 건 수: `records` 중 `deleted_at IS NULL` 행 수.
  - 캘린더 사용자 수: 위 records의 `user_id` DISTINCT 수.
- **공연**
  - 공연 리뷰 등록 건 수: `performance_reviews` 중 `deleted_at IS NULL` 행 수.
  - 공연 댓글 등록 건 수: `performance_review_comments` 중 `deleted_at IS NULL` 행 수.
  - 공연 사용자 수: 리뷰 또는 댓글 1회 이상 등록한 `user_id`의 DISTINCT 수.

**API**: `GET /api/admin/stats` (Bearer 토큰 필수)

## 4. API 목록

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/admin/me` | 현재 사용자 어드민 여부 확인 (id, email, is_admin) |
| GET | `/api/admin/stats` | 대시보드 지표 6개 |
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
