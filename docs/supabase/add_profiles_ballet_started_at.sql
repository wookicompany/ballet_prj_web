-- profiles 테이블에 발레 시작 날짜를 저장하기 위한 컬럼 추가
alter table public.profiles
add column if not exists ballet_started_at date;
