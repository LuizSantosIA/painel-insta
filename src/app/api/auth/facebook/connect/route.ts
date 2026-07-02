import { NextResponse } from "next/server";

export async function GET() {
  const appId = process.env.FB_APP_ID!;
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const redirectUri = `${base}/api/auth/facebook/callback`;

  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "pages_show_list,pages_read_engagement");
  url.searchParams.set("response_type", "code");

  return NextResponse.redirect(url.toString());
}
