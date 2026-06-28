# 구현 스펙 (MVP + Phase 1)

이 문서는 PRD를 바탕으로 결정된 구현 사항을 기록한다.

## 1) 공통

### 브랜딩

- 앱 이름: **마이발레**
- 부제: 마이발레는 나의 발레를 기록하는 서비스예요.
- 메타데이터: 루트 레이아웃 `title` / `description`에 위 내용 사용

### 화면/라우팅

- 기본 진입 경로: `/calendar`
- 라우트 네이밍 (현재 구현)
  - `/`: 루트 페이지
  - `/auth/callback`: 소셜 로그인 콜백 처리
  - `/auth/kakao/logout/callback`: 카카오 로그아웃 콜백 처리
  - `/calendar`: 월 캘린더 탭
  - `/day/[date]`: 일별 타임라인
  - `/record/new`: 기록 작성
  - `/record/[id]`: 기록 상세
  - `/record/[id]/edit`: 기록 수정
  - `/profile`: 프로필 탭
  - `/profile/records`: 발레 기록 전체 목록 (무한스크롤)
  - `/profile/reviews`: 공연 리뷰 전체 목록 (무한스크롤)
  - `/profile/brands`: 좋아요한 브랜드 전체 목록
  - `/profile/edit`: 프로필 편집
  - `/profile/menu`: 프로필 설정 메뉴
  - `/profile/account`: 로그아웃/회원탈퇴
  - `/profile/account/info`: 계정 정보
  - `/profile/data-management`: 데이터 관리
  - `/support`: 고객지원
  - `/notice`: 공지사항 목록
  - `/notice/[id]`: 공지사항 상세
  - `/policy`: 정책 목록
  - `/policy/community-rules`: 공연 커뮤니티 이용규칙
  - `/policy/privacy`: 개인정보 처리방침
  - `/policy/terms`: 이용약관
  - `/calendar/settings`: 캘린더 설정
  - `/calendar/settings/bar-orders`: 바 순서 목록
  - `/calendar/settings/bar-orders/new`: 바 순서 추가
  - `/calendar/settings/bar-orders/[id]/edit`: 바 순서 수정
  - `/calendar/settings/center-orders`: 센터 순서 목록
  - `/calendar/settings/center-orders/new`: 센터 순서 추가
  - `/calendar/settings/center-orders/[id]/edit`: 센터 순서 수정
  - `/calendar/settings/instructor-levels`: 강사님 & 레벨 목록
  - `/calendar/settings/instructor-levels/new`: 강사님 & 레벨 추가
  - `/calendar/settings/instructor-levels/[id]/edit`: 강사님 & 레벨 수정
  - `/calendar/settings/locations`: 장소 목록
  - `/calendar/settings/locations/new`: 장소 추가
  - `/calendar/settings/locations/[id]/edit`: 장소 수정
  - `/performance`: 공연 목록
  - `/performance/search`: 공연 검색
  - `/performance/search-input`: 공연 검색 입력
  - `/performance/[id]`: 공연 상세
  - `/performance/[id]/reviews/new`: 공연 리뷰 작성
  - `/performance/[id]/reviews/[reviewId]`: 리뷰 상세
  - `/performance/[id]/reviews/[reviewId]/edit`: 리뷰 수정
  - `/brand`: 브랜드 탐색 탭
  - `/brand/search-input`: 브랜드 검색 입력
  - `/notifications`: 알림 목록
  - `/u/[id]`: 공개 유저 프로필 (SNS 공유용, OG 태그 포함)
- 네비게이션
  - 하단 탭: `캘린더` / `공연` / `브랜드` / `프로필`
  - 플로팅 버튼: 기록 생성(`/record/new`)
  - 상세 화면은 탭 없이 단일 페이지로 진입

### 모바일 퍼스트 UI

- 모바일 전용 화면으로 구현
- **모바일 전용 패턴**: 레이아웃 래퍼로 `MobileContainer` 등 모바일 전용 컴포넌트를 사용한다. (어드민 등 웹 전용 영역은 예외.)
- 웹/PC 접속 시에도 모바일 UI로 고정하고 중앙 정렬
- 기준 레이아웃 폭: `max-w-[430px]` + `mx-auto`
- 기본 터치 타깃: 최소 높이 44px
- 하단 탭 높이: 56px 기준
- 플로팅 버튼: 우측 하단 고정 (안전 여백 고려)
- 터치 피드백: 클릭 시 배경이 바뀌는 `hover:bg-*` 대신 **`active:opacity-*`** 위주로 눌림을 표현한다. 공통 버튼은 `components/ui/button.tsx`를 기준으로 한다.
- 촉각 피드백: React Native WebView에서는 `lib/reactNativeWebView`의 `sendHapticToApp()`으로 탭 피드백을 준다. 적용 범위·예외는 `docs/APP_AGENTS.md`의 UI/디자인 절을 따른다.

### 비기능/정책

- 오프라인: 읽기만 허용, 기록 생성/수정/삭제는 제한
- 비로그인: 리뷰/평점은 읽기만 가능, 작성/수정/삭제/좋아요/댓글은 제한
- RN 푸시 알림: Expo Push 단일 경로 사용 (`profiles.expo_push_token`, `POST /api/profile/expo-push-token`)
  - 토큰 형식: `ExponentPushToken[...]`
  - 로그아웃/회원탈퇴 시 RN은 `{ "expo_push_token": "" }`로 해제 호출
  - 서버 발송 경로는 Expo Push API + `EXPO_ACCESS_TOKEN`을 기본 정책으로 사용
- 에러 모니터링: 웹은 Sentry(`@sentry/nextjs`)로 수집한다.
  - DSN 키: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`
  - 릴리스/소스맵 업로드 키: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
  - 환경 키: `SENTRY_ENVIRONMENT` (`development`/`preview`/`production`)
  - 운영 기본값(무료 플랜): `tracesSampleRate=0.05`, `sendDefaultPii=false`

### 공지사항

- 공지사항은 DB(`notices`) 기반으로 운영한다.
- 목록/상세 라우트:
  - `/notice`: 게시된 공지 목록
  - `/notice/[id]`: 공지 상세
- 조회 API:
  - `GET /api/notices`: 게시된 공지 목록 조회
  - `GET /api/notices/[id]`: 게시된 공지 상세 조회(미게시/미존재는 404)

## 2) 로그인

### 인증/로그인

- 로그인 제공자: 카카오 + 애플
- 세션 유지: Supabase Auth 기본 세션 사용
- 로그인 성공 후 이동: `/calendar`

### 로그인 유도

- 캘린더에서 기록 생성 시 로그인 요청
- 하단 탭바에서 프로필 선택 시 로그인 요청

## 3) 캘린더

### 캘린더 화면

- 배경 색상: `#FFFFFF`
- 텍스트 기본 색상: `#17171c`
- 상단 헤더: “YYYY년 M월” 텍스트 + 연월 선택 버튼(바텀시트)
- 설정: 우측 상단 설정 버튼
- 날짜 선택: 클릭 시 하단에 해당 날짜의 기록 목록 인라인 토글 표시. 기록 클릭 시 `/record/[id]`로 이동. 각 기록 카드에 무드 이미지·시작~종료 시간·한 줄 기록(content)·장소 | 강사·레벨 표시 (있는 항목만)
- 오늘 날짜: 자동 강조(브랜드 색상 사용)
- 기록 표시: 날짜 아래에 작은 칩/점 형태의 이미지로 건수 노출
  - 1개: 이미지 1개 표시
  - 2개 이상: 이미지 1개 + 배지로 개수 표시

### 기록 데이터 모델

#### 필수

- `date` (YYYY-MM-DD)
- `start_time`, `end_time`
- `mood` (8단계 이미지 기반 UI)

#### 선택

- `content` (한줄 기록, 최대 24자)
- `media` (사진 최대 3장)
- `location`, `level`, `instructor`
- `bar_order`, `center_order`
- `did_well`, `improve_next`, `outfit` (발레복 코디)

### 기록 CRUD 동작

- 생성 진입: 플로팅 버튼(`/record/new`) 또는 일별 타임라인 플로팅 버튼
- 저장 후 이동: `/calendar`로 이동
- 수정 진입: 상세 화면의 수정 아이콘 버튼 클릭
- 삭제: 확인 모달 표시 후 삭제, 삭제된 기록은 통계/기록 수에서 제외
- 유효성: `date`, `start_time`, `end_time`, `mood` 누락 시 저장 불가
- 시간 유효성: `end_time < start_time`인 경우 저장 불가 + 오류 메시지 표시

### WebView 브릿지

#### 주소 검색

- 적용 화면: `/record/new`, `/record/[id]/edit`, `/calendar/settings/locations`
- 일반 브라우저: 기존 Kakao Postcode 팝업 흐름 사용
- React Native WebView:
  - 웹 -> RN: `open_address_search` 메시지 전송
  - RN -> 웹: `address_selected` 메시지 전송 (`address`, `roadAddress`, `jibunAddress`)
  - 웹 반영 우선순위: `address` -> `roadAddress` -> `jibunAddress`
  - 주소가 변경되면 상세 주소(`address_detail`)는 초기화

#### 인앱 URL 열기

- 적용 화면: `/performance/[id]` 예매처 링크 클릭
- 구현: `lib/reactNativeWebView.ts`의 `openUrlInApp(url, title?)` 함수
- React Native WebView:
  - 웹 -> RN: `{ type: "open_url", url, title }` postMessage 전송
  - RN: `expo-web-browser`의 `openBrowserAsync`로 인앱 브라우저 실행
- 일반 브라우저 폴백: `window.open(url, '_blank')`
- RN 환경 감지: `window.ReactNativeWebView` 존재 여부 확인 (`lib/reactNativeWebView.ts`의 `isInReactNativeWebView()`)

### 미디어 처리

- 저장 위치: Supabase Storage (`record-media` 버킷)
- 지원 기능: 캘린더 기록, 공연 리뷰 모두 이미지 첨부 지원 (동일 버킷 사용)
- 용량 제한
  - 원본 파일 선택 허용: 최대 20MB/장
  - 업로드 전 클라이언트 압축 적용: 최대 1MB/장, 1280px 이하 (`lib/compressImage.ts`)
- 업로드 방식: 업로드 완료 후 URL 저장 (배치 처리)
- 영상 업로드는 사용하지 않음 (이미지만 지원)

### 일별 타임라인 UI

- 기본 단위: 1시간 단위 구획
- 시간 범위: 06:00 ~ 23:00 (18칸)
- 진입/동작
  - 일별 상세 화면 우측 하단에 `+` 플로팅 버튼 배치
  - 플로팅 버튼 클릭 시 기록 생성(`/record/new`)으로 이동
  - 기록이 있는 시간 블록 클릭 시 해당 기록 상세(`/record/[id]`)로 이동
  - 기록이 없는 영역 클릭은 동작하지 않음(확정)

## 4) 공연

### 데이터 소스/범위

- KOPIS OpenAPI 기반 공연 데이터 사용
- 장르 필터: `BBBC (무용: 서양/한국무용)`만 대상
- 공연은 KOPIS에 존재하는 항목만 대상

### 데이터 적재/배치 및 CRUD 기준

- Vercel Cron으로 **3일 주기 배치** 실행 (PRD Phase 1 기준)
- **BBBC(무용: 서양/한국무용) 전체 공연**을 매 배치마다 수집
- 배치 작업은 KOPIS 공연목록/공연상세를 수집해 Supabase에 upsert 저장
- 서비스는 KOPIS 실시간 호출 없이 DB 데이터만 사용
- 공연 동기화: `POST /api/cron/kopis-sync`
  - 쿼리: `stdate=YYYYMMDD`, `eddate=YYYYMMDD`, `afterdate=YYYYMMDD` (선택)
  - 헤더: `x-cron-secret`에 `CRON_SECRET` 값 전달 (설정된 경우)
  - 기본값: `stdate`는 30일 전, `eddate`는 365일 후, `afterdate`는 3일 전
- 공연 시설 동기화: `POST /api/cron/kopis-sync-facilities` (공연 목록/상세와 분리된 크론 라우트)
  - 저장 테이블: `kopis_facilities`(목록), `kopis_facility_details`(상세)
  - 쿼리 `afterdate`로 증분 동기화 가능
- 공연 수상작 동기화: `POST /api/cron/kopis-sync-awards` (독립 수동 실행 가능)
  - 저장 테이블: `kopis_performance_awards`
  - KOPIS `prfawad` 수집 결과를 `mt20id` 기준 upsert
  - `awards`는 `<br>`/`&lt;br&gt;` 줄바꿈 문자열을 정규화해 저장
  - 권장 수동 실행 순서: `kopis-sync` -> `kopis-sync-awards` -> `kopis-sync-facilities`

#### 공연 목록 (KOPIS `pblprfr`)
- **C**: `mt20id`가 DB에 없으면 생성
- **R**: DB에 적재된 목록만 조회
- **U**: 동일 `mt20id` 재수집 시 upsert 덮어쓰기
- **D**: 실 삭제하지 않고 비활성 처리(소프트 삭제)

#### 공연 상세 (KOPIS `pblprfr/{mt20id}`)
- **C**: 목록에 존재하는 `mt20id` 중 상세가 없으면 생성
- **R**: DB에 적재된 상세만 조회
- **U**: `updatedate` 최신이거나 재수집 시 upsert 덮어쓰기
- **D**: 실 삭제하지 않고 비활성 처리(소프트 삭제)

### 공연 목록

- 날짜 범위 기반 목록 조회
- 검색 범위: 공연명/공연출연진 (`prfnm`, `prfcast`)
- 사용자 노출 필드 (KOPIS 공연목록 기준)
  - `prfnm`: 공연명
  - `prfpdfrom`: 공연시작일
  - `prfpdto`: 공연종료일
  - `fcltynm`: 공연시설명(공연장명)
  - `poster`: 포스터이미지
  - `genrenm`: 공연 장르명
  - `prfstate`: 공연상태
  - `area`: 지역
- 수상작 배지
  - 카드 우상단 트로피 아이콘 배지 노출
  - `kopis_performance_awards`에 매칭되는 공연만 표시

#### 공연 목록 섹션 구성 (구현)

| 섹션 키 | 제목 | 필터 조건 | 정렬 |
|---------|------|----------|------|
| `popular` | 가장 반응이 많은 공연을 모아봤어요 | 리뷰/평점 수 기반 | 평균 별점 × 가중치 내림차순 |
| `scheduled` | 곧 만날 수 있는 공연을 모아봤어요 | `prfstate = '공연예정'` | `prfpdfrom` 오름차순 |
| `ongoing` | 지금 바로 관람할 수 있는 공연을 모아봤어요 | `prfstate = '공연중'` | `prfpdto` 오름차순 (마감 임박 우선) |
| `visit` | 해외 팀이 참여한 공연을 모아봤어요 | `visit = 'Y'` | 상태 우선순위(공연중 > 공연예정 > 공연완료) + `prfpdfrom` 오름차순 |
| `completed` | 막을 내린 공연을 모아봤어요 | `prfstate = '공연완료'` | `updatedate` 내림차순 |
| `awards` | 수상작 공연을 모아봤어요 | `kopis_performance_awards` 매칭 | `prfpdfrom` 내림차순 |

- 각 섹션은 홈에서 최대 6개 카드 노출 후 "더보기" → `/performance/search?section={key}` 이동
- 섹션 순서: `popular` → `scheduled` → `ongoing` → `visit` → `completed` → `awards`

### 공연 상세

- 사용자 노출 필드 (KOPIS 공연상세 기준)
  - `prfcast`: 공연출연진
  - `prfcrew`: 공연제작진
  - `prfruntime`: 공연 런타임
  - `prfage`: 공연 관람 연령
  - `entrpsnm`: 기획제작사
  - `entrpsnmP`: 제작사
  - `entrpsnmA`: 기획사
  - `entrpsnmH`: 주최
  - `entrpsnmS`: 주관
  - `pcseguidance`: 티켓가격
  - `sty`: 줄거리
  - `child`: 아동
  - `prfstate`: 공연상태
  - `styurls`: 소개이미지목록 (모든 소개이미지)
  - `dtguidance`: 공연시간
  - `relates`: 예매처목록 (`relatenm`: 예매처명, `relateurl`: 예매처 URL)
- 예매처 UI
  - 예매처 링크가 있는 항목은 칩(chip) 버튼 형태로 렌더링 (`rounded-full border`)
  - 칩 우측에 `ExternalLink` 아이콘 표시
  - 클릭 시 클릭 이벤트 추적(`POST /api/performances/[id]/booking-click`) 후 인앱 브라우저로 URL 오픈
- 수상 정보
  - 공연 제목 위에 트로피 아이콘 + 수상 목록 노출
  - 수상 목록은 줄바꿈 문자열(`<br>`, `&lt;br&gt;`) 파싱 후 라인 단위로 렌더링
- 리뷰 요약(평균 별점, 리뷰 수)
 
### 리뷰/평점

- 공연 단위로 별점(0~10)
- 텍스트 후기 작성
- 후기 이미지 첨부 가능
- 리뷰는 공연 상세에 노출
- 사용자 프로필에서 내가 작성한 리뷰 목록 제공
- 리뷰에 댓글 작성 가능 (공연 리뷰에 대한 댓글)
- 리뷰/댓글 좋아요 기능 제공
- 공연 좋아요 기능은 제공하지 않음

#### 공개 프로필 노출(리뷰/댓글 작성자)

- 타 사용자 리뷰/댓글 작성자 표시는 공개 프로필 API로 조회
- API: `POST /api/public-profiles` (body: `user_ids`)
- 응답 필드: `id`, `nickname`, `avatar_url`

#### 리뷰/댓글 신고 및 숨김 처리

- 대상: 본인 작성물이 아닌 리뷰/댓글
- 진입: 더보기(점 3개) 액션에서 `신고하기` 노출
- 신고 사유 코드:
  - `SPAM` (광고/도배성 콘텐츠예요.)
  - `ABUSE` (욕설/혐오/괴롭힘이 포함된 내용이에요.)
  - `SEXUAL` (음란하거나 성적으로 불쾌감을 주는 내용이에요.)
  - `FALSE_INFO` (사실과 다른 허위 정보예요.)
  - `OTHER` (기타 사유예요.)
- 추가 입력(`detail`)은 선택사항
- 본인 콘텐츠 신고 불가
- 동일 사용자의 중복 신고는 1건으로 처리(업서트)
- 숨김 기준: 아이템(리뷰/댓글)별 `고유 신고자 수 >= 3`
  - 공연 단위 합산이 아닌, 각 리뷰/댓글 ID별로 독립 판정
- 숨김 시 노출:
  - 본문 텍스트 대신 `신고로 인해 숨김 처리되었어요.` 문구 노출
  - 리뷰는 본문뿐 아니라 첨부 이미지도 함께 숨김
- 숨김 적용 화면: 공연 상세(`/performance/[id]`), 리뷰 상세(`/performance/[id]/reviews/[reviewId]`)
- `deleted_at`은 삭제(소프트 삭제) 여부이며, 신고 숨김 여부와 별개
- API:
  - `POST /api/reviews/[id]/report`: 리뷰 신고
  - `POST /api/review-comments/[id]/report`: 댓글 신고
  - 요청 body: `reason_code`, `detail?`
  - 응답: `report_count`, `is_hidden`

#### 예매처 클릭 추적

- 사용자가 공연 상세에서 예매처 칩을 클릭하면 클릭 이벤트를 기록
- 인증 불필요 (익명 추적)
- DB 테이블: `performance_booking_clicks` (`id`, `performance_id`, `relatenm`, `relateurl`, `created_at`)
- API: `POST /api/performances/[id]/booking-click`
  - 요청 body: `relatenm`, `relateurl`
  - 응답: `{ ok: true }`
- 클릭 후 `openUrlInApp`으로 인앱 브라우저 실행 (폴백: `window.open`)

#### 공연 리뷰 댓글

- 리뷰 단위로 댓글 작성·수정·삭제 (작성자 본인만 수정/삭제 가능)
- 로그인 사용자만 댓글 작성/수정/삭제 가능 (비로그인은 읽기만 가능, spec 공통 비기능과 동일)
- 노출: 공연 리뷰 상세 화면(`/performance/[id]/reviews/[reviewId]`)에서 해당 리뷰의 댓글 목록 노출
- API
  - `POST /api/review-comments`: 댓글 생성 (body: `review_id`, `content`)
  - `PATCH /api/review-comments/[id]`: 본인 댓글 수정
  - `DELETE /api/review-comments/[id]/delete`: 본인 댓글 삭제
- 댓글 좋아요: 리뷰/평점 섹션의 “리뷰/댓글 좋아요”에 포함

## 5) 프로필

### 프로필/통계

- 기록 개수: 삭제된 기록 제외
- 누적 발레 시간: 삭제된 기록 제외, `(end_time - start_time)` 합산
- 계산 방식: 실시간 계산

### 프로필/설정

- 프로필 이미지: 기본 이미지 제공
- 닉네임: 최대 12자
- 로그아웃: 확인 모달 표시
- 가입일: 표시하지 않음
- 통계: 총 기록 개수, 누적 발레 시간(시간/분)
- 회원탈퇴: 설정 화면에 포함
- 데이터 관리: `/profile/data-management`에서 안내
- 캘린더 설정: 캘린더 설정 진입 후 바 주문/센터 주문/강사 레벨/장소 목록 관리 (각각 CRUD API: `saved-bar-orders`, `saved-center-orders`, `saved-instructor-levels`, `saved-locations`)
- 캘린더 표시 설정(주 시작 요일, 주말 강조): `PATCH /api/profile/calendar-settings` API로 저장 (`calendar_week_start_monday`, `calendar_highlight_weekend` 필드, `Authorization: Bearer <token>` 인증 필수)
- 공지사항: 더보기(`/profile/menu`)에서 공지사항(`/notice`)으로 진입

## 브랜드 탭

- 탭바: 캘린더 / 공연 / **브랜드** / 프로필 (4개, `grid-cols-4`, Tag 아이콘)
- 로그인 불필요 (공연 탭과 동일)
- DB 테이블:
  - `ballet_brands` (id, name_ko, name_en, logo_url, SNS URL 8개, is_active, sort_order, created_at, updated_at)
  - `brand_link_clicks` (id, brand_id, link_type, created_at)
  - `brand_views` (id, brand_id, created_at) — 브랜드 상세 페이지 방문 시 INSERT
  - `brand_likes` (id, user_id, brand_id, created_at, deleted_at) — 브랜드 좋아요. UNIQUE(user_id, brand_id), soft delete. RLS: SELECT USING(user_id = auth.uid())
- DB VIEW: `brand_engagement_summaries` (brand_id, view_count, click_count) — `brand_views` + `brand_link_clicks` 집계

### 브랜드 홈 (`/brand`)
- 헤더: "브랜드" 타이틀 + 검색 아이콘 → `/brand/search-input`
- `lib/brandHomeCache.ts`로 캐시 (뒤로가기 시 즉시 렌더)
- 빈 상태: "아직 등록된 브랜드가 없어요."
- 섹션 구성:
  - **지금 주목받는 브랜드**: `brand_engagement_summaries`에서 `view_count > 0` 기준 내림차순 상위 10개, 가로 스크롤 카드 (64×64 로고 + name_ko). view_count 데이터 없으면 섹션 미노출
  - **전체 브랜드**: `ballet_brands` `is_active=true` 전체, `sort_order ASC` 2열 그리드
- supabase 클라이언트 직접 사용 (`Promise.all` 병렬 조회), in-flight 중복 방지 패턴 적용

### 브랜드 검색 (`/brand/search-input`)
- 검색어 없음 → 전체 목록, 검색어 있음 → name_ko / name_en ilike 필터링
- 결과는 홈과 동일한 리스트 패턴

### 브랜드 상세 (`/brand/[id]`) — `(tabs)` 외부
- 카드 ①: 로고(96×96 rounded-2xl) + name_ko + name_en
- 카드 ②: 있는 SNS 링크만 노출, lucide 아이콘(Globe/Instagram/Facebook/Youtube/Twitter/Link)
- 링크 클릭 시: `openUrlInApp` 내부 웹뷰 + `POST /api/brands/[id]/link-click` 추적
- 헤더 우측: 하트 버튼(Heart icon, #FF154A). 비활성 = 아웃라인, 활성 = fill. 클릭 시 `POST /api/brands/[id]/like` (토글). 로그인 미인증 시 로그인시트 오픈. 마운트 시 `brand_likes` 직접 조회로 초기 상태 세팅. 낙관적 업데이트 + 실패 시 롤백

### 브랜드 좋아요 (`brand_likes`)
- 토글 방식: 없으면 INSERT → liked:true, deleted_at IS NULL이면 soft delete → liked:false, deleted_at IS NOT NULL이면 restore → liked:true
- 프로필 탭 "브랜드" 탭에서 좋아요 목록 조회 (created_at DESC, 브랜드 삭제된 경우 제외)

### API
- `GET /api/brands` — is_active=true 목록, sort_order ASC
- `GET /api/brands/[id]` — 단건 상세
- `POST /api/brands/[id]/view` — 브랜드 조회수 기록 (인증 불필요)
- `POST /api/brands/[id]/link-click` — 링크 클릭 추적 (인증 불필요)
- `POST /api/brands/[id]/like` — 브랜드 좋아요 토글 (인증 필요, service role). 응답: `{ liked: boolean }`
- `GET+POST /api/admin/brands` — 어드민 목록/생성
- `GET+PATCH+DELETE /api/admin/brands/[id]` — 어드민 상세/수정/삭제

## 광고 (B2B 배너)

### 노출 위치
- **공연 탭 홈** (`performance_home`): 헤더와 첫 번째 섹션 사이
- **브랜드 탭 홈** (`brand_home`): 헤더와 첫 번째 섹션 사이
- 캘린더 탭 홈, 프로필 탭 홈에는 광고 없음

### 광고 형식
- 이미지 배너 (클릭 시 `openUrlInApp`으로 인앱 브라우저 실행)
- 높이: 50px 또는 100px (어드민에서 광고별로 설정)
- 광고 없음 또는 이미지 없음 시 영역 완전 숨김 (`null` 렌더)

### DB 테이블 (`ads`)
- `placement` (text): `performance_home` | `brand_home`
- `title` (text): 광고명
- `image_url` (text, nullable): 광고 이미지 URL (Supabase Storage `brands` 버킷 또는 외부 URL)
- `link_url` (text, nullable): 클릭 시 이동할 랜딩 URL
- `height` (integer, default 50): 50 또는 100
- `is_active` (boolean): 활성화 여부
- `start_at` / `end_at` (timestamptz): 노출 기간 (KST 입력 → UTC 저장)
- `click_count` (integer): 클릭수 집계
- 동일 placement에 기간이 겹치지 않는 여러 광고 예약 등록 가능

### API
- `GET /api/ads?placement=xxx` — 현재 활성화된 광고 1개 조회 (is_active + 기간 체크). 응답: `{ ad: { id, image_url, link_url, height } | null }`
- `POST /api/ads/[id]/click` — 광고 클릭수 집계 (인증 불필요)
- `GET /api/admin/ads` — 어드민 광고 목록 (`?placement=` 필터 지원)
- `POST /api/admin/ads` — 광고 생성
- `GET+PATCH+DELETE /api/admin/ads/[id]` — 광고 상세/수정/삭제

### 어드민 UI (`/wookicompany/admin/ads`)
- 목록 페이지: "공연 홈 / 브랜드 홈" 탭으로 placement별 필터링. 이미지 썸네일, 광고명, 상태, 노출 기간, 토글+상세 링크 표시
- 새 광고 등록: 목록 탭의 placement가 쿼리 파라미터로 자동 설정. 광고명, 노출 위치, 시작/종료일시(KST), 이미지(파일 업로드 또는 URL), 랜딩 URL, 높이(50px/100px), 즉시 활성화 입력
- 상세/수정: 이미지 미리보기, 수정 폼에 동일 필드 포함
