# 마이발레 (ballet_prj_web)

발레 기록 · 공연 탐색 · 브랜드 탐색을 하나로 묶은 모바일 웹앱입니다. React Native WebView 앱 안에서 구동되며, 일반 브라우저에서도 동일하게 동작하는 하이브리드 구조입니다.

## 기술 스택

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Tailwind CSS v4**
- **Supabase** — PostgreSQL DB + Auth(카카오/애플 OAuth)
- **Vercel** — 배포

## 빠른 시작

### 사전 요건

- Node.js (Next.js 16 / React 19 호환 버전)
- `.env.local` — 아래 [환경변수](#환경변수) 참고. 실값은 팀 시크릿 저장소에서 전달받아 구성합니다.

### 설치 및 실행

```bash
npm install
npm run dev
```

`http://localhost:3000` 에서 확인합니다.

## npm 스크립트

| 스크립트 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 타입 체크 + 프로덕션 빌드. **코드 변경 후 반드시 통과를 확인합니다.** |
| `npm run start` | 프로덕션 빌드 결과 실행 |
| `npm run lint` | ESLint 검사 |

## 환경변수

`.env*` 파일은 `.gitignore`에 포함되어 있어 커밋되지 않습니다. 아래는 코드에서 실제로 참조하는 키 이름만 정리한 것이며, **실값은 팀 시크릿 저장소에서 받아 `.env.local`에 채웁니다.**

### Public (`NEXT_PUBLIC_*`)

| 키 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 클라이언트(anon) 키 |
| `NEXT_PUBLIC_KAKAO_REST_API_KEY` | 카카오 로그인/연동 REST API 키 |
| `NEXT_PUBLIC_SITE_URL` | 서버 사이드에서 절대 URL 생성 시 사용하는 배포 도메인 |
| `NEXT_PUBLIC_GA_ID` | Google Analytics 측정 ID |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | Google AdSense 클라이언트 ID |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry 에러 트래킹 DSN(클라이언트) |

### Server (서버에서만 사용, 노출 금지)

| 키 | 용도 |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role 키. 서버 라우트의 INSERT/UPDATE/DELETE에 사용 |
| `KAKAO_ADMIN_KEY` | 카카오 관리자 API 키(회원 연결 해제 등) |
| `APPLE_CLIENT_ID` | 애플 로그인 클라이언트 ID(회원 탈퇴 처리용) |
| `APPLE_CLIENT_SECRET` | 애플 로그인 클라이언트 시크릿 |
| `KOPIS_API_KEY` | KOPIS(공연예술통합전산망) Open API 서비스 키 |
| `CRON_SECRET` | Vercel Cron 요청 인증용 시크릿 |
| `CRON_ACTIVE_YEAR` | 지정 시 해당 연도(KST)에만 크론 작업 활성화 |
| `EXPO_ACCESS_TOKEN` | Expo 푸시 알림 발송 인증 토큰 |
| `SENTRY_DSN` | Sentry 에러 트래킹 DSN(서버/엣지) |

`VERCEL_URL`은 Vercel 배포 시 플랫폼이 자동 주입하므로 직접 설정하지 않습니다(`NEXT_PUBLIC_SITE_URL` 미설정 시 폴백으로 사용됨).

## 아키텍처 요약

`app/(tabs)/`에 캘린더·공연·브랜드·프로필 탭이 있고, `app/day`·`app/record`·`app/performance`·`app/brand`가 상세 화면, `app/api`가 Route Handler, `app/wookicompany/admin`이 내부 어드민입니다. 모든 API는 `lib/apiAuth.ts`의 유저/어드민 인증 헬퍼를 거치고, 클라이언트는 `lib/*Cache.ts` 모듈 스코프 캐시로 재fetch를 줄입니다. 날짜는 전부 KST 기준(`lib/kstDateTime.ts`), RN 앱과는 `lib/reactNativeWebView.ts` 브릿지로 통신합니다. 상세 관례는 [`CLAUDE.md`](./CLAUDE.md) 참고.

## 디렉토리 구조

```
app/         # 라우트(페이지 + API Route Handler + 어드민)
lib/         # 인증, Supabase 클라이언트, 캐시, 날짜 유틸 등 공용 로직
components/  # UI 컴포넌트(shadcn/ui 기반)
docs/        # 스펙·디자인·연동 문서
```

## 브랜치 전략 · 배포

- 작업은 `develop` 브랜치에서 커밋 후 push합니다.
- `main` 반영: `git merge --no-ff develop` → `npm run build` 확인 → push.
- Vercel이 `main` 브랜치를 프로덕션으로 자동 배포합니다.

## 관련 문서

- [`CLAUDE.md`](./CLAUDE.md) — 커맨드·아키텍처·핵심 관례 요약
- [`docs/app_spec.md`](./docs/app_spec.md) — 앱 기능 스펙
- [`docs/admin_spec.md`](./docs/admin_spec.md) — 어드민 기능·데이터 모델 스펙
- [`docs/design.md`](./docs/design.md) — UI·디자인 토큰 규칙
- [`docs/APP_AGENTS.md`](./docs/APP_AGENTS.md) — 앱 화면·API 구현 규칙
- [`docs/ADMIN_AGENTS.md`](./docs/ADMIN_AGENTS.md) — 어드민 구현 규칙
- [`docs/PRD/`](./docs/PRD/) — 제품 요구사항 문서
- [`docs/KOPIS/`](./docs/KOPIS/) — KOPIS Open API 연동 가이드
- [`docs/RN/`](./docs/RN/) — RN WebView 연동 문서
- [`docs/Apple%20Login/`](./docs/Apple%20Login/) — 애플 로그인 시크릿 로테이션 가이드

## 참고

- PM/디자이너/엔지니어 3역할 서브에이전트로 스펙 → 디자인 → 구현을 나눠 작업합니다. 정의는 `.claude/agents/`를 참고하세요.
- 외부 연동: KOPIS(공연 데이터 동기화), Expo(푸시 알림), 카카오/애플(OAuth).
