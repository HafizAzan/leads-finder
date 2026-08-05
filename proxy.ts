import { NextRequest, NextResponse } from "next/server";

export default function proxy(req: NextRequest) {
  const { pathname } = req?.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/leads", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
