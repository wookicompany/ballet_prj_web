# RN WebView 연동 — 웹 쪽 고정 계약/검증 계획

`docs/rn_webview_integration.md`를 실행 가능한 형태로 정리한 웹 전용 계획이다.

---

## 1. 범위 (웹 저장소만)

- 대상 저장소: `ballet_prj_web` (Next.js)
- 제외: `ballet_prj_rn` 코드 수정
- 웹 책임:
  - Web→RN 해제 이벤트를 고정 스펙으로 송신
  - `POST /api/profile/expo-push-token` 반영 검증 강화(0-row 성공 오인 방지)
  - 문서/QA 체크리스트 고정

---

## 2. Web→RN 해제 이벤트 고정 스펙

### 2.1 허용 타입/버전

- 허용 타입: `logout`, `account_deleted` (대소문자 고정)
- 버전: `version: 1` 필수
- 고정 포맷:
  - `{ "type": "logout", "version": 1 }`
  - `{ "type": "account_deleted", "version": 1 }`

### 2.2 웹 발신 시점/지점

- `logout`: 로컬 세션 정리 직전
- `account_deleted`: 회원탈퇴 API 성공 후 + 로컬 세션 정리 직전
- 구현 지점:
  - `app/profile/menu/page.tsx`
    - 일반 provider(apple/google/unknown) 로그아웃
    - 회원탈퇴 성공 후
  - `app/auth/kakao/logout/callback/page.tsx`
    - 카카오 로그아웃은 콜백에서만 송신(중복 방지)

### 2.3 RN 수신 규칙(웹 계약)

- 위 타입 + 버전만 유효 처리
- 수신 시 `POST /api/profile/expo-push-token` with `{ "expo_push_token": "" }`
- 스펙 외 타입/버전은 무시 + 경고 로그

---

## 3. 웹 API 정합성 강화

### 3.1 엔드포인트

- `POST /api/profile/expo-push-token`

### 3.2 필수 보강 내용

- update 후 반영 row를 강제 확인:
  - `update(...).eq("id", auth.user.id).select("id").single()`
- `0-row` 업데이트를 성공으로 반환하지 않음
- 로그를 등록/갱신과 해제로 구분
  - `register_or_refresh`
  - `unregister`
- 토큰 형식 검증:
  - `ExponentPushToken[...]` 형식 불일치 시 `422` 반환

---

## 4. QA/운영 검증 기준 (웹 기준)

### 4.1 완료 판정

- 1단계: API 응답 성공
- 2단계: DB 실제 반영 확인 (필수)

### 4.2 운영 점검 SQL

- 토큰 보유 현황:
  - `select count(*) filter (where expo_push_token is not null and btrim(expo_push_token) <> '') from public.profiles;`
- orphan 점검:
  - `select count(*) from auth.users u left join public.profiles p on p.id=u.id where p.id is null;`

### 4.3 시나리오

- 로그인 후 `profiles.expo_push_token` 저장 확인
- 로그아웃/탈퇴 메시지 수신 후 `profiles.expo_push_token`이 `null`인지 확인
- API 200이어도 DB 미반영이면 실패로 판정
- 형식 오류 토큰 요청 시 `422` 확인
- RN 토큰 발급 시 `Notifications.getExpoPushTokenAsync({ projectId })` 사용 확인
- 사용 `projectId`와 RN `app.json > extra.eas.projectId` 일치 확인

---

## 5. 변경 파일

- `lib/reactNativeWebView.ts`
- `app/profile/menu/page.tsx`
- `app/auth/kakao/logout/callback/page.tsx`
- `app/api/profile/expo-push-token/route.ts`
- `docs/RN/rn_webview_integration.md`
- `docs/RN/rn_webview_integration_plan.md`
