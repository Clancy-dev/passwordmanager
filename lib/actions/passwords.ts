"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

export interface CreatePasswordEntryData {
  userId: string
  email: string
  password: string
  description?: string
}

export interface UpdatePasswordEntryData {
  id: string
  email?: string
  password?: string
  description?: string
}

export async function createPasswordEntry(data: CreatePasswordEntryData) {
  try {
    const entry = await db.passwordEntry.create({
      data: {
        userId: data.userId,
        email: data.email,
        password: data.password,
        description: data.description || "",
      },
    })

    revalidatePath("/")
    return { success: true, entry }
  } catch (error) {
    console.error("Error creating password entry:", error)
    return { success: false, error: "Failed to create password entry" }
  }
}

export async function getUserPasswordEntries(userId: string) {
  try {
    const entries = await db.passwordEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })
    return entries
  } catch (error) {
    console.error("Error fetching password entries:", error)
    return []
  }
}

export async function updatePasswordEntry(data: UpdatePasswordEntryData) {
  try {
    const entry = await db.passwordEntry.update({
      where: { id: data.id },
      data: {
        ...(data.email && { email: data.email }),
        ...(data.password && { password: data.password }),
        ...(data.description !== undefined && { description: data.description }),
      },
    })

    revalidatePath("/")
    return { success: true, entry }
  } catch (error) {
    console.error("Error updating password entry:", error)
    return { success: false, error: "Failed to update password entry" }
  }
}

export async function deletePasswordEntry(id: string) {
  try {
    await db.passwordEntry.delete({
      where: { id },
    })

    revalidatePath("/")
    return { success: true }
  } catch (error) {
    console.error("Error deleting password entry:", error)
    return { success: false, error: "Failed to delete password entry" }
  }
}

export async function searchPasswordEntries(userId: string, query: string) {
  try {
    const entries = await db.passwordEntry.findMany({
      where: {
        userId,
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
    })
    return entries
  } catch (error) {
    console.error("Error searching password entries:", error)
    return []
  }
}
