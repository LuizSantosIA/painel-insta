import { NextResponse } from "next/server";

export async function GET() {
  // Usa o Instagram App ID (produto Instagram), não o Facebook App ID
  const appId = process.env.IG_INSTAGRAM_APP_ID ?? process.env.IG_APP_ID!;
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const redirectUri = `${base}/api/auth/callback`;
  const scope = [
    "instagram_business_basic",
    "instagram_business_manage_insights",
    "instagram_business_manage_comments",
    "instagram_business_manage_messages",
  ].join(",");

  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("response_type", "code");

  return NextResponse.redirect(url.toString());
}