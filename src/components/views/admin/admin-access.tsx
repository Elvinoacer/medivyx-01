import type { ReactNode } from "react"
import { ShieldCheck } from "lucide-react"
import { LogoFull } from "@/components/shared/logo"

/** Shared welcome layout for staff sign-in and the admin access gate. */
export function AdminAccessFrame({ children }: { children: ReactNode }) {
  return (
    <div className="admin-gate-wrap">
      <div className="admin-gate-intro">
        <LogoFull dark />
        <span>YOUR PHARMACY, CONNECTED</span>
        <h1>Good care starts<br />behind the scenes.</h1>
        <p>One thoughtful workspace for your team, your patients and everything in between.</p>
        <div><ShieldCheck className="h-4 w-4" aria-hidden /> Medivyx · Staff access</div>
      </div>
      <div className="admin-gate-panel">{children}</div>
    </div>
  )
}
