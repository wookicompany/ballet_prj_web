# React Native WebView 연동 가이드 (마이발레 웹)

RN 앱에서 마이발레 웹을 WebView로 붙일 때 참고할 내용이다.

---

## 1. 기본 구성

- **라이브러리**: `react-native-webview` 사용 권장.
- **로드 URL**
  - 프로덕션: **`https://www.myballet.co.kr/`**
  - 개발: 같은 웹 앱을 로컬/스테이징에서 서빙하는 URL (예: `https://your-dev-url.vercel.app`).
- **진입 경로 (확정: 상황별)**  
  - **기본**: 앱 아이콘 등으로 진입 시 `https://www.myballet.co.kr/calendar` (또는 `/`) 로드.  
  - **푸시·딥링크**: 알림/딥링크 payload에 `link`(또는 동일 용도 필드)로 전달된 URL로 WebView 로드. 예: 댓글 알림 탭 시 `https://www.myballet.co.kr/performance/[id]/reviews/[reviewId]`.
- **레이아웃**: 웹이 모바일 퍼스트(`max-w-[430px]` 중앙 정렬)라, WebView는 화면 전체를 채우면 됨 (`flex: 1` 등).

---

## 2. 로그인(인증) 처리

- 웹은 **Supabase Auth** 사용, 로그인 제공자는 **카카오·구글**.
- **콜백 URL**: 웹 쪽에서 `window.location.origin + '/auth/callback'` 로 설정되어 있음.  
  → WebView에서 `https://www.myballet.co.kr` 을 로드하면 콜백 주소는 `https://www.myballet.co.kr/auth/callback` 이 됨.

**채택: OAuth를 WebView 안에서 끝내기 (확정)**

- WebView에서 웹 앱 URL만 로드하고, 로그인 버튼 탭 시 웹이 Supabase → 카카오/구글 로 리다이렉트.
- OAuth 완료 후 리다이렉트가 다시 **같은 웹 도메인** `/auth/callback` 으로 돌아오도록 하면, 그 요청도 WebView 안에서 처리됨.
- 세션은 Supabase 클라이언트가 WebView의 스토리지(localStorage 등)에 저장하므로, **RN에서 토큰을 넘겨줄 필요 없음**. 같은 WebView/같은 도메인으로 계속 쓰면 로그인 유지됨.

**RN 측 필수 설정**

- WebView에서 **해당 웹 도메인(www.myballet.co.kr) + Supabase/Kakao/Google 등 OAuth 관련 도메인**으로의 이동을 허용 (리다이렉트 막지 않기, 일부 환경에서는 `thirdPartyCookies` 또는 도메인 허용 목록 확인).
- iOS: `http` 로 개발용 URL 쓸 경우 `Info.plist` 에 ATS 예외(해당 호스트) 추가.
- Android: `http` 사용 시 `android:usesCleartextTraffic="true"` 또는 네트워크 보안 설정으로 해당 호스트만 허용.

*(참고: 외부 브라우저 로그인 후 딥링크 복귀 방식(B)은 미채택. 정책/UX 변경 시 검토.)*

---

## 3. 네비게이션·뒤로가기

- **Android 하드웨어 백**: WebView 내부 히스토리가 있으면 `goBack()`, 없으면 앱 네비(예: 이전 화면) 처리하는 식으로 분기하는 것을 권장.
- **외부 링크 (확정: 일부만)**  
  - **같은 도메인** (`https://www.myballet.co.kr/...`): WebView 안에서 로드.  
  - **다른 도메인** (`https://...`), **tel:**, **mailto:** : WebView 로드 막고 **시스템 브라우저** 또는 **전화/메일 앱**으로 열기.  
  - `onShouldStartLoadWithRequest`(또는 해당 라이브러리 API)에서 URL 판별 후 위 규칙 적용.

---

## 4. RN ↔ 웹 postMessage 연동 (채택: 함)

**채택 이유:** 웹에서 버튼·스위치 등 액션 시 앱에서 **햅틱(진동)** 을 울리려면 웹→RN 신호가 필요함.

- **웹**: 액션 컴포넌트(버튼, 스위치 등) 탭 시 `window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'haptic' }))` 호출.
- **RN**: `onMessage` 로 수신 후 `type === 'haptic'` 이면 네이티브 햅틱 API 호출.
- **기타**: RN→웹은 `injectJavaScript` 로 전역 함수/이벤트 전달. 딥링크·공유 등 추가 이벤트는 필요 시 `type` 확장.

### 4.1 로그아웃/회원탈퇴 해제 이벤트 (고정 스펙)

- **허용 타입(대소문자 고정):**
  - `logout`
  - `account_deleted`
- **고정 포맷:** `{ "type": "<type>", "version": 1 }`
- **발신 시점(웹 기준):**
  - `logout`: 로컬 세션 정리 직전(아직 access token이 유효할 때)
  - `account_deleted`: 회원탈퇴 API 성공 후, 로컬 세션 정리 직전
- **웹 구현 지점:**
  - 일반 provider 로그아웃/회원탈퇴: `app/profile/menu/page.tsx`
  - 카카오 로그아웃: `app/auth/kakao/logout/callback/page.tsx`에서만 송신(중복 송신 방지)
- **RN 수신 규칙:**
  - 위 두 타입 + `version: 1`만 처리
  - 처리 시 공통으로 `POST /api/profile/expo-push-token` with `{ "expo_push_token": "" }` 호출
  - 스펙 외 타입/버전은 무시하고 경고 로그만 남김

**알림 배너(댓글/좋아요) 구현 (확정):** postMessage 아님. **마이발레 Vercel API** 에서 댓글/좋아요 생성 시 수신자 `expo_push_token`을 Supabase에서 조회한 뒤 **Expo Push API 호출**. Supabase는 DB·토큰 저장만 사용. RN은 Expo 토큰을 등록하고 푸시 수신 시 배너 표시·탭 시 해당 URL로 WebView 이동.

- RN 토큰 등록 API: `POST /api/profile/expo-push-token`
- 요청 본문: `{ "expo_push_token": "ExponentPushToken[...]" }` (`""` 전송 시 토큰 제거)
- RN 토큰 발급: `Notifications.getExpoPushTokenAsync({ projectId })`
  - `projectId`는 RN `app.json`의 `extra.eas.projectId`와 일치해야 함
- 현재 알림 payload는 제목 중심으로 전송됨 (body는 선택값).

---

## 5. 체크리스트 요약

| 항목 | 내용 |
|------|------|
| 라이브러리 | `react-native-webview` |
| URL / 진입 | 프로덕션 `https://www.myballet.co.kr/` · **상황별 (확정)** 기본 `/calendar`, 푸시·딥링크 시 payload URL로 로드 |
| 로그인 | **WebView 내 OAuth (확정)** · 콜백 `https://www.myballet.co.kr/auth/callback` |
| postMessage | **함 (확정)** · 햅틱 + 해제 이벤트(`logout`, `account_deleted`, `version:1`) |
| 세션 | WebView 스토리지에 자동 저장, RN에서 별도 토큰 전달 불필요 |
| iOS | `http` 사용 시 ATS 예외, OAuth 도메인 허용 |
| Android | `http` 사용 시 cleartext/네트워크 보안 설정 |
| 백 버튼 | WebView 히스토리 `goBack()` 우선, 없으면 앱 네비 |
| 외부 링크 | **일부만 (확정)** · 같은 도메인 WebView, 그 외·tel·mailto는 브라우저/앱 |

---

웹 앱 메타 타이틀/설명: **마이발레** / *마이발레는 나의 발레를 기록하는 서비스예요.* (필요 시 WebView 상단 타이틀 등에 활용 가능).
