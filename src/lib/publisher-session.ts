import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServerSupabaseClientFromCookies } from "@/lib/supabase/server-route";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/admin-session";

export type PublisherSessionResult =
  | { ok: true; userId: string; email: string; username: string }
  | { ok: false; status: 401 | 403; message: string };

/** Publisher session, or admin catalog browse (no publisher id). */
export type BrandsAccessResult =
  | { ok: true; userId: string; email: string; username: string; catalogOnly?: false }
  | { ok: true; userId: null; email: string; username: string; catalogOnly: true }
  | { ok: false; status: 401 | 403; message: string };

const IMPERSONATE_COOKIE = "impersonate_publisher_id";

async function clearImpersonateCookie() {
  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

function isAdminSession(adminToken: string | null): boolean {
  return Boolean(adminToken && verifyAdminToken(adminToken));
}

async function loadPublisherProfile(userId: string) {
  const server = createServerSupabaseClient();
  return server
    .from("profiles")
    .select("username, email, role, approval_status")
    .eq("id", userId)
    .maybeSingle();
}

/**
 * Requires Supabase session + approved publisher profile.
 */
export async function requireApprovedPublisher(): Promise<PublisherSessionResult> {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? null;
  const impersonateId = cookieStore.get(IMPERSONATE_COOKIE)?.value?.trim() ?? "";

  // Admin impersonation: invalid/stale cookie falls through to normal session.
  if (isAdminSession(adminToken) && impersonateId) {
    const { data: profile, error } = await loadPublisherProfile(impersonateId);

    if (!error && profile) {
      if (profile.role !== "publisher") {
        return { ok: false, status: 403, message: "Publisher access only" };
      }
      if (profile.approval_status !== "approved") {
        return { ok: false, status: 403, message: "Account pending approval" };
      }
      return {
        ok: true,
        userId: impersonateId,
        email: profile.email ?? "",
        username: profile.username,
      };
    }

    await clearImpersonateCookie();
  }

  const auth = await createServerSupabaseClientFromCookies();
  const {
    data: { session },
  } = await auth.auth.getSession();
  if (!session?.user) {
    return { ok: false, status: 401, message: "Not authenticated" };
  }

  let { data: profile, error } = await loadPublisherProfile(session.user.id);

  // Repair missing profile row from auth metadata (e.g. signup interrupted).
  if ((error || !profile) && session.user) {
    const server = createServerSupabaseClient();
    const meta = session.user.user_metadata ?? {};
    const username =
      (typeof meta.username === "string" && meta.username.trim()) ||
      session.user.email?.split("@")[0] ||
      "user";
    const { data: repaired } = await server
      .from("profiles")
      .upsert(
        {
          id: session.user.id,
          username,
          role: "publisher",
          email: session.user.email ?? "",
          approval_status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select("username, email, role, approval_status")
      .maybeSingle();
    if (repaired) {
      profile = repaired;
      error = null;
    }
  }

  if (error || !profile) {
    return { ok: false, status: 403, message: "Profile not found — complete signup or contact support." };
  }
  if (profile.role !== "publisher") {
    return { ok: false, status: 403, message: "Publisher access only" };
  }
  if (profile.approval_status !== "approved") {
    return { ok: false, status: 403, message: "Account pending approval" };
  }

  return {
    ok: true,
    userId: session.user.id,
    email: profile.email ?? session.user.email ?? "",
    username: profile.username,
  };
}

/**
 * For read-only brand catalogues: approved publisher, or admin (no publisher session).
 */
export async function requireBrandsAccess(): Promise<BrandsAccessResult> {
  const pub = await requireApprovedPublisher();
  if (pub.ok) {
    return { ok: true, userId: pub.userId, email: pub.email, username: pub.username };
  }

  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? null;
  if (isAdminSession(adminToken) && pub.status === 401) {
    return { ok: true, userId: null, email: "", username: "admin", catalogOnly: true };
  }

  return pub;
}
