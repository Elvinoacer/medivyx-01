import { cookies } from "next/headers"
import { db } from "@/lib/db"
import { newSessionToken } from "@/lib/hash"
import type { Role } from "@/lib/constants"
import type { SessionPayload, StaffDTO, UserDTO } from "@/lib/types"

const COOKIE_NAME = "sphere_session"
const SESSION_DAYS = 30

export interface ResolvedSession {
  sessionId: string
  role: Role | "CUSTOMER"
  userId: string | null
  staffId: string | null
  staffName: string | null
  staffRole: Role | null
  user: UserDTO | null
}

/** Read the current session from the cookie. Returns null if none/expired. */
export async function getSession(): Promise<ResolvedSession | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (!token) return null
  const session = await db.session.findUnique({ where: { token }, include: { user: true, staff: true } })
  if (!session || session.expiresAt < new Date()) return null
  return {
    sessionId: session.id,
    role: session.role as Role | "CUSTOMER",
    userId: session.userId,
    staffId: session.staffId,
    staffName: session.staff?.name ?? null,
    staffRole: (session.staff?.role as Role) ?? null,
    user: session.user ? toUserDTO(session.user) : null,
  }
}

/** Create a session for a customer or staff user and set the cookie. */
export async function createSession(
  target: { userId: string } | { staffId: string }
): Promise<void> {
  const role = "userId" in target ? "CUSTOMER" : ((await db.staffUser.findUnique({ where: { id: (target as { staffId: string }).staffId } }))?.role ?? "STAFF")
  const token = newSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000)
  await db.session.create({ data: { token, role, expiresAt, ...(target as { userId?: string; staffId?: string }) } })
  const jar = await cookies()
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  })
}

export async function destroySession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (token) {
    await db.session.deleteMany({ where: { token } })
  }
  jar.delete(COOKIE_NAME)
}

// ---------- Payload builders ----------

export function toUserDTO(user: { id: string; name: string | null; phone: string | null; email: string | null; avatar?: string | null; createdAt: Date; loyaltyPoints: number }): UserDTO {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    avatar: user.avatar ?? null,
    createdAt: user.createdAt.toISOString(),
    loyaltyPoints: user.loyaltyPoints ?? 0,
  }
}

export function toStaffDTO(staff: {
  id: string; name: string; email: string; phone: string | null;
  role: string; title: string | null; avatar?: string | null; active: boolean; createdAt: Date;
}): StaffDTO {
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    phone: staff.phone,
    role: staff.role as Role,
    title: staff.title,
    avatar: staff.avatar ?? null,
    active: staff.active,
    createdAt: staff.createdAt.toISOString(),
  }
}

/** Build the SessionPayload returned by auth endpoints. */
export async function buildSessionPayload(session: ResolvedSession): Promise<SessionPayload> {
  if (session.userId) {
    const user = await db.user.findUnique({ where: { id: session.userId } })
    if (!user) return { role: "CUSTOMER" }
    return { role: "CUSTOMER", user: toUserDTO(user) }
  }
  if (session.staffId) {
    const staff = await db.staffUser.findUnique({ where: { id: session.staffId } })
    if (!staff) return { role: "STAFF" }
    return { role: staff.role as Role, staff: toStaffDTO(staff) }
  }
  return { role: "CUSTOMER" }
}

// ---------- Guards (return Response on failure, null on success) ----------

export async function requireCustomer(): Promise<{ session: ResolvedSession; error: null } | { session: null; error: Response }> {
  const session = await getSession()
  if (!session || session.role !== "CUSTOMER" || !session.userId) {
    return { session: null, error: Response.json({ error: "Please sign in to your account to continue." }, { status: 401 }) }
  }
  return { session, error: null }
}

export async function requireStaff(roles?: Role[]): Promise<{ session: ResolvedSession; error: null } | { session: null; error: Response }> {
  const session = await getSession()
  if (!session || !session.staffId) {
    return { session: null, error: Response.json({ error: "Staff sign-in required." }, { status: 401 }) }
  }
  if (roles && (!session.staffRole || !roles.includes(session.staffRole))) {
    return { session: null, error: Response.json({ error: "You do not have permission to perform this action." }, { status: 403 }) }
  }
  return { session, error: null }
}

export async function requireAuth(): Promise<{ session: ResolvedSession; error: null } | { session: null; error: Response }> {
  const session = await getSession()
  if (!session) {
    return { session: null, error: Response.json({ error: "Please sign in to continue." }, { status: 401 }) }
  }
  return { session, error: null }
}
