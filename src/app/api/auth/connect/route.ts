import { NextResponse } from "next/server";
import { envAlgum, urlBase } from "@/lib/env";

export async function GET() {
  // Usa o Instagram App ID (produto Instagram), não o Facebook App ID
  const appId = envAlgum("IG_INSTAGRAM_APP_ID", "IG_APP_ID");
  const base = urlBase();
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