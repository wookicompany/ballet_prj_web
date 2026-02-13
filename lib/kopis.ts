import { XMLParser } from "fast-xml-parser";

const KOPIS_BASE_URL = "http://kopis.or.kr/openApi/restful";
const KOPIS_GENRE_BBBC = "BBBC";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: true,
  trimValues: true,
});

type KopisListItem = {
  mt20id?: string;
  prfnm?: string;
  prfpdfrom?: string;
  prfpdto?: string;
  fcltynm?: string;
  poster?: string;
  area?: string;
  genrenm?: string;
  openrun?: string;
  prfstate?: string;
};

type KopisDetailItem = {
  mt20id?: string;
  prfnm?: string;
  prfpdfrom?: string;
  prfpdto?: string;
  fcltynm?: string;
  prfcast?: string;
  prfcrew?: string;
  prfruntime?: string;
  prfage?: string;
  entrpsnm?: string;
  entrpsnmP?: string;
  entrpsnmA?: string;
  entrpsnmH?: string;
  entrpsnmS?: string;
  pcseguidance?: string;
  poster?: string;
  area?: string;
  genrenm?: string;
  openrun?: string;
  visit?: string;
  child?: string;
  daehakro?: string;
  festival?: string;
  musicallicense?: string;
  musicalcreate?: string;
  updatedate?: string;
  prfstate?: string;
  sty?: string;
  styurls?: { styurl?: string | string[] } | string[] | string;
  mt10id?: string;
  dtguidance?: string;
  relates?: { relate?: unknown } | unknown[] | string;
};

type KopisFacilityListItem = {
  fcltynm?: string;
  mt10id?: string;
  mt13cnt?: string;
  fcltychartr?: string;
  sidonm?: string;
  gugunnm?: string;
  opende?: string;
};

type KopisFacilityDetailItem = {
  fcltynm?: string;
  mt10id?: string;
  mt13cnt?: string;
  fcltychartr?: string;
  opende?: string;
  seatscale?: string;
  telno?: string;
  relateurl?: string;
  adres?: string;
  la?: string;
  lo?: string;
  restaurant?: string;
  cafe?: string;
  store?: string;
  nolibang?: string;
  suyu?: string;
  parkbarrier?: string;
  restbarrier?: string;
  runwbarrier?: string;
  elevbarrier?: string;
  parkinglot?: string;
  mt13s?: { mt13?: unknown } | unknown[] | unknown;
};

type KopisAwardItem = {
  mt20id?: string;
  prfnm?: string;
  prfpdfrom?: string;
  prfpdto?: string;
  fcltynm?: string;
  poster?: string;
  genrenm?: string;
  prfstate?: string;
  awards?: string;
};

type KopisListResponse = {
  dbs?: {
    db?: KopisListItem | KopisListItem[];
  };
};

type KopisDetailResponse = {
  dbs?: {
    db?: KopisDetailItem | KopisDetailItem[];
  };
};

type KopisFacilityListResponse = {
  dbs?: {
    db?: KopisFacilityListItem | KopisFacilityListItem[];
  };
};

type KopisFacilityDetailResponse = {
  dbs?: {
    db?: KopisFacilityDetailItem | KopisFacilityDetailItem[];
  };
};

type KopisAwardListResponse = {
  dbs?: {
    db?: KopisAwardItem | KopisAwardItem[];
  };
};

const parseKopisDate = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.replace(/\./g, "-");
  const [yyyy, mm, dd] = normalized.split("-");
  if (!yyyy || !mm || !dd) return null;
  return `${yyyy}-${mm}-${dd}`;
};

const parseKopisDateTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const parseKopisNumber = (value?: string | null) => {
  if (!value) return null;
  const normalized = String(value).replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeArray = <T>(value: T | T[] | undefined | null) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const buildListUrl = ({
  serviceKey,
  stdate,
  eddate,
  page,
  rows,
  afterdate,
}: {
  serviceKey: string;
  stdate: string;
  eddate: string;
  page: number;
  rows: number;
  afterdate?: string;
}) => {
  const url = new URL(`${KOPIS_BASE_URL}/pblprfr`);
  url.searchParams.set("service", serviceKey);
  url.searchParams.set("stdate", stdate);
  url.searchParams.set("eddate", eddate);
  url.searchParams.set("cpage", String(page));
  url.searchParams.set("rows", String(rows));
  url.searchParams.set("shcate", KOPIS_GENRE_BBBC);
  if (afterdate) {
    url.searchParams.set("afterdate", afterdate);
  }
  return url.toString();
};

const buildDetailUrl = (serviceKey: string, performanceId: string) =>
  `${KOPIS_BASE_URL}/pblprfr/${performanceId}?service=${serviceKey}`;

const buildFacilityListUrl = ({
  serviceKey,
  page,
  rows,
  afterdate,
}: {
  serviceKey: string;
  page: number;
  rows: number;
  afterdate?: string;
}) => {
  const url = new URL(`${KOPIS_BASE_URL}/prfplc`);
  url.searchParams.set("service", serviceKey);
  url.searchParams.set("cpage", String(page));
  url.searchParams.set("rows", String(rows));
  if (afterdate) {
    url.searchParams.set("afterdate", afterdate);
  }
  return url.toString();
};

const buildFacilityDetailUrl = (serviceKey: string, facilityId: string) =>
  `${KOPIS_BASE_URL}/prfplc/${facilityId}?service=${serviceKey}`;

const buildAwardListUrl = ({
  serviceKey,
  stdate,
  eddate,
  page,
  rows,
  afterdate,
}: {
  serviceKey: string;
  stdate: string;
  eddate: string;
  page: number;
  rows: number;
  afterdate?: string;
}) => {
  const url = new URL(`${KOPIS_BASE_URL}/prfawad`);
  url.searchParams.set("service", serviceKey);
  url.searchParams.set("stdate", stdate);
  url.searchParams.set("eddate", eddate);
  url.searchParams.set("cpage", String(page));
  url.searchParams.set("rows", String(rows));
  url.searchParams.set("shcate", KOPIS_GENRE_BBBC);
  if (afterdate) {
    url.searchParams.set("afterdate", afterdate);
  }
  return url.toString();
};

const parseXml = <T>(xml: string): T => xmlParser.parse(xml) as T;

export const fetchKopisListPage = async ({
  serviceKey,
  stdate,
  eddate,
  page,
  rows,
  afterdate,
}: {
  serviceKey: string;
  stdate: string;
  eddate: string;
  page: number;
  rows: number;
  afterdate?: string;
}) => {
  const url = buildListUrl({ serviceKey, stdate, eddate, page, rows, afterdate });
  const response = await fetch(url, { cache: "no-store" });
  const xml = await response.text();
  const data = parseXml<KopisListResponse>(xml);
  const list = normalizeArray(data?.dbs?.db);
  return list.filter((item) => item?.mt20id);
};

export const fetchKopisDetail = async (
  serviceKey: string,
  performanceId: string,
) => {
  const response = await fetch(buildDetailUrl(serviceKey, performanceId), {
    cache: "no-store",
  });
  const xml = await response.text();
  const data = parseXml<KopisDetailResponse>(xml);
  const detail = normalizeArray(data?.dbs?.db)[0];
  return detail ?? null;
};

export const fetchKopisFacilityListPage = async ({
  serviceKey,
  page,
  rows,
  afterdate,
}: {
  serviceKey: string;
  page: number;
  rows: number;
  afterdate?: string;
}) => {
  const url = buildFacilityListUrl({ serviceKey, page, rows, afterdate });
  const response = await fetch(url, { cache: "no-store" });
  const xml = await response.text();
  const data = parseXml<KopisFacilityListResponse>(xml);
  const list = normalizeArray(data?.dbs?.db);
  return list.filter((item) => item?.mt10id);
};

export const fetchKopisFacilityDetail = async (
  serviceKey: string,
  facilityId: string,
) => {
  const response = await fetch(buildFacilityDetailUrl(serviceKey, facilityId), {
    cache: "no-store",
  });
  const xml = await response.text();
  const data = parseXml<KopisFacilityDetailResponse>(xml);
  const detail = normalizeArray(data?.dbs?.db)[0];
  return detail ?? null;
};

export const fetchKopisAwardsListPage = async ({
  serviceKey,
  stdate,
  eddate,
  page,
  rows,
  afterdate,
}: {
  serviceKey: string;
  stdate: string;
  eddate: string;
  page: number;
  rows: number;
  afterdate?: string;
}) => {
  const url = buildAwardListUrl({
    serviceKey,
    stdate,
    eddate,
    page,
    rows,
    afterdate,
  });
  const response = await fetch(url, { cache: "no-store" });
  const xml = await response.text();
  const data = parseXml<KopisAwardListResponse>(xml);
  const list = normalizeArray(data?.dbs?.db);
  return list.filter((item) => item?.mt20id);
};

export const mapKopisListItem = (item: KopisListItem) => ({
  mt20id: item.mt20id ?? null,
  prfnm: item.prfnm ?? null,
  prfpdfrom: parseKopisDate(item.prfpdfrom),
  prfpdto: parseKopisDate(item.prfpdto),
  fcltynm: item.fcltynm ?? null,
  poster: item.poster ?? null,
  area: item.area ?? null,
  genrenm: item.genrenm ?? null,
  openrun: item.openrun ?? null,
  prfstate: item.prfstate ?? null,
  is_active: true,
  updated_at: new Date().toISOString(),
});

export const mapKopisFacilityListItem = (item: KopisFacilityListItem) => ({
  mt10id: item.mt10id ?? null,
  fcltynm: item.fcltynm ?? null,
  mt13cnt: parseKopisNumber(item.mt13cnt),
  fcltychartr: item.fcltychartr ?? null,
  sidonm: item.sidonm ?? null,
  gugunnm: item.gugunnm ?? null,
  opende: item.opende ?? null,
  is_active: true,
  updated_at: new Date().toISOString(),
});

export const mapKopisDetailItem = (item: KopisDetailItem) => {
  const styurlList = normalizeArray(
    typeof item.styurls === "string"
      ? item.styurls
      : Array.isArray(item.styurls)
        ? item.styurls
        : item.styurls?.styurl
  ).filter((value): value is string => typeof value === "string");
  const relatesList = normalizeArray(
    typeof item.relates === "string"
      ? item.relates
      : Array.isArray(item.relates)
        ? item.relates
        : item.relates?.relate,
  ).filter((value): value is string => typeof value === "string");

  return {
    mt20id: item.mt20id ?? null,
    prfnm: item.prfnm ?? null,
    prfpdfrom: parseKopisDate(item.prfpdfrom),
    prfpdto: parseKopisDate(item.prfpdto),
    fcltynm: item.fcltynm ?? null,
    prfcast: item.prfcast ?? null,
    prfcrew: item.prfcrew ?? null,
    prfruntime: item.prfruntime ?? null,
    prfage: item.prfage ?? null,
    entrpsnm: item.entrpsnm ?? null,
    entrpsnm_p: item.entrpsnmP ?? null,
    entrpsnm_a: item.entrpsnmA ?? null,
    entrpsnm_h: item.entrpsnmH ?? null,
    entrpsnm_s: item.entrpsnmS ?? null,
    pcseguidance: item.pcseguidance ?? null,
    poster: item.poster ?? null,
    area: item.area ?? null,
    genrenm: item.genrenm ?? null,
    openrun: item.openrun ?? null,
    visit: item.visit ?? null,
    child: item.child ?? null,
    daehakro: item.daehakro ?? null,
    festival: item.festival ?? null,
    musicallicense: item.musicallicense ?? null,
    musicalcreate: item.musicalcreate ?? null,
    updatedate: parseKopisDateTime(item.updatedate),
    prfstate: item.prfstate ?? null,
    sty: item.sty ?? null,
    styurls: styurlList,
    mt10id: item.mt10id ?? null,
    dtguidance: item.dtguidance ?? null,
    relates: relatesList,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
};

export const mapKopisFacilityDetailItem = (item: KopisFacilityDetailItem) => {
  const mt13RawList = normalizeArray(
    Array.isArray(item.mt13s)
      ? item.mt13s
      : typeof item.mt13s === "object" && item.mt13s !== null
        ? (item.mt13s as { mt13?: unknown }).mt13
        : item.mt13s,
  );
  const mt13List = mt13RawList.flatMap((value) => {
    if (typeof value === "string") return [value];
    if (typeof value === "number") return [String(value)];
    if (value && typeof value === "object" && "mt13" in value) {
      const inner = (value as { mt13?: unknown }).mt13;
      if (typeof inner === "string") return [inner];
      if (typeof inner === "number") return [String(inner)];
    }
    return [];
  });

  return {
    mt10id: item.mt10id ?? null,
    fcltynm: item.fcltynm ?? null,
    mt13cnt: parseKopisNumber(item.mt13cnt),
    fcltychartr: item.fcltychartr ?? null,
    opende: item.opende ?? null,
    seatscale: item.seatscale ?? null,
    telno: item.telno ?? null,
    relateurl: item.relateurl ?? null,
    adres: item.adres ?? null,
    la: parseKopisNumber(item.la),
    lo: parseKopisNumber(item.lo),
    restaurant: item.restaurant ?? null,
    cafe: item.cafe ?? null,
    store: item.store ?? null,
    nolibang: item.nolibang ?? null,
    suyu: item.suyu ?? null,
    parkbarrier: item.parkbarrier ?? null,
    restbarrier: item.restbarrier ?? null,
    runwbarrier: item.runwbarrier ?? null,
    elevbarrier: item.elevbarrier ?? null,
    parkinglot: item.parkinglot ?? null,
    mt13s: mt13List.length ? mt13List : null,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
};

const normalizeAwardsText = (value?: string | null) => {
  if (!value) return null;
  const lines = value
    .replace(/&lt;br\s*\/?&gt;/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return null;
  return Array.from(new Set(lines)).join("\n");
};

export const mapKopisAwardItem = (item: KopisAwardItem) => {
  const normalizedAwards = normalizeAwardsText(item.awards);
  return {
    mt20id: item.mt20id ?? null,
    prfnm: item.prfnm ?? null,
    prfpdfrom: parseKopisDate(item.prfpdfrom),
    prfpdto: parseKopisDate(item.prfpdto),
    fcltynm: item.fcltynm ?? null,
    poster: item.poster ?? null,
    genrenm: item.genrenm ?? null,
    prfstate: item.prfstate ?? null,
    awards: normalizedAwards,
    awards_raw: item.awards ?? null,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
};
