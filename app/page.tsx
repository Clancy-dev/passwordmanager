"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import {
  Search,
  Plus,
  Eye,
  EyeOff,
  MoreHorizontal,
  Edit,
  Trash2,
  Info,
  User,
  LogOut,
  ArrowLeft,
  Shield,
  AlertTriangle,
  Lock,
  Bell,
  Camera,
  MapPin,
  Monitor,
  X,
  CheckCircle,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import toast, { Toaster } from "react-hot-toast"

// Import server actions
import { createUser, findUserByEmail, updateUser, createSession } from "@/lib/actions/auth"
import {
  createPasswordEntry,
  getUserPasswordEntries,
  updatePasswordEntry,
  deletePasswordEntry,
} from "@/lib/actions/passwords"
import {
  createSecurityNotification,
  getUserSecurityNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteSecurityNotification,
  getUnreadNotificationCount,
} from "@/lib/actions/security"
import { createConsent, findConsentBySessionId } from "@/lib/actions/consent"
import { getCurrentUser, setSessionCookie, clearSessionCookie } from "@/lib/utils/session"

// Types
interface PasswordEntry {
  id: string
  email: string
  password: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

interface FormData {
  email: string
  password: string
  description: string
}

interface UserAccount {
  id: string
  username: string
  email: string
  password: string
  sessionTimeout: number
  failedAttempts: number
  lockedUntil: Date | null
  deviceFingerprint: string | null
  resetToken: string | null
  resetTokenExpiry: Date | null
  createdAt: Date
  updatedAt: Date
}

interface SecurityNotification {
  id: string
  type: string
  title: string
  message: string
  severity: string
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
  attemptedEmail?: string | null
  failedAttempts?: number | null
  screenshot?: string | null
  timestamp: Date
  read: boolean
}

const ITEMS_PER_PAGE_OPTIONS = [5, 10, 15, 20, 50, 100]
const SESSION_TIMEOUT_OPTIONS = [5, 10, 15] // minutes
const MAX_LOGIN_ATTEMPTS = 3
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes

export default function PasswordManager() {
  const [currentPage, setCurrentPage] = useState<"main" | "profile" | "auth" | "notifications" | "consent" | "blocked">(
    "consent",
  )
  const [authMode, setAuthMode] = useState<"login" | "signup" | "reset">("login")
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null)
  const [entries, setEntries] = useState<PasswordEntry[]>([])
  const [notifications, setNotifications] = useState<SecurityNotification[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPageNum, setCurrentPageNum] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<PasswordEntry | null>(null)
  const [formData, setFormData] = useState<FormData>({ email: "", password: "", description: "" })
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set())
  const [createPasswordVisible, setCreatePasswordVisible] = useState(true)
  const [editPasswordVisible, setEditPasswordVisible] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  // Consent management
  const [showConsentDialog, setShowConsentDialog] = useState(false)
  const [consentStartTime, setConsentStartTime] = useState<number>(0)
  const [isProcessingConsent, setIsProcessingConsent] = useState(false)
  const [permissionsGranted, setPermissionsGranted] = useState({
    camera: false,
    location: false,
    storage: false,
  })

  // Session management
  const [lastActivity, setLastActivity] = useState<number>(Date.now())
  const [showSessionExpired, setShowSessionExpired] = useState(false)
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Security states
  const [securityChallenge, setSecurityChallenge] = useState<string>("")
  const [challengeAnswer, setChallengeAnswer] = useState<string>("")
  const [loginAttempts, setLoginAttempts] = useState<number>(0)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false)

  // Auth form states
  const [loginForm, setLoginForm] = useState({ email: "", password: "", securityAnswer: "" })
  const [signupForm, setSignupForm] = useState({ username: "", email: "", password: "", confirmPassword: "" })
  const [resetForm, setResetForm] = useState({ email: "", token: "", newPassword: "", confirmPassword: "" })
  const [profileForm, setProfileForm] = useState({
    username: "",
    email: "",
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
    resetToken: "",
    sessionTimeout: 5,
  })

  // Password visibility states
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false)
  const [showProfileOldPassword, setShowProfileOldPassword] = useState(false)
  const [showProfileNewPassword, setShowProfileNewPassword] = useState(false)
  const [showProfileConfirmPassword, setShowProfileConfirmPassword] = useState(false)

  const [resetStep, setResetStep] = useState<"email" | "token">("email")
  const [generatedToken, setGeneratedToken] = useState("")

  // Utility functions
  const generateSessionId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9)
  }

  const generateSecureToken = () => {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
  }

// thethetevvd

  const generateDeviceFingerprint = () => {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.textBaseline = "top"
      ctx.font = "14px Arial"
      ctx.fillText("Device fingerprint", 2, 2)
    }

    const fingerprint = btoa(
      JSON.stringify({
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
        canvas: canvas.toDataURL(),
        timestamp: Date.now(),
      }),
    )
    return fingerprint
  }

  const getDetailedDeviceInfo = () => {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      fingerprint: generateDeviceFingerprint(),
    }
  }

  const getLocationInfo = async (): Promise<any> => {
    return new Promise((resolve) => {
      const mockLocation = {
        ip: "192.168.1." + Math.floor(Math.random() * 255),
        country: "Unknown",
        city: "Unknown",
        latitude: 0,
        longitude: 0,
      }

      if (navigator.geolocation && permissionsGranted.location) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              ...mockLocation,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            })
          },
          () => {
            resolve(mockLocation)
          },
          { timeout: 5000 },
        )
      } else {
        resolve(mockLocation)
      }
    })
  }

  const generateSecurityChallenge = () => {
    const challenges = [
      "What is 7 × 13?",
      "What is 156 ÷ 12?",
      "What is 23 + 47?",
      "What is 89 - 34?",
      "What is 15 × 8?",
      "What is 144 ÷ 9?",
      "What is 67 + 28?",
      "What is 92 - 37?",
    ]
    const answers = ["91", "13", "70", "55", "120", "16", "95", "55"]
    const index = Math.floor(Math.random() * challenges.length)
    setChallengeAnswer(answers[index])
    return challenges[index]
  }

  const validatePasswordStrength = (password: string): { isValid: boolean; message: string } => {
    if (password.length < 12) {
      return { isValid: false, message: "Password must be at least 12 characters long" }
    }
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: "Password must contain at least one uppercase letter" }
    }
    if (!/[a-z]/.test(password)) {
      return { isValid: false, message: "Password must contain at least one lowercase letter" }
    }
    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: "Password must contain at least one number" }
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      return { isValid: false, message: "Password must contain at least one special character" }
    }
    if (/(.)\1{2,}/.test(password)) {
      return { isValid: false, message: "Password cannot contain repeated characters" }
    }
    return { isValid: true, message: "Password is strong" }
  }

  // Permission functions
  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      })
      const permissionStatus = await navigator.permissions.query({ name: "camera" as PermissionName })
      if (permissionStatus.state === "granted") {
        stream.getTracks().forEach((track) => track.stop())
        return true
      } else {
        stream.getTracks().forEach((track) => track.stop())
        throw new Error("temporary_permission")
      }
    } catch (error: any) {
      console.error("Camera permission denied:", error)
      return false
    }
  }

  const requestLocationPermission = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(false)
        return
      }

      navigator.geolocation.getCurrentPosition(
        async () => {
          try {
            const permissionStatus = await navigator.permissions.query({ name: "geolocation" as PermissionName })
            resolve(permissionStatus.state === "granted")
          } catch {
            resolve(true) // Fallback: assume granted if we got position
          }
        },
        () => resolve(false),
        { timeout: 10000, enableHighAccuracy: false },
      )
    })
  }

  const requestStoragePermission = (): boolean => {
    try {
      const testKey = "test-storage-permission"
      localStorage.setItem(testKey, "test")
      localStorage.removeItem(testKey)
      return true
    } catch (error) {
      console.error("Storage permission denied:", error)
      return false
    }
  }

  // Consent handling
  const handleConsentAccept = async () => {
    setIsProcessingConsent(true)
    const decisionTime = Date.now() - consentStartTime

    try {
      toast.loading("Please grant the required permissions when prompted by your browser...", { duration: 8000 })
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const [cameraGranted, locationGranted, storageGranted] = await Promise.all([
        requestCameraPermission(),
        requestLocationPermission(),
        requestStoragePermission(),
      ])

      if (!cameraGranted || !locationGranted || !storageGranted) {
        toast.dismiss()
        toast.error("❌ Required permissions not granted correctly. Please refresh and try again.", { duration: 10000 })
        setIsProcessingConsent(false)
        setCurrentPage("blocked")
        return
      }

      const permissions = { camera: cameraGranted, location: locationGranted, storage: storageGranted }
      setPermissionsGranted(permissions)

      // Store consent in database
      const sessionId = generateSessionId()
      await createConsent({
        accepted: true,
        sessionId,
        permissions,
        timeToDecision: decisionTime,
        ipAddress: "127.0.0.1", // In real app, get actual IP
        userAgent: navigator.userAgent,
      })

      // Store session ID in localStorage for this session
      localStorage.setItem("consent-session-id", sessionId)

      setShowConsentDialog(false)
      setIsProcessingConsent(false)
      checkExistingSession()

      toast.dismiss()
      toast.success("🎉 All permissions granted successfully! Welcome to the secure password manager.", {
        duration: 5000,
      })
    } catch (error) {
      console.error("Error processing consent:", error)
      toast.dismiss()
      toast.error("❌ Failed to obtain required permissions. Please refresh the page and try again.", {
        duration: 8000,
      })
      setIsProcessingConsent(false)
      setCurrentPage("blocked")
    }
  }

  const handleConsentDecline = async () => {
    const decisionTime = Date.now() - consentStartTime
    const sessionId = generateSessionId()

    await createConsent({
      accepted: false,
      sessionId,
      permissions: { camera: false, location: false, storage: false },
      timeToDecision: decisionTime,
      ipAddress: "127.0.0.1",
      userAgent: navigator.userAgent,
    })

    setShowConsentDialog(false)
    setCurrentPage("blocked")
  }

  const checkExistingSession = async () => {
    try {
      const user = await getCurrentUser()
      if (user) {
        setCurrentUser(user)
        setCurrentPage("main")
        loadUserData(user.id)
      } else {
        setCurrentPage("auth")
      }
    } catch (error) {
      console.error("Error checking existing session:", error)
      setCurrentPage("auth")
    }
  }

  const loadUserData = async (userId: string) => {
    try {
      const [passwordEntries, securityNotifications, unreadCount] = await Promise.all([
        getUserPasswordEntries(userId),
        getUserSecurityNotifications(userId),
        getUnreadNotificationCount(userId),
      ])

      setEntries(passwordEntries)
      setNotifications(securityNotifications)
      setUnreadCount(unreadCount)
    } catch (error) {
      console.error("Error loading user data:", error)
    }
  }

  // Authentication functions
  const handleSignup = async () => {
    if (!signupForm.username.trim() || !signupForm.email.trim() || !signupForm.password.trim()) {
      toast.error("All fields are required!")
      return
    }

    if (signupForm.password !== signupForm.confirmPassword) {
      toast.error("Passwords do not match!")
      return
    }

    const passwordValidation = validatePasswordStrength(signupForm.password)
    if (!passwordValidation.isValid) {
      toast.error(passwordValidation.message)
      return
    }

    const result = await createUser({
      username: signupForm.username.trim(),
      email: signupForm.email.trim(),
      password: signupForm.password,
      sessionTimeout: 5,
    })

    if (!result.success) {
      toast.error(result.error || "Failed to create account")
      return
    }

    // Create session
    const token = generateSecureToken()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    await createSession(result.user!.id, {
      token,
      deviceFingerprint: generateDeviceFingerprint(),
      ipAddress: "127.0.0.1",
      userAgent: navigator.userAgent,
      expiresAt,
    })

    await setSessionCookie(token, expiresAt)
    setCurrentUser(result.user!)
    setCurrentPage("main")
    setSignupForm({ username: "", email: "", password: "", confirmPassword: "" })
    toast.success("Account created successfully! Welcome to Password Manager!")
  }

  const handleLogin = async () => {
    if (!loginForm.email.trim() || !loginForm.password.trim() || !loginForm.securityAnswer.trim()) {
      toast.error("All fields are required!")
      return
    }

    if (loginForm.securityAnswer !== challengeAnswer) {
      toast.error("Security challenge failed!")
      setSecurityChallenge(generateSecurityChallenge())
      setLoginForm((prev) => ({ ...prev, securityAnswer: "" }))
      return
    }

    const user = await findUserByEmail(loginForm.email)
    if (!user) {
      toast.error("Invalid email or password!")
      setLoginAttempts((prev) => prev + 1)
      setSecurityChallenge(generateSecurityChallenge())
      setLoginForm((prev) => ({ ...prev, securityAnswer: "" }))
      return
    }

    // Check if account is locked
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const lockTime = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
      toast.error(`Account locked. Try again in ${lockTime} minutes.`)
      return
    }

    if (user.password !== loginForm.password) {
      const failedAttempts = user.failedAttempts + 1
      const updateData: any = { id: user.id, failedAttempts }

      if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
        updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION)
        toast.error("Too many failed attempts. Account locked for 15 minutes.")

        // Create security notification
        await createSecurityNotification({
          userId: user.id,
          type: "ACCOUNT_LOCKOUT",
          title: "Account Locked - Multiple Failed Attempts",
          message: `Account ${user.email} has been locked due to ${failedAttempts} failed login attempts.`,
          severity: "CRITICAL",
          deviceInfo: getDetailedDeviceInfo(),
          locationInfo: await getLocationInfo(),
          attemptedEmail: user.email,
          failedAttempts,
        })
      } else {
        toast.error(`Invalid password! ${MAX_LOGIN_ATTEMPTS - failedAttempts} attempts remaining.`)
      }

      await updateUser(updateData)
      setLoginAttempts((prev) => prev + 1)
      setSecurityChallenge(generateSecurityChallenge())
      setLoginForm((prev) => ({ ...prev, securityAnswer: "" }))
      return
    }

    // Successful login
    await updateUser({
      id: user.id,
      failedAttempts: 0,
      lockedUntil: null,
      deviceFingerprint: generateDeviceFingerprint(),
    })

    // Create session
    const token = generateSecureToken()
    const expiresAt = new Date(Date.now() + user.sessionTimeout * 60 * 1000)

    await createSession(user.id, {
      token,
      deviceFingerprint: generateDeviceFingerprint(),
      ipAddress: "127.0.0.1",
      userAgent: navigator.userAgent,
      expiresAt,
    })

    await setSessionCookie(token, expiresAt)
    setCurrentUser(user)
    setCurrentPage("main")
    setLoginForm({ email: "", password: "", securityAnswer: "" })
    setLoginAttempts(0)
    loadUserData(user.id)
    toast.success(`Welcome back, ${user.username}!`)
  }

  const handleLogout = async () => {
    if (sessionTimeoutRef.current) clearTimeout(sessionTimeoutRef.current)

    await clearSessionCookie()
    setCurrentUser(null)
    setEntries([])
    setNotifications([])
    setCurrentPage("auth")
    toast.success("Logged out successfully!")
  }

  // Password entry functions
  const handleCreateEntry = async () => {
    if (!currentUser || !formData.email.trim() || !formData.password.trim()) {
      toast.error("Email and password are required!")
      return
    }

    const result = await createPasswordEntry({
      userId: currentUser.id,
      email: formData.email.trim(),
      password: formData.password,
      description: formData.description.trim(),
    })

    if (result.success) {
      setEntries((prev) => [result.entry!, ...prev])
      clearForm()
      setShowCreateDialog(false)
      toast.success("Password entry created successfully!")
    } else {
      toast.error(result.error || "Failed to create password entry")
    }
  }

  const handleEditEntry = async () => {
    if (!selectedEntry || !formData.email.trim() || !formData.password.trim()) {
      toast.error("Email and password are required!")
      return
    }

    const result = await updatePasswordEntry({
      id: selectedEntry.id,
      email: formData.email.trim(),
      password: formData.password,
      description: formData.description.trim(),
    })

    if (result.success) {
      setEntries((prev) => prev.map((entry) => (entry.id === selectedEntry.id ? result.entry! : entry)))
      clearForm()
      setShowEditDialog(false)
      setSelectedEntry(null)
      toast.success("Password entry updated successfully!")
    } else {
      toast.error(result.error || "Failed to update password entry")
    }
  }

  const handleDeleteEntry = async () => {
    if (!selectedEntry) return

    const result = await deletePasswordEntry(selectedEntry.id)

    if (result.success) {
      setEntries((prev) => prev.filter((entry) => entry.id !== selectedEntry.id))
      setShowDeleteDialog(false)
      setSelectedEntry(null)
      toast.success("Password entry deleted successfully!")
    } else {
      toast.error(result.error || "Failed to delete password entry")
    }
  }

  // Notification functions
  const handleMarkNotificationAsRead = async (notificationId: string) => {
    const result = await markNotificationAsRead(notificationId)
    if (result.success) {
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }
  }

  const handleMarkAllNotificationsAsRead = async () => {
    if (!currentUser) return

    const result = await markAllNotificationsAsRead(currentUser.id)
    if (result.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    }
  }

  const handleDeleteNotification = async (notificationId: string) => {
    const result = await deleteSecurityNotification(notificationId)
    if (result.success) {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
      const notification = notifications.find((n) => n.id === notificationId)
      if (notification && !notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    }
  }

  // Utility functions
  const clearForm = () => {
    setFormData({ email: "", password: "", description: "" })
    setCreatePasswordVisible(true)
  }

  const openEditDialog = (entry: PasswordEntry) => {
    setSelectedEntry(entry)
    setFormData({
      email: entry.email,
      password: entry.password,
      description: entry.description || "",
    })
    setEditPasswordVisible(true)
    setShowEditDialog(true)
  }

  const openViewDialog = (entry: PasswordEntry) => {
    setSelectedEntry(entry)
    setShowViewDialog(true)
  }

  const openDeleteDialog = (entry: PasswordEntry) => {
    setSelectedEntry(entry)
    setShowDeleteDialog(true)
  }

  const togglePasswordVisibility = (entryId: string) => {
    setVisiblePasswords((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(entryId)) {
        newSet.delete(entryId)
      } else {
        newSet.add(entryId)
      }
      return newSet
    })
  }

  const truncateText = (text: string, maxLength = 50) => {
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text
  }

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "low":
        return "text-blue-600 bg-blue-50 border-blue-200"
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200"
      case "high":
        return "text-orange-600 bg-orange-50 border-orange-200"
      case "critical":
        return "text-red-600 bg-red-50 border-red-200"
      default:
        return "text-gray-600 bg-gray-50 border-gray-200"
    }
  }

  // Filter and pagination
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries

    const query = searchQuery.toLowerCase()
    return entries.filter(
      (entry) =>
        entry.email.toLowerCase().includes(query) ||
        (entry.description && entry.description.toLowerCase().includes(query)),
    )
  }, [entries, searchQuery])

  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPageNum - 1) * itemsPerPage
    return filteredEntries.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredEntries, currentPageNum, itemsPerPage])

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage)

  // Effects
  useEffect(() => {
    const checkConsent = async () => {
      try {
        const sessionId = localStorage.getItem("consent-session-id")
        if (sessionId) {
          const consent = await findConsentBySessionId(sessionId)
          if (consent && consent.accepted) {
            setPermissionsGranted(consent.permissions)
            checkExistingSession()
            return
          }
        }
      } catch (error) {
        console.error("Error checking consent:", error)
      }

      setConsentStartTime(Date.now())
      setShowConsentDialog(true)
      setCurrentPage("consent")
    }

    checkConsent()
  }, [])

  useEffect(() => {
    if (currentPage === "auth") {
      setSecurityChallenge(generateSecurityChallenge())
    }
  }, [currentPage, authMode])

  // Consent Dialog
  if (showConsentDialog || currentPage === "consent") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-2 border-blue-500 shadow-2xl">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="h-12 w-12 text-blue-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">Access Required</CardTitle>
            <p className="text-gray-600 mt-2">This application requires certain permissions to function properly.</p>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Are you sure you want to continue to this site?
              </h3>
              <p className="text-sm text-blue-700">
                By continuing, you agree to our terms and allow necessary functionality.
              </p>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <h4 className="font-semibold text-yellow-800">Important Instructions</h4>
              </div>
              <div className="text-sm text-yellow-700 space-y-2">
                <p>
                  <strong>When your browser asks for permissions:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    For Camera: Select <strong>"Use your cameras"</strong> and{" "}
                    <strong>"Allow while visiting the site"</strong>
                  </li>
                  <li>
                    For Location: Select <strong>"Allow while visiting the site"</strong>
                  </li>
                  <li>
                    <span className="text-red-600 font-semibold">Never select "Allow this time" or "Never allow"</span>
                  </li>
                </ul>
                <p className="text-xs mt-2 text-yellow-600">
                  ⚠️ Selecting the wrong options will block your access to this application.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={handleConsentDecline}
                variant="outline"
                className="flex-1 border-red-300 text-red-700 hover:bg-red-50 bg-transparent"
                disabled={isProcessingConsent}
              >
                <XCircle className="h-4 w-4 mr-2" />
                No, Exit
              </Button>
              <Button
                onClick={handleConsentAccept}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={isProcessingConsent}
              >
                {isProcessingConsent ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Requesting Permissions...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Yes, Continue
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-gray-500">This decision will be remembered for your current session.</p>
          </CardContent>
        </Card>
        <Toaster position="top-right" />
      </div>
    )
  }

  // Blocked Page
  if (currentPage === "blocked") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 to-black flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-2 border-red-500 shadow-2xl">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <XCircle className="h-12 w-12 text-red-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-red-800">Access Blocked</CardTitle>
            <p className="text-red-600 mt-2">Required permissions were not granted correctly.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="text-lg font-semibold text-red-900 mb-3">What went wrong?</h3>
              <div className="text-sm text-red-700 space-y-2">
                <p>You may have selected one of these incorrect options:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    <strong>"Allow this time"</strong> - This gives temporary access only
                  </li>
                  <li>
                    <strong>"Never allow"</strong> - This blocks access permanently
                  </li>
                </ul>
              </div>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-lg font-semibold text-green-900 mb-3">How to fix this:</h3>
              <div className="text-sm text-green-700 space-y-2">
                <p>
                  <strong>1. Refresh this page</strong>
                </p>
                <p>
                  <strong>2. When browser asks for permissions, select:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    Camera: <strong>"Use your cameras"</strong> + <strong>"Allow while visiting the site"</strong>
                  </li>
                  <li>
                    Location: <strong>"Allow while visiting the site"</strong>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => window.location.reload()} className="flex-1 bg-blue-600 hover:bg-blue-700">
                🔄 Refresh & Try Again
              </Button>
              <Button
                onClick={() => window.close()}
                variant="outline"
                className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
              >
                ❌ Close Tab
              </Button>
            </div>
          </CardContent>
        </Card>
        <Toaster position="top-right" />
      </div>
    )
  }

  // Auth Page
  if (currentPage === "auth") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <CardTitle className="text-2xl font-bold">Password Manager</CardTitle>
            </div>
            <p className="text-gray-600">Ultra-secure password management</p>
          </CardHeader>
          <CardContent>
            <Tabs value={authMode} onValueChange={(value) => setAuthMode(value as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
                <TabsTrigger value="reset">Reset</TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login" className="space-y-4">
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email"
                  />
                </div>
                <div>
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showLoginPassword ? "text" : "password"}
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Enter your password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                    >
                      {showLoginPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800">Security Challenge</span>
                  </div>
                  <p className="text-sm text-yellow-700 mb-2">{securityChallenge}</p>
                  <Input
                    value={loginForm.securityAnswer}
                    onChange={(e) => setLoginForm((prev) => ({ ...prev, securityAnswer: e.target.value }))}
                    placeholder="Enter your answer"
                    className="bg-white"
                  />
                </div>
                <Button onClick={handleLogin} className="w-full">
                  Login
                </Button>
                {loginAttempts > 0 && (
                  <p className="text-sm text-red-600 text-center">Failed attempts: {loginAttempts}</p>
                )}
              </TabsContent>

              {/* Signup Tab */}
              <TabsContent value="signup" className="space-y-4">
                <div>
                  <Label htmlFor="signup-username">Username</Label>
                  <Input
                    id="signup-username"
                    value={signupForm.username}
                    onChange={(e) => setSignupForm((prev) => ({ ...prev, username: e.target.value }))}
                    placeholder="Enter your username"
                  />
                </div>
                <div>
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signupForm.email}
                    onChange={(e) => setSignupForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email"
                  />
                </div>
                <div>
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showSignupPassword ? "text" : "password"}
                      value={signupForm.password}
                      onChange={(e) => setSignupForm((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Enter your password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                    >
                      {showSignupPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                    <strong>Password Requirements:</strong>
                    <ul className="mt-1 space-y-1">
                      <li>• At least 12 characters long</li>
                      <li>• Contains uppercase and lowercase letters</li>
                      <li>• Contains numbers and special characters</li>
                      <li>• No repeated characters</li>
                    </ul>
                  </div>
                </div>
                <div>
                  <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-confirm-password"
                      type={showSignupConfirmPassword ? "text" : "password"}
                      value={signupForm.confirmPassword}
                      onChange={(e) => setSignupForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm your password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                    >
                      {showSignupConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button onClick={handleSignup} className="w-full">
                  Create Account
                </Button>
              </TabsContent>

              {/* Reset Tab */}
              <TabsContent value="reset" className="space-y-4">
                <div>
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={resetForm.email}
                    onChange={(e) => setResetForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email"
                  />
                </div>
                <Button className="w-full">Send Reset Token</Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <Toaster position="top-right" />
      </div>
    )
  }

  // Main Password Manager Page
  if (currentPage === "main" && currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Password Manager</h1>
                <p className="text-sm text-gray-600">Welcome back, {currentUser.username}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Notifications Bell */}
              <Button variant="ghost" onClick={() => setCurrentPage("notifications")} className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-blue-500 text-white">
                        {currentUser.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuItem onClick={() => setCurrentPage("profile")}>
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <div className="p-4">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Passwords</h2>
              <p className="text-gray-600">Securely store and manage your passwords</p>
            </div>

            {/* Search and Create Section */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by email or description..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPageNum(1)
                  }}
                  className="pl-10"
                />
              </div>

              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Password
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Password</DialogTitle>
                    <DialogDescription>
                      Create a new password entry. Your data is securely stored in the database.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="create-email">Email/Username</Label>
                      <Input
                        id="create-email"
                        value={formData.email}
                        onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="Enter email or username"
                      />
                    </div>
                    <div>
                      <Label htmlFor="create-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="create-password"
                          type={createPasswordVisible ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                          placeholder="Enter password"
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setCreatePasswordVisible(!createPasswordVisible)}
                        >
                          {createPasswordVisible ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="create-description">Description</Label>
                      <Textarea
                        id="create-description"
                        value={formData.description}
                        onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter description (optional)"
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={clearForm}>
                      Clear Form
                    </Button>
                    <Button onClick={handleCreateEntry}>Create Entry</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Entries List */}
            <div className="space-y-4 mb-6">
              {paginatedEntries.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <div className="text-gray-500">
                      {searchQuery
                        ? "No entries found matching your search."
                        : "No password entries yet. Create your first one!"}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                paginatedEntries.map((entry) => (
                  <Card key={entry.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900 truncate">{entry.email}</h3>
                            <Badge variant="secondary" className="text-xs">
                              {new Date(entry.createdAt).toLocaleDateString()}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <Input
                                type={visiblePasswords.has(entry.id) ? "text" : "password"}
                                value={entry.password}
                                readOnly
                                className="w-32 sm:w-48 text-sm"
                              />
                              <Button variant="ghost" size="sm" onClick={() => togglePasswordVisibility(entry.id)}>
                                {visiblePasswords.has(entry.id) ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>

                          {entry.description && (
                            <p className="text-sm text-gray-600 truncate">{truncateText(entry.description)}</p>
                          )}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openViewDialog(entry)}>
                              <Info className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(entry)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDeleteDialog(entry)} className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Pagination */}
            {filteredEntries.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Show:</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value))
                      setCurrentPageNum(1)
                    }}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option.toString()}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-gray-600">of {filteredEntries.length} entries</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPageNum((prev) => Math.max(1, prev - 1))}
                    disabled={currentPageNum === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {currentPageNum} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPageNum((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPageNum === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dialogs */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Password Entry</DialogTitle>
              <DialogDescription>Update your password entry details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-email">Email/Username</Label>
                <Input
                  id="edit-email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email or username"
                />
              </div>
              <div>
                <Label htmlFor="edit-password">Password</Label>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={editPasswordVisible ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setEditPasswordVisible(!editPasswordVisible)}
                  >
                    {editPasswordVisible ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description (optional)"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditEntry}>Update Entry</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Password Details</DialogTitle>
            </DialogHeader>
            {selectedEntry && (
              <div className="space-y-4">
                <div>
                  <Label>Email/Username</Label>
                  <div className="mt-1 p-2 bg-gray-50 rounded border">{selectedEntry.email}</div>
                </div>
                <div>
                  <Label>Password</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type={visiblePasswords.has(selectedEntry.id) ? "text" : "password"}
                      value={selectedEntry.password}
                      readOnly
                      className="bg-gray-50"
                    />
                    <Button variant="ghost" size="sm" onClick={() => togglePasswordVisibility(selectedEntry.id)}>
                      {visiblePasswords.has(selectedEntry.id) ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                {selectedEntry.description && (
                  <div>
                    <Label>Description</Label>
                    <div className="mt-1 p-2 bg-gray-50 rounded border whitespace-pre-wrap">
                      {selectedEntry.description}
                    </div>
                  </div>
                )}
                <div className="text-xs text-gray-500 space-y-1">
                  <div>Created: {new Date(selectedEntry.createdAt).toLocaleString()}</div>
                  <div>Updated: {new Date(selectedEntry.updatedAt).toLocaleString()}</div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setShowViewDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the password entry for{" "}
                <strong>{selectedEntry?.email}</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteEntry} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Toaster position="top-right" />
      </div>
    )
  }

  // Notifications Page
  if (currentPage === "notifications" && currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button variant="ghost" onClick={() => setCurrentPage("main")} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Password Manager
            </Button>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <Bell className="h-6 w-6" />
                    Security Notifications
                  </CardTitle>
                  <p className="text-gray-600">Monitor security events and suspicious activities</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleMarkAllNotificationsAsRead}>
                    Mark All Read
                  </Button>
                  <Badge variant="secondary">{unreadCount} unread</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No security notifications yet.</p>
                  <p className="text-sm text-gray-400">You'll be notified of any suspicious activities here.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notification) => (
                    <Card
                      key={notification.id}
                      className={`${!notification.read ? "border-l-4 border-l-blue-500" : ""}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={getSeverityColor(notification.severity)}>
                                {notification.severity.toUpperCase()}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {new Date(notification.timestamp).toLocaleString()}
                              </span>
                              {!notification.read && (
                                <Badge variant="secondary" className="text-xs">
                                  NEW
                                </Badge>
                              )}
                            </div>

                            <h3 className="font-semibold text-gray-900 mb-1">{notification.title}</h3>
                            <p className="text-gray-700 mb-3">{notification.message}</p>

                            {notification.attemptedEmail && (
                              <div className="mb-3">
                                <span className="text-sm font-medium text-gray-600">Attempted Email: </span>
                                <span className="text-sm text-gray-800">{notification.attemptedEmail}</span>
                              </div>
                            )}

                            {notification.failedAttempts && (
                              <div className="mb-3">
                                <span className="text-sm font-medium text-gray-600">Failed Attempts: </span>
                                <span className="text-sm text-red-600 font-semibold">
                                  {notification.failedAttempts}
                                </span>
                              </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg text-sm">
                              <div>
                                <div className="flex items-center gap-1 mb-1">
                                  <Monitor className="h-3 w-3 text-gray-500" />
                                  <span className="font-medium text-gray-600">Device Info</span>
                                </div>
                                <p className="text-gray-700 text-xs">Platform: {notification.deviceInfo.platform}</p>
                                <p className="text-gray-700 text-xs">Screen: {notification.deviceInfo.screen}</p>
                                <p className="text-gray-700 text-xs">Language: {notification.deviceInfo.language}</p>
                                <p className="text-gray-700 text-xs">Timezone: {notification.deviceInfo.timezone}</p>
                              </div>

                              {notification.locationInfo && (
                                <div>
                                  <div className="flex items-center gap-1 mb-1">
                                    <MapPin className="h-3 w-3 text-gray-500" />
                                    <span className="font-medium text-gray-600">Location Info</span>
                                  </div>
                                  <p className="text-gray-700 text-xs">IP: {notification.locationInfo.ip}</p>
                                  <p className="text-gray-700 text-xs">Country: {notification.locationInfo.country}</p>
                                  <p className="text-gray-700 text-xs">City: {notification.locationInfo.city}</p>
                                  {notification.locationInfo.latitude && notification.locationInfo.longitude && (
                                    <p className="text-gray-700 text-xs">
                                      Coords: {notification.locationInfo.latitude.toFixed(4)},{" "}
                                      {notification.locationInfo.longitude.toFixed(4)}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            {notification.screenshot && (
                              <div className="mt-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <Camera className="h-4 w-4 text-red-600" />
                                  <span className="text-sm font-medium text-red-800">Security Camera Capture</span>
                                </div>
                                <div className="border-2 border-red-200 rounded-lg p-2 bg-red-50">
                                  <img
                                    src={notification.screenshot || "/placeholder.svg"}
                                    alt="Security capture"
                                    className="max-w-full h-auto rounded border"
                                    style={{ maxHeight: "200px" }}
                                  />
                                  <p className="text-xs text-red-700 mt-2">
                                    ⚠️ This photo was automatically captured during the failed login attempt for security
                                    purposes.
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 ml-4">
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkNotificationAsRead(notification.id)}
                              >
                                Mark Read
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteNotification(notification.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <Toaster position="top-right" />
      </div>
    )
  }

  return null
}
