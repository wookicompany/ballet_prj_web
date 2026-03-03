# 전체 화면(페이지) 목록

라이트 모드만 사용하도록 강제하기 위해 참고하는 화면 목록입니다.

## 앱 라우트별 페이지 (31개)

| 경로 | 파일 |
|------|------|
| `/` | `app/page.tsx` |
| `/(tabs)/calendar` | `app/(tabs)/calendar/page.tsx` |
| `/(tabs)/performance` | `app/(tabs)/performance/page.tsx` |
| `/(tabs)/profile` | `app/(tabs)/profile/page.tsx` |
| `/day/[date]` | `app/day/[date]/page.tsx` |
| `/record/new` | `app/record/new/page.tsx` |
| `/record/[id]` | `app/record/[id]/page.tsx` |
| `/record/[id]/edit` | `app/record/[id]/edit/page.tsx` |
| `/profile/edit` | `app/profile/edit/page.tsx` |
| `/profile/menu` | `app/profile/menu/page.tsx` |
| `/profile/data-management` | `app/profile/data-management/page.tsx` |
| `/notice` | `app/notice/page.tsx` |
| `/notice/[id]` | `app/notice/[id]/page.tsx` |
| `/support` | `app/support/page.tsx` |
| `/policy` | `app/policy/page.tsx` |
| `/policy/community-rules` | `app/policy/community-rules/page.tsx` |
| `/policy/privacy` | `app/policy/privacy/page.tsx` |
| `/policy/terms` | `app/policy/terms/page.tsx` |
| `/calendar/settings` | `app/calendar/settings/page.tsx` |
| `/calendar/settings/bar-orders` | `app/calendar/settings/bar-orders/page.tsx` |
| `/calendar/settings/center-orders` | `app/calendar/settings/center-orders/page.tsx` |
| `/calendar/settings/instructor-levels` | `app/calendar/settings/instructor-levels/page.tsx` |
| `/calendar/settings/locations` | `app/calendar/settings/locations/page.tsx` |
| `/performance/search` | `app/performance/search/page.tsx` |
| `/performance/search-input` | `app/performance/search-input/page.tsx` |
| `/performance/[id]` | `app/performance/[id]/page.tsx` |
| `/performance/[id]/reviews/new` | `app/performance/[id]/reviews/new/page.tsx` |
| `/performance/[id]/reviews/[reviewId]` | `app/performance/[id]/reviews/[reviewId]/page.tsx` |
| `/performance/[id]/reviews/[reviewId]/edit` | `app/performance/[id]/reviews/[reviewId]/edit/page.tsx` |
| `/auth/callback` | `app/auth/callback/page.tsx` |
| `/auth/kakao/logout/callback` | `app/auth/kakao/logout/callback/page.tsx` |

## 다크 모드 관련

- **globals.css**: `@media (prefers-color-scheme: dark)` 로 시스템 다크 모드 시 `:root` 변수가 어두운 값으로 바뀜.
- **컴포넌트**: `components/ui/*` 에서 `dark:` Tailwind 클래스 사용 (button, input, drawer, badge 등).
- **강제 라이트**: `prefers-color-scheme: dark` 미디어쿼리 제거 + 필요 시 `color-scheme: light` 지정 시 전체가 라이트로 고정됨.
