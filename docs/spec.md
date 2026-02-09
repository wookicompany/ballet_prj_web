# 구현 스펙 (MVP + Phase 1)

이 문서는 PRD를 바탕으로 결정된 구현 사항을 기록한다.

## 1) 공통

### 화면/라우팅

- 기본 진입 경로: `/calendar`
- 라우트 네이밍 (현재 구현)
  - `/`: 루트 페이지
  - `/auth/callback`: 소셜 로그인 콜백 처리
  - `/calendar`: 월 캘린더 탭
  - `/day/[date]`: 일별 타임라인
  - `/record/new`: 기록 작성
  - `/record/[id]`: 기록 상세
  - `/record/[id]/edit`: 기록 수정
  - `/profile`: 프로필 탭
  - `/profile/edit`: 프로필 편집
  - `/profile/menu`: 프로필 설정 메뉴
  - `/support`: 고객지원
  - `/policy`: 정책 목록
  - `/policy/privacy`: 개인정보 처리방침
  - `/policy/terms`: 이용약관
  - `/performance`: 공연 목록
  - `/performance/[id]`: 공연 상세
  - `/performance/[id]/reviews`: 공연 리뷰 목록
  - `/performance/[id]/reviews/[reviewId]`: 공연 리뷰 상세
  - `/performance/[id]/reviews/new`: 공연 리뷰 작성
  - `/performance/[id]/reviews/[reviewId]/comments`: 리뷰 댓글 목록
  - `/performance/[id]/reviews/[reviewId]/comments/new`: 리뷰 댓글 작성
- 네비게이션
  - 하단 탭: `캘린더` / `공연` / `프로필`
  - 플로팅 버튼: 기록 생성(`/record/new`)
  - 상세 화면은 탭 없이 단일 페이지로 진입

### 모바일 퍼스트 UI

- 모바일 전용 화면으로 구현
- 웹/PC 접속 시에도 모바일 UI로 고정하고 중앙 정렬
- 기준 레이아웃 폭: `max-w-[430px]` + `mx-auto`
- 기본 터치 타깃: 최소 높이 44px
- 하단 탭 높이: 56px 기준
- 플로팅 버튼: 우측 하단 고정 (안전 여백 고려)

### 비기능/정책

- 오프라인: 읽기만 허용, 기록 생성/수정/삭제는 제한
- 비로그인: 리뷰/평점은 읽기만 가능, 작성/수정/삭제/좋아요/댓글은 제한

## 2) 로그인

### 인증/로그인

- 로그인 제공자: 카카오 + 구글
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

- 현재는 **수동 적재만 지원** (Vercel Cron은 이후 단계에서 적용)
- **BBBC 전체 공연**을 수동 호출 시점에 수집
- 공연목록/공연상세를 Supabase에 upsert 저장
- 서비스는 KOPIS 실시간 호출 없이 DB 데이터만 사용
- 수동 호출: `POST /api/cron/kopis-sync`
  - 쿼리: `stdate=YYYYMMDD`, `eddate=YYYYMMDD`, `afterdate=YYYYMMDD` (선택)
  - 헤더: `x-cron-secret`에 `CRON_SECRET` 값 전달 (설정된 경우)
  - 기본값: `stdate`는 30일 전, `eddate`는 365일 후, `afterdate`는 3일 전

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
- 리뷰 요약(평균 별점, 리뷰 수)
 
### 리뷰/평점

- 공연 단위로 별점(1~5)
- 텍스트 후기 작성
- 후기 이미지 첨부 가능
- 리뷰는 공연 상세에 노출
- 사용자 프로필에서 내가 작성한 리뷰 목록 제공
- 리뷰에 댓글 작성 가능 (공연 리뷰에 대한 댓글)
- 리뷰/댓글 좋아요 기능 제공
- 공연 좋아요 기능 제공

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
