"use server"

import { db } from "@/lib/db"
import type { SecurityNotificationType, SecuritySeverity } from "@prisma/client"
import { revalidatePath } from "next/cache"

export interface CreateSecurityNotificationData {
  userId: string // Can be "unknown" for failed attempts on non-existent accounts
  type: SecurityNotificationType
  title: string
  message: string
  severity: SecuritySeverity
  deviceInfo: {
    userAgent: string
    platform: string
    language: string
    screen: string
    timezone: string
    fingerprint: string
  }
  locationInfo?: {
    ip: string
    country?: string
    city?: string
    latitude?: number
    longitude?: number
  }
  attemptedEmail?: string
  failedAttempts?: number
  screenshot?: string
}

export async function createSecurityNotification(data: CreateSecurityNotificationData) {
  try {
    // If userId is "unknown", we'll create a notification without linking to a user
    // This handles cases where someone tries to login with a non-existent email
    if (data.userId === "unknown") {
      // For unknown users, we could either skip creating the notification
      // or create it with a special handling. For now, let's skip it.
      console.log("Skipping notification for unknown user:", data.attemptedEmail)
      return { success: true, notification: null }
    }

    const notification = await db.securityNotification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        severity: data.severity,
        deviceInfo: data.deviceInfo,
        locationInfo: data.locationInfo,
        attemptedEmail: data.attemptedEmail,
        failedAttempts: data.failedAttempts,
        screenshot: data.screenshot,
      },
    })

    revalidatePath("/notifications")
    return { success: true, notification }
  } catch (error) {
    console.error("Error creating security notification:", error)
    return { success: false, error: "Failed to create security notification" }
  }
}

export async function getUserSecurityNotifications(userId: string) {
  try {
    const notifications = await db.securityNotification.findMany({
      where: { userId },
      orderBy: { timestamp: "desc" },
    })
    return notifications
  } catch (error) {
    console.error("Error fetching security notifications:", error)
    return []
  }
}

export async function markNotificationAsRead(id: string) {
  try {
    await db.securityNotification.update({
      where: { id },
      data: { read: true },
    })

    revalidatePath("/notifications")
    return { success: true }
  } catch (error) {
    console.error("Error marking notification as read:", error)
    return { success: false, error: "Failed to mark notification as read" }
  }
}

export async function markAllNotificationsAsRead(userId: string) {
  try {
    await db.securityNotification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })

    revalidatePath("/notifications")
    return { success: true }
  } catch (error) {
    console.error("Error marking all notifications as read:", error)
    return { success: false, error: "Failed to mark notifications as read" }
  }
}

export async function deleteSecurityNotification(id: string) {
  try {
    await db.securityNotification.delete({
      where: { id },
    })

    revalidatePath("/notifications")
    return { success: true }
  } catch (error) {
    console.error("Error deleting security notification:", error)
    return { success: false, error: "Failed to delete notification" }
  }
}

export async function getUnreadNotificationCount(userId: string) {
  try {
    const count = await db.securityNotification.count({
      where: { userId, read: false },
    })
    return count
  } catch (error) {
    console.error("Error getting unread notification count:", error)
    return 0
  }
}
