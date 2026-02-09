# KOPIS OpenAPI 정리

## 공연목록 (검색)
- **요청 URL**: `http://kopis.or.kr/openApi/restful/pblprfr`
- **요청 서비스**: 검색을 통한 공연 목록 서비스
- **제약**: 최대 100건 조회

### 요청 변수
| 변수명 | 필수 | 크기 | 설명 | 샘플 |
| --- | --- | --- | --- | --- |
| service | O | 60 | 발급받은 인증키 |  |
| stdate | O | 8 | 공연시작일자 | 20230101 |
| eddate | O | 8 | 공연종료일자 | 20230630 |
| cpage | O | 3 | 현재페이지 | 1 |
| rows | O | 3 | 페이지당 목록 수(최대 100) | 10 |
| shprfnm | X | 100 | 공연명(URLEncoding) | 사랑 |
| shprfnmfct | X | 100 | 공연시설명(URLEncoding) | 예술의전당 |
| shcate | X | 4 | 장르코드 | **BBBC** |
| prfplccd | X | 4 | 공연장코드 | FC000001-01 |
| signgucode | X | 2 | 지역(시도)코드 | 11 |
| signgucodesub | X | 4 | 지역(구군)코드 | 1111 |
| kidstate | X | 1 | 아동공연여부 | Y |
| prfstate | X | 2 | 공연상태코드 | 01 |
| openrun | X | 2 | 오픈런 | Y |
| afterdate | X | 8 | 해당일자 이후 등록/수정만 출력 | 20230101 |

### 요청 예시
```
http://www.kopis.or.kr/openApi/restful/pblprfr?service={ServiceKey}&stdate=20230601&eddate=20230630&cpage=1&rows=10&prfstate=02&signgucode=11&signgucodesub=1111&kidstate=Y
```

### 응답 예시
```
<?xml version="1.0" encoding="UTF-8"?>
<dbs>
  <db>
    <mt20id>PF178134</mt20id>
    <prfnm>반짝반짝 인어공주</prfnm>
    <prfpdfrom>2021.08.21</prfpdfrom>
    <prfpdto>2024.09.29</prfpdto>
    <fcltynm>달밤엔씨어터</fcltynm>
    <poster>http://www.kopis.or.kr/upload/pfmPoster/PF_PF178134_210809_125033.PNG</poster>
    <area>서울특별시</area>
    <genrenm>뮤지컬</genrenm>
    <openrun>Y</openrun>
    <prfstate>공연중</prfstate>
  </db>
</dbs>
```

### 출력 필드
| 필드명 | 설명 | 샘플 |
| --- | --- | --- |
| mt20id | 공연ID | PF178134 |
| prfnm | 공연명 | 반짝반짝 인어공주 |
| prfpdfrom | 공연시작일 | 2021.08.21 |
| prfpdto | 공연종료일 | 2024.09.29 |
| fcltynm | 공연시설명(공연장명) | 달밤엔씨어터 |
| poster | 포스터이미지경로 | http://www.kopis.or.kr/upload/pfmPoster/PF_PF178134_210809_125033.PNG |
| area | 공연지역 | 서울특별시 |
| genrenm | 공연 장르명 | 뮤지컬 |
| openrun | 오픈런 | Y |
| prfstate | 공연상태 | 공연중 |

### 결과코드
| 코드 | 설명 |
| --- | --- |
| 00 | NORMAL SERVICE |
| 01 | INVALID REQUEST PARAMETER ERROR |
| 02 | SERVICE KEY IS NOT REGISTERED ERROR |
| 03 | DB_ERROR |
| 04 | NODATA ERROR |
| 05 | 최대 31일까지 조회가능합니다. |
| 06 | 최대 조회수는 100건까지 가능합니다. |

### 공연상태 코드 (prfstate)
| 코드 | 설명 |
| --- | --- |
| 01 | 공연예정 |
| 02 | 공연중 |
| 03 | 공연완료 |

### 장르 코드 (shcate)
| 코드 | 설명 |
| --- | --- |
| AAAA | 연극 |
| BBBC | 무용(서양/한국무용) |
| BBBE | 대중무용 |
| CCCA | 서양음악(클래식) |
| CCCC | 한국음악(국악) |
| CCCD | 대중음악 |
| EEEA | 복합 |
| EEEB | 서커스/마술 |
| GGGA | 뮤지컬 |

---

## 공연상세
- **요청 URL**: `http://kopis.or.kr/openApi/restful/pblprfr/{공연아이디}`
- **요청 서비스**: 검색을 통한 공연상세 목록 서비스

### 요청 변수
| 변수명 | 필수 | 크기 | 설명 | 샘플 |
| --- | --- | --- | --- | --- |
| service | O | 60 | 발급받은 인증키 |  |
| mt20id | O | 8 | 공연목록 조회 후 나오는 공연ID 참조 | PF132236 |

### 요청 예시
```
http://www.kopis.or.kr/openApi/restful/pblprfr/PF132236?service={SeriveKey}
```

### 응답 예시 (요약)
```
<dbs>
  <db>
    <mt20id>PF132236</mt20id>
    <prfnm>우리 연애할까?</prfnm>
    <prfpdfrom>2016.05.12</prfpdfrom>
    <prfpdto>2016.12.31</prfpdto>
    <fcltynm>해바라기소극장(구. 훈아트홀)</fcltynm>
    <prfcast>김세연, 신성진, 정재연...</prfcast>
    <prfruntime>1시간 30분</prfruntime>
    <prfage>만 12세 이상</prfage>
    <pcseguidance>전석 30,000원</pcseguidance>
    <poster>http://www.kopis.or.kr/upload/pfmPoster/PF_PF132236_161107_144405.gif</poster>
    <area>서울특별시</area>
    <genrenm>연극</genrenm>
    <openrun>N</openrun>
    <prfstate>공연완료</prfstate>
    <styurls>
      <styurl>http://www.kopis.or.kr/upload/pfmIntroImage/PF_PF132236_161107_0245254.jpg</styurl>
    </styurls>
    <mt10id>FC001431</mt10id>
    <dtguidance>화요일 ~ 금요일(20:00)...</dtguidance>
  </db>
</dbs>
```

### 출력 필드 (주요)
| 필드명 | 설명 | 샘플 |
| --- | --- | --- |
| mt20id | 공연ID | PF132236 |
| prfnm | 공연명 | 우리 연애할까? |
| prfpdfrom | 공연시작일 | 2016.05.12 |
| prfpdto | 공연종료일 | 2016.12.31 |
| fcltynm | 공연시설명(공연장명) | 피가로아트홀(구 훈아트홀) |
| prfcast | 공연출연진 | 김부연, 임정균, 최수영 |
| prfcrew | 공연제작진 | 천정민 |
| prfruntime | 공연 런타임 | 1시간 30분 |
| prfage | 공연 관람 연령 | 만 12세 이상 |
| entrpsnm | 기획제작사 | 극단 피에로(문화제작소) |
| pcseguidance | 티켓가격 | 전석 30,000원 |
| poster | 포스터이미지경로 | http://www.kopis.or.kr/upload/pfmPoster/PF_PF132236_160704_142630.gif |
| area | 지역 | 서울특별시 |
| genrenm | 장르 | 연극 |
| openrun | 오픈런 | Y |
| visit | 내한 | N |
| child | 아동 | N |
| daehakro | 대학로 | Y |
| festival | 축제 | N |
| musicallicense | 뮤지컬 라이센스 | N |
| musicalcreate | 뮤지컬 창작 | N |
| updatedate | 최종수정일 | 2019-07-25 10:03:14 |
| prfstate | 공연상태 | 공연중 |
| styurls | 소개이미지목록 |  |
| mt10id | 공연시설ID | FC001431 |
| dtguidance | 공연시간 | 화요일 ~ 금요일(20:00) |
| relates | 예매처목록 |  |

### 결과코드
| 코드 | 설명 |
| --- | --- |
| 00 | NORMAL SERVICE |
| 01 | INVALID REQUEST PARAMETER ERROR |
| 02 | SERVICE KEY IS NOT REGISTERED ERROR |
| 03 | DB_ERROR |
| 04 | NODATA ERROR |

---

## 공연시설 목록
- **요청 URL**: `http://kopis.or.kr/openApi/restful/prfplc`
- **요청 서비스**: 검색을 통한 공연시설 목록 서비스
- **제약**: 최대 100건 조회

### 요청 변수
| 변수명 | 필수 | 크기 | 설명 | 샘플 |
| --- | --- | --- | --- | --- |
| service | O | 60 | 발급받은 인증키 | 서비스키 |
| cpage | O | 3 | 현재페이지 | 1 |
| rows | O | 3 | 페이지당 목록 수(최대 100) | 5 |
| shprfnmfct | X | 100 | 공연시설명(URLEncoding) | 예술의전당 |
| fcltychartr | X | 4 | 공연시설특성코드 | 1 |
| signgucode | X | 4 | 지역(시도)코드 | 11 |
| signgucodesub | X | 4 | 지역(구군)코드 | 1111 |
| afterdate | X | 8 | 해당일자 이후 등록/수정만 출력 | 20230101 |

### 요청 예시
```
http://www.kopis.or.kr/openApi/restful/prfplc?service={ServiceKey}&cpage=1&rows=10&shprfnmfct=예술의전당
```

### 출력 필드
| 필드명 | 설명 | 샘플 |
| --- | --- | --- |
| fcltynm | 공연시설명 | 경주예술의전당 |
| mt10id | 공연시설ID | FC000517 |
| mt13cnt | 공연장 수 | 2 |
| fcltychartr | 시설특성 | 문예회관 |
| sidonm | 지역(시도) | 경북 |
| gugunnm | 지역(구군) | 경주시 |
| opende | 개관연도 | 2010 |

### 결과코드
| 코드 | 설명 |
| --- | --- |
| 00 | NORMAL SERVICE |
| 01 | INVALID REQUEST PARAMETER ERROR |
| 02 | SERVICE KEY IS NOT REGISTERED ERROR |
| 03 | DB_ERROR |
| 04 | NODATA ERROR |
| 05 | 최대 31일까지 조회가능합니다. |
| 06 | 최대 조회수는 100건까지 가능합니다. |

---

## 공연시설 상세
- **요청 URL**: `http://kopis.or.kr/openApi/restful/prfplc/{공연시설아이디}`
- **요청 서비스**: 검색을 통한 공연시설 상세 목록 서비스

### 요청 변수
| 변수명 | 필수 | 크기 | 설명 | 샘플 |
| --- | --- | --- | --- | --- |
| service | O | 60 | 발급받은 인증키 |  |
| mt10id | O | 8 | 공연시설목록 조회 후 나오는 공연시설ID 참조 | FC001247 |

### 출력 필드 (주요)
| 필드명 | 설명 | 샘플 |
| --- | --- | --- |
| fcltynm | 공연시설명 | 올림픽공원 |
| mt10id | 공연시설ID | FC001247 |
| mt13cnt | 공연장 수 | 9 |
| fcltychartr | 시설특성 | 기타(공공) |
| opende | 개관연도 | 1986 |
| seatscale | 객석 수 | 32349 |
| telno | 전화번호 | 02-410-1114 |
| relateurl | 홈페이지 | http://www.olympicpark.co.kr/ |
| adres | 주소 | 서울특별시 송파구 올림픽로 424 |
| la | 위도 | 37.52112 |
| lo | 경도 | 127.12836360000005 |
| restaurant | 레스토랑 | Y |
| cafe | 카페 | Y |
| store | 편의점 | Y |
| parkinglot | 주차시설 | Y |
| mt13s | 공연장목록 |  |

### 결과코드
| 코드 | 설명 |
| --- | --- |
| 00 | NORMAL SERVICE |
| 01 | INVALID REQUEST PARAMETER ERROR |
| 02 | SERVICE KEY IS NOT REGISTERED ERROR |
| 03 | DB_ERROR |
| 04 | NODATA ERROR |

---

## 수상작 목록
- **요청 URL**: `http://kopis.or.kr/openApi/restful/prfawad`
- **요청 서비스**: 검색을 통한 수상작 목록 서비스
- **제약**: 최대 100건 조회

### 요청 변수
| 변수명 | 필수 | 크기 | 설명 | 샘플 |
| --- | --- | --- | --- | --- |
| service | O | 60 | 발급받은 인증키 |  |
| stdate | O | 8 | 공연시작일자 | 20160101 |
| eddate | O | 8 | 공연종료일자 | 20160630 |
| cpage | O | 3 | 현재페이지 | 1 |
| rows | O | 3 | 페이지당 목록 수(최대 100) | 10 |
| shprfnm | X | 100 | 공연명(URLEncoding) | 사랑 |
| shprfnmfct | X | 100 | 공연시설명(URLEncoding) | 예술의전당 |
| shcate | X | 4 | 장르코드 | **BBBC** |
| prfplccd | X | 4 | 공연장코드 | FC000001-01 |
| signgucode | X | 2 | 지역(시도)코드 | 11 |
| signgucodesub | X | 4 | 지역(구군)코드 | 1111 |
| kidstate | X | 1 | 아동공연여부 | Y |
| prfstate | X | 2 | 공연상태코드 | 01 |
| afterdate | X | 8 | 해당일자 이후 등록/수정만 출력 | 20230101 |

### 요청 예시
```
http://www.kopis.or.kr/openApi/restful/prfawad?service={SeriveKey}&stdate=20230601&eddate=20230630&cpage=1&rows=10&prfstate=02&signgucode=11&signgucodesub=1111
```

### 출력 필드
| 필드명 | 설명 | 샘플 |
| --- | --- | --- |
| mt20id | 공연ID | PF132236 |
| prfnm | 공연명 | 우리연애할까 |
| prfpdfrom | 공연시작일 | 2016.05.12 |
| prfpdto | 공연종료일 | 2016.07.31 |
| fcltynm | 공연시설명(공연장명) | 피가로아트홀(구 훈아트홀) |
| poster | 포스터이미지경로 | http://www.kopis.or.kr/upload/pfmPoster/PF_PF132236_160704_142630.gif |
| genrenm | 공연 장르명 | 연극 |
| prfstate | 공연상태 | 공연중 |
| awards | 수상실적 | 2017 대한민국 공감브랜드 대상 교육부문 대상 |

### 결과코드
| 코드 | 설명 |
| --- | --- |
| 00 | NORMAL SERVICE |
| 01 | INVALID REQUEST PARAMETER ERROR |
| 02 | SERVICE KEY IS NOT REGISTERED ERROR |
| 03 | DB_ERROR |
| 04 | NODATA ERROR |
| 05 | 최대 31일까지 조회가능합니다. |
| 06 | 최대 조회수는 100건까지 가능합니다. |
