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

export const mapKopisDetailItem = (item: KopisDetailItem) => {
  const styurlList =
    typeof item.styurls === "string"
      ? [item.styurls]
      : normalizeArray(item.styurls?.styurl);
  const relatesList = normalizeArray(
    typeof item.relates === "string" ? item.relates : item.relates?.relate,
  );

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
