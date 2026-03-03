import { NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/apiAuth";

export const GET = async (request: Request) => {
  const result = await getAdminFromRequest(request);
  if (!result.admin) {
    return result.errorResponse;
  }
  return NextResponse.json({
    id: result.user.id,
    email: result.user.email ?? null,
    is_admin: true,
  });
};
