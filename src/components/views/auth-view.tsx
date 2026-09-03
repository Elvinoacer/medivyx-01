"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
import { Toaster } from "@/components/ui/sonner"
import { LogoMark } from "@/components/shared/logo"
import { useAppStore, type AuthMode } from "@/store/use-app-store"
import { useAuthStore } from "@/store/use-auth-store"
import { authApi } from "@/lib/api-client"
import type { SessionPayload } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Loader2, LogIn, UserPlus, Smartphone, Stethoscope, Eye, EyeOff, Info,
  TriangleAlert, ArrowRight, Lock, Mail, Phone, User,
} from "lucide-react"

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`
  if (/^254[17]\d{8}$/.test(digits)) return digits
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`
  return null
}

const STAFF_DEMOS = [
  { role: "Admin", email: "admin@spherepharmacy.co.ke", password: "admin123" },
  { role: "Pharmacist", email: "pharmacist@spherepharmacy.co.ke", password: "pharm123" },
  { role: "Staff", email: "staff@spherepharmacy.co.ke", password: "staff123" },
  { role: "Rider", email: "rider@spherepharmacy.co.ke", password: "rider123" },
]

// ============================== VIEW ==============================

export function AuthView() {
  const authMode = useAppStore((s) => s.authMode)
  const setAuthMode = useAppStore((s) => s.setAuthMode)
  const authNext = useAppStore((s) => s.authNext)
  const authNextParams = useAppStore((s) => s.authNextParams)
  const authMessage = useAppStore((s) => s.authMessage)
  const navigate = useAppStore((s) => s.navigate)
  const replace = useAppStore((s) => s.replace)
  const clearAuthIntent = useAppStore((s) => s.clearAuthIntent)
  const setSession = useAuthStore((s) => s.setSession)
  const refresh = useAuthStore((s) => s.refresh)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // sync mode from navigation params (e.g. openAuth("staff") via merged app store)
  const params = useAppStore((s) => s.params)
  useEffect(() => {
    const m = params.mode
    if (m === "login" || m === "register" || m === "otp" || m === "staff") {
      setAuthMode(m)
    }
  }, [params.mode])

  // login
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")

  // register
  const [regName, setRegName] = useState("")
  const [regPhone, setRegPhone] = useState("")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")

  // otp
  const [otpPhone, setOtpPhone] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [demoCode, setDemoCode] = useState<string | null>(null)
  const [otpCode, setOtpCode] = useState("")
  const [otpName, setOtpName] = useState("")

  // staff
  const [staffEmail, setStaffEmail] = useState("")
  const [staffPassword, setStaffPassword] = useState("")

  async function finishAuth(session: SessionPayload, staff = false) {
    setSession(session)
    void refresh()
    if (staff) {
      toast.success(`Welcome back, ${session.staff?.name ?? "team member"}!`)
      navigate("admin")
    } else {
      toast.success(`Welcome back, ${session.user?.name ?? "friend"}!`)
      replace(authNext ?? "account", authNextParams ?? undefined)
      clearAuthIntent()
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!identifier.trim() || !password) {
      setError("Enter your email/phone and password.")
      return
    }
    setError(null)
    setLoading(true)
    try {
      const session = await authApi.login(identifier.trim(), password)
      await finishAuth(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed — please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (regName.trim().length < 2) return setError("Enter your full name.")
    if (!normalizePhone(regPhone)) return setError("Enter a valid Kenyan phone number, e.g. 0712 345 678.")
    if (regEmail.trim() && !/^\S+@\S+\.\S+$/.test(regEmail.trim())) return setError("Enter a valid email address.")
    if (regPassword.length < 6) return setError("Choose a password with at least 6 characters.")
    setError(null)
    setLoading(true)
    try {
      const session = await authApi.register({
        name: regName.trim(),
        phone: normalizePhone(regPhone) ?? regPhone.trim(),
        ...(regEmail.trim() ? { email: regEmail.trim().toLowerCase() } : {}),
        password: regPassword,
      })
      toast.success("Account created — karibu Sphere Pharmacy!")
      setSession(session)
      void refresh()
      replace(authNext ?? "account", authNextParams ?? undefined)
      clearAuthIntent()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed — please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleOtpRequest(e: React.FormEvent) {
    e.preventDefault()
    const phone = normalizePhone(otpPhone)
    if (!phone) return setError("Enter a valid Kenyan phone number, e.g. 0712 345 678.")
    setError(null)
    setLoading(true)
    try {
      const res = await authApi.otpRequest(phone)
      setDemoCode(res.demoCode)
      setOtpSent(true)
      toast.success("Verification code sent (demo)")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the code — try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleOtpVerify(e: React.FormEvent) {
    e.preventDefault()
    const phone = normalizePhone(otpPhone)
    if (!phone || otpCode.length !== 6) return setError("Enter the 6-digit code we sent you.")
    setError(null)
    setLoading(true)
    try {
      const session = await authApi.otpVerify(phone, otpCode, otpName.trim() || undefined)
      toast.success("Verified — welcome!")
      await finishAuth(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed — check the code and try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!staffEmail.trim() || !staffPassword) return setError("Enter your staff email and password.")
    setError(null)
    setLoading(true)
    try {
      const session = await authApi.staffLogin(staffEmail.trim().toLowerCase(), staffPassword)
      await finishAuth(session, true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Staff login failed — check your credentials.")
    } finally {
      setLoading(false)
    }
  }

  const passwordInput = (props: {
    id: string
    value: string
    onChange: (v: string) => void
    label: string
    autoComplete?: string
  }) => (
    <div className="space-y-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id={props.id}
          type={showPassword ? "text" : "password"}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="pl-9 pr-10"
          autoComplete={props.autoComplete ?? "current-password"}
          required
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )

  return (
    <div className="app-page app-page-auth gradient-hero min-h-[calc(100vh-8rem)] px-4 py-10">
      <Toaster position="bottom-left" richColors closeButton />

      <div className="mx-auto max-w-md">
        {/* brand */}
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <LogoMark size={30} className="text-primary-foreground" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {authMode === "staff" ? "Staff sign-in" : "Welcome to Sphere Pharmacy"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {authMode === "staff"
              ? "Internal access — orders, prescriptions and inventory."
              : "Order medicines, track prescriptions and keep your history in one place."}
          </p>
        </div>

        <Card className="border-shadow-sm shadow-lg shadow-primary/5">
          <CardContent className="p-5 sm:p-7">
            {authMessage ? (
              <Alert className="mb-5 border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 [&>svg]:text-amber-600">
                <Info className="h-4 w-4" />
                <AlertDescription className="font-medium">{authMessage}</AlertDescription>
              </Alert>
            ) : null}

            {error ? (
              <Alert variant="destructive" className="mb-5" role="alert">
                <TriangleAlert className="h-4 w-4" />
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Tabs value={authMode} onValueChange={(v) => { setAuthMode(v as AuthMode); setError(null) }}>
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4" aria-label="Sign-in method">
                <TabsTrigger value="login" className="gap-1.5 py-2 text-xs sm:text-sm">
                  <LogIn className="h-3.5 w-3.5" /> Sign in
                </TabsTrigger>
                <TabsTrigger value="register" className="gap-1.5 py-2 text-xs sm:text-sm">
                  <UserPlus className="h-3.5 w-3.5" /> Register
                </TabsTrigger>
                <TabsTrigger value="otp" className="gap-1.5 py-2 text-xs sm:text-sm">
                  <Smartphone className="h-3.5 w-3.5" /> Phone OTP
                </TabsTrigger>
                <TabsTrigger value="staff" className="gap-1.5 py-2 text-xs sm:text-sm">
                  <Stethoscope className="h-3.5 w-3.5" /> Staff
                </TabsTrigger>
              </TabsList>

              {/* ---------------- LOGIN ---------------- */}
              <TabsContent value="login" className="mt-5">
                <form onSubmit={handleLogin} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="login-identifier">Email or phone number</Label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        id="login-identifier"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="customer@spherepharmacy.co.ke"
                        className="pl-9"
                        autoComplete="username"
                      />
                    </div>
                  </div>
                  {passwordInput({ id: "login-password", value: password, onChange: setPassword, label: "Password" })}
                  <Button type="submit" size="lg" className="h-12 w-full gap-2 rounded-full text-base" disabled={loading}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <LogIn className="h-5 w-5" aria-hidden />}
                    {loading ? "Signing you in…" : "Sign in"}
                  </Button>
                </form>
                <DemoHint
                  lines={[
                    ["Demo customer", "customer@spherepharmacy.co.ke"],
                    ["Password", "customer123"],
                  ]}
                />
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  New here?{" "}
                  <button type="button" onClick={() => setAuthMode("register")} className="font-semibold text-primary hover:underline">
                    Create an account
                  </button>{" "}
                  or{" "}
                  <button type="button" onClick={() => setAuthMode("otp")} className="font-semibold text-primary hover:underline">
                    sign in with your phone
                  </button>
                  .
                </p>
              </TabsContent>

              {/* ---------------- REGISTER ---------------- */}
              <TabsContent value="register" className="mt-5">
                <form onSubmit={handleRegister} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Full name</Label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        id="reg-name"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="e.g. Amina Yusuf"
                        className="pl-9"
                        autoComplete="name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-phone">Phone number</Label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        id="reg-phone"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="0712 345 678"
                        className="pl-9"
                        inputMode="tel"
                        autoComplete="tel"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Used for order updates and M-Pesa payments.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email (optional)</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        id="reg-email"
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="pl-9"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  {passwordInput({ id: "reg-password", value: regPassword, onChange: setRegPassword, label: "Choose a password", autoComplete: "new-password" })}
                  <Button type="submit" size="lg" className="h-12 w-full gap-2 rounded-full text-base" disabled={loading}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <UserPlus className="h-5 w-5" aria-hidden />}
                    {loading ? "Creating account…" : "Create account"}
                  </Button>
                </form>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Already have an account?{" "}
                  <button type="button" onClick={() => setAuthMode("login")} className="font-semibold text-primary hover:underline">
                    Sign in
                  </button>
                </p>
              </TabsContent>

              {/* ---------------- OTP ---------------- */}
              <TabsContent value="otp" className="mt-5">
                {!otpSent ? (
                  <form onSubmit={handleOtpRequest} className="space-y-4" noValidate>
                    <div className="space-y-2">
                      <Label htmlFor="otp-phone">Phone number</Label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Input
                          id="otp-phone"
                          value={otpPhone}
                          onChange={(e) => setOtpPhone(e.target.value)}
                          placeholder="0712 345 678"
                          className="h-12 pl-9 text-base"
                          inputMode="tel"
                          autoComplete="tel"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">We&apos;ll text you a 6-digit verification code.</p>
                    </div>
                    <Button type="submit" size="lg" className="h-12 w-full gap-2 rounded-full text-base" disabled={loading}>
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Smartphone className="h-5 w-5" aria-hidden />}
                      {loading ? "Sending code…" : "Send code"}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleOtpVerify} className="space-y-5" noValidate>
                    {demoCode ? (
                      <Alert className="border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-200 [&>svg]:text-teal-600">
                        <Smartphone className="h-4 w-4" />
                        <AlertTitle>Demo code</AlertTitle>
                        <AlertDescription>
                          This is a demo environment, so here&apos;s your code up front:{" "}
                          <span className="font-mono text-base font-bold tracking-[0.2em]">{demoCode}</span>
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    <div className="flex flex-col items-center gap-2">
                      <Label htmlFor="otp-code" className="text-sm font-semibold">
                        Enter the 6-digit code
                      </Label>
                      <InputOTP id="otp-code" maxLength={6} value={otpCode} onChange={setOtpCode} disabled={loading}>
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSeparator />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSeparator />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                      <p className="text-xs text-muted-foreground">
                        Sent to {otpPhone}
                        {" · "}
                        <button
                          type="button"
                          onClick={() => { setOtpSent(false); setDemoCode(null); setOtpCode("") }}
                          className="font-semibold text-primary hover:underline"
                        >
                          change number
                        </button>
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="otp-name">Your name (new customers)</Label>
                      <Input
                        id="otp-name"
                        value={otpName}
                        onChange={(e) => setOtpName(e.target.value)}
                        placeholder="e.g. Amina Yusuf"
                        autoComplete="name"
                      />
                    </div>

                    <Button type="submit" size="lg" className="h-12 w-full gap-2 rounded-full text-base" disabled={loading || otpCode.length !== 6}>
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <ArrowRight className="h-5 w-5" aria-hidden />}
                      {loading ? "Verifying…" : "Verify & continue"}
                    </Button>
                  </form>
                )}
              </TabsContent>

              {/* ---------------- STAFF ---------------- */}
              <TabsContent value="staff" className="mt-5">
                <form onSubmit={handleStaffLogin} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="staff-email">Staff email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        id="staff-email"
                        type="email"
                        value={staffEmail}
                        onChange={(e) => setStaffEmail(e.target.value)}
                        placeholder="pharmacist@spherepharmacy.co.ke"
                        className="pl-9"
                        autoComplete="username"
                      />
                    </div>
                  </div>
                  {passwordInput({ id: "staff-password", value: staffPassword, onChange: setStaffPassword, label: "Password" })}
                  <Button type="submit" size="lg" className="h-12 w-full gap-2 rounded-full text-base" disabled={loading}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Stethoscope className="h-5 w-5" aria-hidden />}
                    {loading ? "Signing in…" : "Sign in to dashboard"}
                  </Button>
                </form>
                <DemoHint
                  title="Demo staff accounts"
                  lines={STAFF_DEMOS.map((s) => [s.role, `${s.email} · ${s.password}`] as [string, string])}
                />
              </TabsContent>
            </Tabs>

            <div className="mt-6 border-t pt-5 text-center">
              <Button variant="ghost" className="gap-1.5 rounded-full" onClick={() => navigate("home")}>
                Continue as guest <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Guests can shop OTC products; an account is needed for prescriptions and order history.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DemoHint({ title, lines }: { title?: string; lines: [string, string][] }) {
  return (
    <div className={cn("mt-5 rounded-xl border border-dashed bg-muted/40 p-3.5")}>
      {title ? <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{title}</p> : null}
      <dl className="space-y-1.5 text-xs">
        {lines.map(([k, v]) => (
          <div key={k} className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="font-semibold text-muted-foreground">{k}</dt>
            <dd className="font-mono text-[11px]">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] text-muted-foreground">Demo environment — no real credentials required.</p>
    </div>
  )
}
