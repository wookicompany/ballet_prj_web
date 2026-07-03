const CHUNK_SIZE = 1000;
// 개인 기록 앱 특성상 실사용에서 절대 닿지 않는 수준의 상한(2억 행)이지만,
// range()가 정상적으로 진행되지 않는 예외 상황에서 무한 루프로 브라우저가
// 멈추는 것을 막기 위한 안전장치.
const MAX_ITERATIONS = 200_000;

// Supabase(PostgREST)는 range() 없이 select하면 기본 row cap(보통 1000행)에 걸려
// 그 이후 데이터가 조용히 누락된다. buildQuery가 매 반복마다 새 range로 쿼리를
// 만들어 응답이 CHUNK_SIZE보다 적게 올 때까지 반복 호출해 전체 행을 모은다.
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const to = from + CHUNK_SIZE - 1;
    const { data, error } = await buildQuery(from, to);
    if (error || !data) break;
    all.push(...data);
    if (data.length < CHUNK_SIZE) break;
    from += CHUNK_SIZE;
  }

  return all;
}
