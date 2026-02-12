# RN WebView 연동 — 웹 쪽 선행 구현 계획

`docs/rn_webview_integration.md` 기준으로, **웹(마이발레)에서 먼저 구현할 수 있는 부분**을 정리한 계획이다. RN 개발자 전달 전에 웹에서 완료할 작업이다.

---

## 개요

| 구분 | 담당 | 웹에서 선행 구현 여부 |
|------|------|------------------------|
| 로그인(OAuth WebView 내) | 웹 이미 구현됨 | ✅ 변경 없음 |
| 진입 경로 / 외부 링크 | RN | ❌ 웹 작업 없음 |
| **햅틱 postMessage** | 웹 → RN | ✅ **웹: postMessage 호출 추가** |
| **알림 배너(FCM)** | 마이발레 Vercel API + FCM | ✅ **웹: 토큰 저장·API에서 FCM 호출** |

---

## 1. 햅틱용 postMessage (웹)

**목표:** 버튼·스위치 등 액션 시 WebView 환경이면 `window.ReactNativeWebView.postMessage({ type: 'haptic' })` 호출.

### 1.1 유틸 추가

- **파일:** `lib/reactNativeWebView.ts` (또는 `lib/hapticWebView.ts`)
- **내용:**
  - `isInReactNativeWebView(): boolean` — `window.ReactNativeWebView != null` 또는 User-Agent 등으로 WebView 환경 판별.
  - `sendHapticToApp(): void` — WebView일 때만 `window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'haptic' }))` 호출. (optional chaining으로 브라우저에서 호출해도 에러 없음.)
- **의존성:** 없음 (브라우저/WebView 전역만 사용).

### 1.2 UI 컴포넌트에 연동

- **Button** (`components/ui/button.tsx`)
  - `onClick` 시 (또는 클릭 핸들러 내) `sendHapticToApp()` 호출.  
  - 또는 Button을 감싸는 wrapper에서 클릭 시 호출.  
  - 기존 동작 유지, WebView가 아니면 no-op.
- **Switch** (`components/ui/switch.tsx`)
  - `onCheckedChange`(또는 동일한 변경 시점) 시 `sendHapticToApp()` 호출.
- **선택:** 공통 클릭/터치를 쓰는 다른 액션 컴포넌트(예: TabBar 아이콘, FloatingButton, 바텀시트 확인 버튼 등)가 있으면 동일하게 호출 검토.

### 1.3 검증

- 브라우저에서만 접속 시: `ReactNativeWebView` 없음 → 호출해도 에러 없이 무시되는지 확인.
- RN WebView에서 로드 시: RN 앱에서 `onMessage`로 `type: 'haptic'` 수신되는지 확인 (RN 구현 후).

---

## 2. 알림 배너 — 마이발레 Vercel API에서 FCM 호출

**목표:** 댓글/리뷰 좋아요/댓글 좋아요 발생 시, 알림 받을 사용자의 `fcm_token`으로 FCM 푸시 발송. 푸시 payload에 `link` 포함해 RN에서 해당 URL로 WebView 로드 가능하게.

### 2.1 DB — FCM 토큰 저장

- **테이블:** `profiles` (기존)
- **추가 컬럼:** `fcm_token` (text, nullable).
- **방법:** Supabase 마이그레이션 또는 대시보드에서 컬럼 추가.
- **동의:** RN에서 토큰 등록 시점·개인정보 처리방침 연동은 RN/앱 정책에 따름. 웹 API는 “로그인 사용자가 보낸 토큰 저장”만 담당.

### 2.2 API — FCM 토큰 등록

- **엔드포인트:** `PATCH /api/profile` 확장 또는 `POST /api/profile/fcm-token` 신규.
- **역할:** 로그인 사용자의 `profiles.fcm_token` 갱신. RN 앱이 로그인/토큰 갱신 시 호출.
- **요청:** body에 `{ fcm_token: string }` (또는 `token`). 빈 문자열이면 토큰 삭제(알림 비수신) 처리 여부는 정책에 따라 결정.
- **인증:** 기존 `getUserFromRequest` 등으로 user_id 확보 후 해당 profile 업데이트.

### 2.3 Firebase / FCM 설정

- Firebase 프로젝트 생성, Android/iOS 앱 등록( RN 쪽에서 사용할 프로젝트와 동일).
- 서비스 계정 키 생성 → JSON 내용을 Vercel 환경 변수에 저장 (예: `FIREBASE_SERVICE_ACCOUNT_KEY`). 코드에서는 파일이 아닌 env에서만 읽기.
- **패키지:** `firebase-admin` (또는 FCM HTTP v1 API를 `fetch`로 호출). Vercel 서버리스에서 동작하도록 초기화 시 env 사용.

### 2.4 FCM 발송 유틸

- **파일:** `lib/fcm.ts` (또는 `lib/notifications/fcm.ts`)
- **함수:** `sendFCMToUser(userId: string, payload: { title: string; body: string; link?: string })`
  - `profiles`에서 `id = userId`인 행의 `fcm_token` 조회.
  - 토큰 없으면 스킵.
  - 있으면 FCM API로 전송. `data`에 `link` 넣어 두어 RN에서 알림 탭 시 해당 URL 로드 가능하게.
- **에러 처리:** FCM 실패 시 로그만 남기고, 댓글/좋아요 API 응답은 성공 유지(푸시 실패가 사용자 액션 실패로 이어지지 않도록). 필요 시 재시도/큐는 후순위.

### 2.5 댓글 생성 시 푸시 (이미 API 있음)

- **위치:** `app/api/review-comments/route.ts` (POST)
- **흐름:**  
  1. 기존대로 `performance_review_comments`에 insert.  
  2. insert 성공 후, 해당 리뷰의 `performance_reviews.user_id`(리뷰 작성자) 조회.  
  3. 리뷰 작성자 ≠ 댓글 작성자이면, 리뷰 작성자에게 FCM 발송.  
     - title/body: 예) "새 댓글", "OOO님이 리뷰에 댓글을 남겼어요" (실제 문구는 기획에 맞게).  
     - link: `https://www.myballet.co.kr/performance/[performance_id]/reviews/[review_id]`.  
  4. FCM 호출은 **비동기**로 처리하고 응답은 기존처럼 댓글 데이터만 반환.

### 2.6 리뷰 좋아요 시 푸시 (현재 클라이언트 직접 insert)

- **현재:** 클라이언트가 `supabase.from("performance_review_likes").insert(...)` 직접 호출.
- **선택지:**
  - **A (권장):** `POST /api/reviews/[id]/like` (또는 `POST /api/performance-reviews/[id]/like`) 신규.  
    - 내부에서 `performance_review_likes` insert.  
    - insert 성공 후 리뷰 작성자 조회, 본인이 아니면 FCM 발송.  
    - 클라이언트는 이 API를 호출하도록 변경 (공연 상세·리뷰 목록 등에서 좋아요 시).
  - **B:** Supabase DB Webhook으로 `performance_review_likes` INSERT 감지 → Webhook이 우리 API URL 호출 → API에서 FCM만 발송.  
    - 클라이언트는 그대로 direct insert.  
    - Webhook 설정·보안(서비스 키 등) 필요.
- **계획 반영:** A로 진행. API 추가 + 클라이언트 호출 변경.

### 2.7 댓글 좋아요 시 푸시 (현재 클라이언트 직접 insert)

- **현재:** 클라이언트가 `performance_review_comment_likes` 직접 insert.
- **선택지:** 리뷰 좋아요와 동일. **A (권장):** `POST /api/review-comments/[id]/like` 신규. insert + 댓글 작성자 조회 후 FCM. 클라이언트는 이 API 호출로 변경.
- **계획 반영:** A로 진행.

### 2.8 푸시 payload 규격 (RN과 협의)

- **공통:** `data`에 `link` (전체 URL 또는 path). RN은 알림 탭 시 이 URL로 WebView 로드.
- **타입별 link 예:**
  - 댓글 알림: `/performance/[performanceId]/reviews/[reviewId]`
  - 리뷰 좋아요: 동일
  - 댓글 좋아요: 동일 (해당 댓글이 속한 리뷰 페이지)

---

## 3. 구현 순서 제안

| 순서 | 작업 | 비고 |
|------|------|------|
| 1 | **햅틱** — `lib/reactNativeWebView.ts` + Button/Switch 연동 | RN 없이 브라우저에서도 안전하게 동작하는지 확인 |
| 2 | **DB** — `profiles.fcm_token` 컬럼 추가 | Supabase 마이그레이션 |
| 3 | **FCM 설정** — Firebase 프로젝트·서비스 계정·Vercel env | RN 앱과 동일 Firebase 프로젝트 사용 |
| 4 | **lib/fcm.ts** — sendFCMToUser 유틸 | 토큰 없음/실패 시 no-op 또는 로그만 |
| 5 | **API** — FCM 토큰 등록 (PATCH profile 또는 POST fcm-token) | RN이 토큰 보낼 엔드포인트 |
| 6 | **API** — POST review-comments 내 FCM 호출 | 댓글 알림 |
| 7 | **API** — POST reviews/[id]/like 신규 + 클라이언트 변경 | 리뷰 좋아요 알림 |
| 8 | **API** — POST review-comments/[id]/like 신규 + 클라이언트 변경 | 댓글 좋아요 알림 |

---

## 4. RN 측에 전달할 정보 (구현 후)

- **햅틱:** 웹에서 `type: 'haptic'` postMessage 전송. RN은 `onMessage`에서 수신 시 네이티브 햅틱 호출.
- **FCM 토큰 등록:** `PATCH /api/profile` (또는 `POST /api/profile/fcm-token`) 요청 스펙·인증 방식.
- **푸시 payload:** `data.link` 등 필드 정의. 알림 탭 시 해당 URL로 WebView 로드.

이 계획대로 진행하면, RN 개발자 전달 전에 웹에서 “햅틱용 postMessage”와 “알림 배너용 FCM 호출”까지 마이발레 쪽에서 구현할 수 있다.
