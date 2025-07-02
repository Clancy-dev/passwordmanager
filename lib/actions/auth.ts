"use server"

import { db } from "@/lib/db"

export interface CreateUserData {
  username: string
  email: string
  password: string
  sessionTimeout?: number
}

export interface LoginData {
  email: string
  password: string
  securityAnswer: string
  deviceFingerprint: string
  ipAddress: string
  userAgent: string
}

export interface UpdateUserData {
  id: string
  username?: string
  email?: string
  password?: string
  sessionTimeout?: number
  resetToken?: string
  resetTokenExpiry?: Date
  failedAttempts?: number
  lockedUntil?: Date
  deviceFingerprint?: string
}

export async function createUser(data: CreateUserData) {
  try {
    const existingUser = await db.user.findUnique({
      where: { email: data.email.toLowerCase() },
    })

    if (existingUser) {
      return { success: false, error: "User with this email already exists" }
    }

    const user = await db.user.create({
      data: {
        username: data.username,
        email: data.email.toLowerCase(),
        password: data.password,
        sessionTimeout: data.sessionTimeout || 5,
      },
    })

    return { success: true, user }
  } catch (error) {
    console.error("Error creating user:", error)
    return { success: false, error: "Failed to create user" }
  }
}

export async function findUserByEmail(email: string) {
  try {
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    })
    return user
  } catch (error) {
    console.error("Error finding user:", error)
    return null
  }
}

export async function findUserById(id: string) {
  try {
    const user = await db.user.findUnique({
      where: { id },
    })
    return user
  } catch (error) {
    console.error("Error finding user:", error)
    return null
  }
}

export async function updateUser(data: UpdateUserData) {
  try {
    const user = await db.user.update({
      where: { id: data.id },
      data: {
        ...(data.username && { username: data.username }),
        ...(data.email && { email: data.email.toLowerCase() }),
        ...(data.password && { password: data.password }),
        ...(data.sessionTimeout !== undefined && { sessionTimeout: data.sessionTimeout }),
        ...(data.resetToken !== undefined && { resetToken: data.resetToken }),
        ...(data.resetTokenExpiry !== undefined && { resetTokenExpiry: data.resetTokenExpiry }),
        ...(data.failedAttempts !== undefined && { failedAttempts: data.failedAttempts }),
        ...(data.lockedUntil !== undefined && { lockedUntil: data.lockedUntil }),
        ...(data.deviceFingerprint && { deviceFingerprint: data.deviceFingerprint }),
      },
    })
    return { success: true, user }
  } catch (error) {
    console.error("Error updating user:", error)
    return { success: false, error: "Failed to update user" }
  }
}

export async function createSession(
  userId: string,
  sessionData: {
    token: string
    deviceFingerprint: string
    ipAddress: string
    userAgent: string
    expiresAt: Date
  },
) {
  try {
    // Clean up expired sessions for this user
    await db.session.deleteMany({
      where: {
        userId,
        expiresAt: { lt: new Date() },
      },
    })

    const session = await db.session.create({
      data: {
        userId,
        token: sessionData.token,
        deviceFingerprint: sessionData.deviceFingerprint,
        ipAddress: sessionData.ipAddress,
        userAgent: sessionData.userAgent,
        expiresAt: sessionData.expiresAt,
      },
    })

    return { success: true, session }
  } catch (error) {
    console.error("Error creating session:", error)
    return { success: false, error: "Failed to create session" }
  }
}

export async function findSessionByToken(token: string) {
  try {
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    })
    return session
  } catch (error) {
    console.error("Error finding session:", error)
    return null
  }
}

export async function deleteSession(token: string) {
  try {
    await db.session.delete({
      where: { token },
    })
    return { success: true }
  } catch (error) {
    console.error("Error deleting session:", error)
    return { success: false, error: "Failed to delete session" }
  }
}

export async function deleteUserSessions(userId: string) {
  try {
    await db.session.deleteMany({
      where: { userId },
    })
    return { success: true }
  } catch (error) {
    console.error("Error deleting user sessions:", error)
    return { success: false, error: "Failed to delete sessions" }
  }
}
