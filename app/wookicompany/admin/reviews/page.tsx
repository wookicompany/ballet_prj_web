"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { ChevronRight } from "lucide-react";

const LIMIT = 20;

type ReviewRow = {
  id: string;
  performance_id: string;
  user_id: string;
  rating: number;
  content: string | null;
  created_at: string;
  prfnm: string;
  nickname: string | null;
  report_count: number;
};

type CommentRow = {
  id: string;
  review_id: string;
  user_id: string;
  content: string;
  created_at: string;
  prfnm: string | null;
  nickname: string | null;
  report_count: number;
};

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewsOffset, setReviewsOffset] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsOffset, setCommentsOffset] = useState(0);
  const [commentsLoading, setCommentsLoading] = useState(true);

  const fetchReviews = useCallback(async (offset: number) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setReviewsLoading(false);
      return;
    }
    setReviewsLoading(true);
    try {
      const res = await fetch(`/api/admin/reviews?limit=${LIMIT}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setReviews(data.reviews ?? []);
      setReviewsTotal(data.total ?? 0);
      setReviewsOffset(offset);
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  const fetchComments = useCallback(async (offset: number) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setCommentsLoading(false);
      return;
    }
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/admin/review-comments?limit=${LIMIT}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setComments(data.comments ?? []);
      setCommentsTotal(data.total ?? 0);
      setCommentsOffset(offset);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews(0);
  }, [fetchReviews]);
  useEffect(() => {
    fetchComments(0);
  }, [fetchComments]);

  const reviewsPages = Math.ceil(reviewsTotal / LIMIT) || 1;
  const reviewsPage = Math.floor(reviewsOffset / LIMIT) + 1;
  const commentsPages = Math.ceil(commentsTotal / LIMIT) || 1;
  const commentsPage = Math.floor(commentsOffset / LIMIT) + 1;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="공연 리뷰/댓글 관리"
        description="리뷰와 댓글을 분리 탭으로 관리하고 신고 건을 빠르게 확인합니다."
      />
      <Tabs defaultValue="reviews">
        <TabsList>
          <TabsTrigger value="reviews">리뷰</TabsTrigger>
          <TabsTrigger value="comments">댓글</TabsTrigger>
        </TabsList>
        <TabsContent value="reviews" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>리뷰 목록 (총 {reviewsTotal.toLocaleString("ko-KR")}건)</CardTitle>
            </CardHeader>
            <CardContent>
              {reviewsLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>공연</TableHead>
                        <TableHead>작성자</TableHead>
                        <TableHead>평점</TableHead>
                        <TableHead className="max-w-[200px]">내용</TableHead>
                        <TableHead>신고</TableHead>
                        <TableHead>작성일</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviews.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            등록된 리뷰가 없습니다.
                          </TableCell>
                        </TableRow>
                      ) : (
                        reviews.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.prfnm}</TableCell>
                            <TableCell>{r.nickname ?? "-"}</TableCell>
                            <TableCell>{r.rating}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground">{r.content ?? "-"}</TableCell>
                            <TableCell>{r.report_count > 0 ? <Badge variant="secondary">{r.report_count}</Badge> : "-"}</TableCell>
                            <TableCell className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ko-KR")}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" asChild>
                                <Link href={`/wookicompany/admin/reviews/${r.id}`}>
                                  <ChevronRight className="size-4" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  {reviewsPages > 1 && (
                    <Pagination className="mt-4">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (reviewsPage > 1) fetchReviews(reviewsOffset - LIMIT); }} className={reviewsPage <= 1 ? "pointer-events-none opacity-50" : ""} />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink href="#" onClick={(e) => { e.preventDefault(); }} isActive>{reviewsPage} / {reviewsPages}</PaginationLink>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (reviewsPage < reviewsPages) fetchReviews(reviewsOffset + LIMIT); }} className={reviewsPage >= reviewsPages ? "pointer-events-none opacity-50" : ""} />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="comments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>댓글 목록 (총 {commentsTotal.toLocaleString("ko-KR")}건)</CardTitle>
            </CardHeader>
            <CardContent>
              {commentsLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>공연</TableHead>
                        <TableHead>작성자</TableHead>
                        <TableHead className="max-w-[200px]">내용</TableHead>
                        <TableHead>신고</TableHead>
                        <TableHead>작성일</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            등록된 댓글이 없습니다.
                          </TableCell>
                        </TableRow>
                      ) : (
                        comments.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.prfnm ?? "-"}</TableCell>
                            <TableCell>{c.nickname ?? "-"}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground">{c.content}</TableCell>
                            <TableCell>{c.report_count > 0 ? <Badge variant="secondary">{c.report_count}</Badge> : "-"}</TableCell>
                            <TableCell className="text-muted-foreground">{new Date(c.created_at).toLocaleDateString("ko-KR")}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" asChild>
                                <Link href={`/wookicompany/admin/reviews/comments/${c.id}`}>
                                  <ChevronRight className="size-4" />
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  {commentsPages > 1 && (
                    <Pagination className="mt-4">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (commentsPage > 1) fetchComments(commentsOffset - LIMIT); }} className={commentsPage <= 1 ? "pointer-events-none opacity-50" : ""} />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink href="#" onClick={(e) => { e.preventDefault(); }} isActive>{commentsPage} / {commentsPages}</PaginationLink>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (commentsPage < commentsPages) fetchComments(commentsOffset + LIMIT); }} className={commentsPage >= commentsPages ? "pointer-events-none opacity-50" : ""} />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
