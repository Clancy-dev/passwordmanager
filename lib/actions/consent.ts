"use server"

import { db } from "@/lib/db"

export interface CreateConsentData {
  userId?: string
  accepted: boolean
  sessionId: string
  permissions: {
    camera: boolean
    location: boolean
    storage: boolean
  }
  timeToDecision: number
  ipAddress?: string
  userAgent?: string
}

export async function createConsent(data: CreateConsentData) {
  try {
    const consent = await db.consent.create({
      data: {
        userId: data.userId,
        accepted: data.accepted,
        sessionId: data.sessionId,
        permissions: data.permissions,
        timeToDecision: data.timeToDecision,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    })

    return { success: true, consent }
  } catch (error) {
    console.error("Error creating consent:", error)
    return { success: false, error: "Failed to create consent" }
  }
}

export async function findConsentBySessionId(sessionId: string) {
  try {
    const consent = await db.consent.findFirst({
      where: { sessionId },
    })
    return consent
  } catch (error) {
    console.error("Error finding consent:", error)
    return null
  }
}

export async function getUserConsents(userId: string) {
  try {
    const consents = await db.consent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })
    return consents
  } catch (error) {
    console.error("Error fetching user consents:", error)
    return []
  }
}
