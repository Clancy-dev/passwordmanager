"use server"

import { cookies } from "next/headers"
import { findSessionByToken, deleteSession } from "@/lib/actions/auth"

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get("session-token")?.value

    if (!sessionToken) {
      return null
    }

    const session = await findSessionByToken(sessionToken)

    if (!session || new Date() > session.expiresAt) {
      // Session expired, clean up
      if (session) {
        await deleteSession(sessionToken)
      }
      return null
    }

    return session.user
  } catch (error) {
    console.error("Error getting current user:", error)
    return null
  }
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies()
  cookieStore.set("session-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete("session-token")
}
