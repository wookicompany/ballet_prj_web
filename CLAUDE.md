# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # TypeScript 타입 체크 + 프로덕션 빌드 (변경 후 반드시 확인)
npm run lint     # ESLint
```

> **중요**: DB 컬럼 추가/변경 시 반드시 `lib/database.types.ts`를 수동으로 업데이트해야 빌드가 통과됨. Supabase CLI로 자동 생성하지 않음.

## Git 브랜치 전략

- **작업**: `develop` 브랜치에서 커밋 후 push
- **main 반영**: `git merge --no-ff develop` → 빌드 확인 → push
- **sync**: main → develop은 반드시 `git merge --ff-only main` 사용 (`--no-ff` 사용 시 불필요한 머지 커밋 생성됨)

## 아키텍처 개요

**마이발레** — 발레 기록·공연 탐색·브랜드 탐색 모바일 웹앱. React Native WebView 앱 내에서 구동되며 브라우저에서도 동작.

> 상세 스펙·규칙은 `docs/`에 있음: `app_spec.md`(앱 기능), `admin_spec.md`(어드민·DB 인덱스), `design.md`(디자인 토큰·컴포넌트), `APP_AGENTS.md`/`ADMIN_AGENTS.md`(구현 규칙), `PRD/`·`KOPIS/`·`RN/`·`Apple Login/`(도메인별). 온보딩 진입점은 `README.md`. 이 파일과 중복되는 내용은 두지 않고 링크로 위임.

### 핵심 스택

- **Next.js 16 App Router** + React 19, TypeScript 5, Tailwind CSS v4
- **Supabase**: DB(PostgreSQL) + Auth(카카오·애플 OAuth). 클라이언트는 `lib/supabaseClient.ts`, 서버 Admin은 `lib/supabaseAdmin.ts`
- **배포**: Vercel (main 브랜치 자동 배포)

### 레이아웃 구조

```
app/
├── (tabs)/          # 탭 바 레이아웃 (캘린더·공연·브랜드·프로필)
│   ├── layout.tsx   # MobileContainer + TabBar + FloatingButton
│   ├── calendar/    # 발레 기록 캘린더
│   ├── performance/ # 공연 탐색
│   ├── brand/       # 브랜드 탐색
│   └── profile/     # 프로필·통계
├── day/[date]/      # 일별 타임라인
├── record/[id]/     # 기록 상세·수정
├── performance/[id]/# 공연 상세·리뷰
├── brand/[id]/      # 브랜드 상세
├── notifications/   # 알림 목록
├── u/[id]/          # 공개 유저 프로필 (SNS 공유)
├── api/             # Next.js Route Handlers (서버사이드 API)
└── wookicompany/admin/ # 내부 어드민 페이지
```

모든 유저 facing 페이지는 `MobileContainer`(`max-w-[430px]`)로 감싸져 모바일 퍼스트로 렌더링됨.

### API 인증 패턴

모든 API Route Handler는 `lib/apiAuth.ts`의 두 헬퍼 중 하나를 사용:
- `getUserFromRequest(request)` — 일반 유저 인증
- `getAdminFromRequest(request)` — 어드민 전용 (`profiles.is_admin = true` 확인)

클라이언트에서 API 호출 시 `lib/authSession.ts`의 `getAccessToken(openLoginSheet)`으로 Bearer 토큰 획득.

### Supabase 데이터 규칙

- INSERT/UPDATE/DELETE는 **서버 API Route에서 service role로만** 수행(클라이언트는 조회 위주).
- PATCH/DELETE 전 대상 행의 소유권을 먼저 조회 — 없으면 404, 타인 소유면 403.
- 삭제는 **소프트 삭제(`deleted_at`)** 기본. 조회·수정·미디어 추가 시 `deleted_at IS NULL` 일관 적용.
- 1000행 초과 조회는 `lib/fetchAllRows.ts` 사용(Supabase 기본 1000행 상한 회피).
- 이미지 업로드 전 `lib/compressImage.ts`로 압축.

### 디자인 토큰

- 색상은 `app/globals.css`의 CSS 변수 토큰을 쓰고 hex 하드코딩을 지양.
- **브랜드 강조색** `--brand`(#E8517C) — `text-brand`/`bg-brand` 등. 별점·좋아요 하트 등.
- **알림 신호색** `--alert`(#FF154A) — 미읽음 배지 등. 브랜드색과 **의도적으로 분리**(알림 대비 우선), 브랜드색으로 통일하지 않음.
- Tailwind v4 주의: arbitrary CSS 변수에 opacity modifier(`bg-[--brand]/20`)는 무시됨 → `--color-*`로 등록된 토큰(`bg-brand/20`)을 써야 opacity가 적용됨.

### 클라이언트 캐시 패턴

페이지 이동 후 돌아올 때 재fetch를 막기 위해 모듈 스코프 in-memory 캐시를 사용. `lib/` 하위의 `*Cache.ts` 파일들이 이 역할을 함.

- **dirty flag 방식**: 기록 생성·수정 후 `sessionStorage`에 `record-changed:*` 키를 설정 → 다음 페이지 진입 시 캐시 무효화 후 재fetch
- 주요 캐시: `calendarHomeCache`, `profileCache`, `performanceHomeCache`, `brandHomeCache` 등

### RN WebView 브릿지

`lib/reactNativeWebView.ts`에서 `window.ReactNativeWebView.postMessage()`로 앱에 메시지 전송:
- `haptic` — 햅틱 피드백
- `auth_token` — 로그인 토큰 전달
- `open_url` — 앱 내 브라우저로 URL 열기
- `health_sync_request` / `health_sync_result` — 헬스 앱 운동 데이터 연동

### 날짜·시간

모든 날짜는 **KST(Asia/Seoul)** 기준. `lib/kstDateTime.ts`의 유틸을 사용하고 `new Date()`를 직접 비교하지 않음.

### 주요 데이터 모델

- `records` — 발레 기록 (record_date, start_time, end_time, mood, content, location, instructor, level, outfit, did_well, improve_next, memo)
- `record_media` — 기록 첨부 미디어 (soft delete: deleted_at)
- `kopis_performances` — 공연 정보 (KOPIS API 기반)
- `performance_reviews` — 공연 리뷰 (soft delete)
- `ballet_brands` — 발레 브랜드
- `brand_likes` / `notice_reads` — 유저 액션 기록
- `profiles` — 유저 프로필 (`is_admin` 플래그 포함)

> `location` 필드 형식: `"장소명 | 주소"` — 파싱 시 `" | "` 앞부분만 사용.
