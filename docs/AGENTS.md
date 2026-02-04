# AGENTS 작업 규칙

이 문서는 이 프로젝트에서 작업하는 에이전트가 따라야 할 규칙과 가이드라인을 정의한다.

## UI/디자인

- 디자인은 shadcn/ui를 적극 활용한다.
- 컴포넌트는 우선 shadcn/ui 컴포넌트로 구성하고, 부족한 경우에만 커스텀한다.
- 전역 스타일 추가는 최소화하고, Tailwind 유틸로 해결을 우선한다.
- 아이콘 사용 시 `lucide-react`를 우선 사용한다.
- UI는 모바일 앱에 친화적으로 구성한다.
- 기본 폰트는 프리탠다드(Pretendard)를 사용한다.
- 톤앤보이스는 다정한 어요체를 사용한다.
- 색상 팔레트는 다음을 기본으로 사용한다.
  - 브랜드 색상: `#ff273d` (최소한으로 사용)
  - 베이스 다크: `#17171c`
  - 베이스 라이트: `#FFFFFF`

## shadcn/ui 사용 규칙

- 컴포넌트 추가는 반드시 CLI 명령어로 수행한다.
  - 예: `npx shadcn@latest add button`
- 추가된 컴포넌트는 `components/ui/` 아래에 위치한다.
- 이 프로젝트의 shadcn/ui 컴포넌트는 `components/ui/` 경로에서 관리한다.

## Supabase 규칙

- Supabase 연동은 Cursor MCP를 우선 사용해 구현한다.
- 테이블 생성/변경은 MCP의 SQL 실행 또는 마이그레이션을 우선 사용한다.
- 타입 생성이 필요하면 MCP 도구(`generate_typescript_types`)를 사용한다.

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
