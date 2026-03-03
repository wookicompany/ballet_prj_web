# AGENTS 작업 규칙

이 문서는 이 프로젝트에서 작업하는 에이전트가 따라야 할 규칙과 가이드라인을 정의한다.

## UI/디자인

- 디자인은 `shadcn/ui`를 적극 활용한다.
- 컴포넌트는 우선 `shadcn/ui` 컴포넌트로 구성하고, 부족한 경우에만 커스텀한다.
- 전역 스타일 추가는 최소화하고, Tailwind 유틸로 해결을 우선한다.
- 아이콘 사용 시 `lucide-react`를 우선 사용한다.
- UI는 모바일 앱에 친화적으로 구성한다.
- 일반 사용자 앱 화면에서는 **모바일 전용 패턴**(예: `MobileContainer`, `max-w-[430px]` 중앙 정렬)을 사용한다. 웹 전용 영역(예: 어드민 `/wookicompany/admin`)은 예외로 한다.
- 텍스트 입력 시에는 `text-base`를 사용한다.
- 텍스트 조회 시에는 `text-sm`을 사용한다.
- 텍스트 조회 시 헤더는 `text-base`를 사용한다.
- 플레이스홀더는 `text-xs`를 사용하고, 텍스트 필드의 y축 중간점에 맞춘다.
- 사용자 에러/안내 메시지는 인라인 텍스트 대신 `sonner` toast로 처리한다.
- 확인/경고 알림은 `window.confirm` 대신 `shadcn/ui`의 `AlertDialog`를 사용한다.
- 기본 폰트는 프리탠다드(Pretendard)를 사용한다.
- 톤앤보이스는 다정한 어요체를 사용한다.
- 색상 팔레트는 다음을 기본으로 사용한다.
  - 브랜드 색상: `#FF154A` (최소한으로 사용)
  - 베이스 다크: `#17171c`
  - 베이스 라이트: `#FFFFFF`

## shadcn/ui 사용 규칙

- shadcn 관련 구현(검색/추가/예시 확인)은 Cursor의 shadcn MCP를 우선 사용한다.
- 컴포넌트 추가는 기본적으로 MCP를 통해 수행하고, 필요 시에만 CLI를 직접 사용한다.
- CLI를 직접 사용할 때는 반드시 shadcn 공식 명령어를 사용한다.
  - 예: `npx shadcn@latest add button`
- 추가된 컴포넌트는 `components/ui/` 아래에 위치한다.
- 이 프로젝트의 shadcn/ui 컴포넌트는 `components/ui/` 경로에서 관리한다.

## Supabase 규칙

- Supabase 연동은 Cursor MCP를 우선 사용해 구현한다.
- 테이블 생성/변경은 MCP의 SQL 실행 또는 마이그레이션을 우선 사용한다.
- 타입 생성이 필요하면 MCP 도구(`generate_typescript_types`)를 사용한다.
- CRUD는 서버 라우트에서 권한 검증 후 service role로 처리한다. (특히 INSERT/UPDATE/DELETE)
- PATCH/DELETE 시 해당 행을 먼저 조회한 뒤, 없으면 404, 타인 소유면 403을 반환한 다음 수정/삭제한다.
- `deleted_at` 기준으로 조회/수정/이미지·미디어 추가를 모두 차단한다.
- 데이터 삭제 시, 데이터는 우선 소프트 삭제로 처리하고, 소프트 삭제일(`deleted_at`)로부터 30일이 지난 데이터는 하드 삭제한다.
- 소프트 삭제는 사용자 연관 테이블에 `deleted_at` 기준을 일관 적용하고, 신규/기존 테이블 모두 동일 규칙으로 맞춘다.
- 회원탈퇴 시 `auth.users`는 유지하고 `user_metadata.soft_deleted_at`로 탈퇴 상태를 기록한다.
- 30일 경과 하드 삭제는 Supabase `pg_cron` 기준으로 하루 1회(KST 새벽) 배치로 수행한다.
- 동일 소셜 계정 재로그인 시 `soft_deleted_at`를 제거해 즉시 재활성화하고, 기존 소프트 삭제 데이터는 계속 비노출 상태로 유지한다.
- 평점(1~10), mood(1~5) 같은 범위는 서버에서 최종 검증한다.
- 파일 업로드는 클라이언트에서 처리하고, 메타데이터 저장은 서버 API로 통일한다.

## 인증

- API 라우트에서 사용자 인증은 `lib/apiAuth.ts`의 `getUserFromRequest`를 사용한다. (공통화 유지)
- 클라이언트에서 API 호출용 액세스 토큰 취득은 `lib/authSession.ts`의 `getAccessToken(openLoginSheet)`를 사용한다. (공통화 유지)
- OAuth 로그아웃/회원탈퇴 구현은 provider 분기(`kakao`, `apple`)를 명시적으로 적용하고, 카카오는 로그아웃 시 카카오계정 포함 로그아웃/회원탈퇴 시 Unlink 선행 원칙을 따른다.

## 프로젝트 구조

- App Router(`app/`) 구조를 유지한다.
- 공용 로직은 `lib/`에 둔다.
- UI 컴포넌트는 `components/` 하위로 관리한다.

## 환경변수/시크릿

- 환경변수는 `.env.local`에만 관리한다.
- `.env.local`은 절대 커밋하지 않는다.

## 검증

- UI 변경 후에는 `npm run dev`로 최소 렌더링 확인을 한다.
- Supabase 변경 후에는 관련 화면 또는 쿼리가 정상 동작하는지 확인한다.
