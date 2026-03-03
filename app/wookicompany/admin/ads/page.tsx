"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Plus } from "lucide-react";
import { formatIsoToSeoulDate } from "@/lib/kstDateTime";

const LIMIT = 20;

type AdRow = {
  id: string;
  placement: "calendar_home" | "performance_home";
  title: string;
  is_active: boolean;
  start_at: string;
  end_at: string;
  click_count: number;
  created_at: string;
};

const placementLabel = (value: AdRow["placement"]) =>
  value === "calendar_home" ? "캘린더 홈" : "공연 홈";

export default function AdminAdsPage() {
  const [ads, setAds] = useState<AdRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAds = useCallback(async (pageOffset: number) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ads?limit=${LIMIT}&offset=${pageOffset}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setAds(data.ads ?? []);
      setTotal(data.total ?? 0);
      setOffset(pageOffset);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAds(0);
  }, [fetchAds]);

  const totalPages = Math.ceil(total / LIMIT) || 1;
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">광고 관리</h1>
        <Button asChild>
          <Link href="/wookicompany/admin/ads/new">
            <Plus className="mr-1 size-4" />
            새 광고
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>광고 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>위치</TableHead>
                    <TableHead>광고명</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>노출 기간(KST)</TableHead>
                    <TableHead>클릭수</TableHead>
                    <TableHead>생성일</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        등록된 광고가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ads.map((ad) => (
                      <TableRow key={ad.id}>
                        <TableCell>{placementLabel(ad.placement)}</TableCell>
                        <TableCell className="max-w-[260px] truncate font-medium">
                          {ad.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant={ad.is_active ? "default" : "secondary"}>
                            {ad.is_active ? "활성" : "비활성"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatIsoToSeoulDate(ad.start_at)} ~ {formatIsoToSeoulDate(ad.end_at)}
                        </TableCell>
                        <TableCell>{ad.click_count}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatIsoToSeoulDate(ad.created_at)}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/wookicompany/admin/ads/${ad.id}`}>
                              <ChevronRight className="size-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <Pagination className="mt-4">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) fetchAds(offset - LIMIT);
                        }}
                        className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (p) =>
                          p === 1 ||
                          p === totalPages ||
                          (p >= currentPage - 2 && p <= currentPage + 2)
                      )
                      .map((p) => (
                        <PaginationItem key={p}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              fetchAds((p - 1) * LIMIT);
                            }}
                            isActive={currentPage === p}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages) fetchAds(offset + LIMIT);
                        }}
                        className={
                          currentPage >= totalPages ? "pointer-events-none opacity-50" : ""
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
