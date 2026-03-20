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
  - `/calendar/settings/bar-orders`: 바 주문 목록 설정
  - `/calendar/settings/center-orders`: 센터 주문 목록 설정
  - `/calendar/settings/instructor-levels`: 강사 레벨 설정
  - `/calendar/settings/locations`: 장소 설정
  - `/performance`: 공연 목록
  - `/performance/search`: 공연 검색
  - `/performance/search-input`: 공연 검색 입력
  - `/performance/[id]`: 공연 상세
  - `/performance/[id]/reviews/new`: 공연 리뷰 작성
  - `/performance/[id]/reviews/[reviewId]`: 리뷰 상세
  - `/performance/[id]/reviews/[reviewId]/edit`: 리뷰 수정
- 네비게이션
  - 하단 탭: `캘린더` / `공연` / `프로필`
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
- 날짜 선택: 클릭 시 항상 `/day/[date]`로 이동
- 오늘 날짜: 자동 강조(브랜드 색상 사용)
- 기록 표시: 날짜 아래에 작은 칩/점 형태의 이미지로 건수 노출
  - 1개: 이미지 1개 표시
  - 2개 이상: 이미지 1개 + 배지로 개수 표시

### 기록 데이터 모델

#### 필수

- `date` (YYYY-MM-DD)
- `start_time`, `end_time`
- `mood` (5단계 이미지 기반 UI)

#### 선택

- `content` (한줄 기록, 최대 16자)
- `media` (사진 최대 3장)
- `location`, `level`, `instructor`
- `bar_order`, `center_order`
- `did_well`, `improve_next`

### 기록 CRUD 동작

- 생성 진입: 플로팅 버튼(`/record/new`) 또는 일별 타임라인 플로팅 버튼
- 저장 후 이동: `/calendar`로 이동
- 수정 진입: 상세 화면의 수정 아이콘 버튼 클릭
- 삭제: 확인 모달 표시 후 삭제, 삭제된 기록은 통계/기록 수에서 제외
- 유효성: `date`, `start_time`, `end_time`, `mood` 누락 시 저장 불가
- 시간 유효성: `end_time < start_time`인 경우 저장 불가 + 오류 메시지 표시

### 주소 검색(WebView 브릿지)

- 적용 화면: `/record/new`, `/record/[id]/edit`, `/calendar/settings/locations`
- 일반 브라우저: 기존 Kakao Postcode 팝업 흐름 사용
- React Native WebView:
  - 웹 -> RN: `open_address_search` 메시지 전송
  - RN -> 웹: `address_selected` 메시지 전송 (`address`, `roadAddress`, `jibunAddress`)
  - 웹 반영 우선순위: `address` -> `roadAddress` -> `jibunAddress`
  - 주소가 변경되면 상세 주소(`address_detail`)는 초기화

### 미디어 처리

- 저장 위치: Supabase Storage
- 용량 제한
  - 이미지: 20MB/장
- 업로드 방식: 업로드 완료 후 URL 저장
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

#### 공연 목록 섹션 구성 (아이디어)

- **인기 공연**: 리뷰 수/평균 별점 기준 (내부 데이터)
- **공개 예정작**: `prfpdfrom`이 오늘 이후인 공연
- **현재 공연**: `prfpdfrom` ≤ 오늘 ≤ `prfpdto`
- **곧 종료**: `prfpdto`가 30일 이내인 공연
- **오픈런**: `openrun = Y` 기준
- **지역/공연장 묶음**: `area`, `fcltynm` 기준 추천 섹션

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
  - `relates`: 예매처목록 (모든 예매처 정보)
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
- 공지사항: 더보기(`/profile/menu`)에서 공지사항(`/notice`)으로 진입
