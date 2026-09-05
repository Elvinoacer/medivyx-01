"use client"
import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { notificationsApi } from "@/lib/api-client"
import type { NotificationDTO } from "@/lib/types"
import { useAuthStore } from "@/store/use-auth-store"

export function NotificationCenter() {
  const session = useAuthStore(s => s.session)
  const owner = session?.user?.id || session?.staff?.id
  return owner ? <Inbox key={owner} /> : null
}
function Inbox() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationDTO[]>([])
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    const refresh = async () => {
      if (document.visibilityState !== "visible") return
      try { const rows = await notificationsApi.list(); if (active) { setItems(rows); setError("") } }
      catch { if (active) setError("Updates couldn’t load. Please try again.") }
    }
    void refresh()
    const timer = setInterval(refresh, 60_000)
    const onPush = (event: MessageEvent) => { if (event.data?.type === "PUSH_NOTIFICATION") void refresh() }
    document.addEventListener("visibilitychange", refresh)
    navigator.serviceWorker?.addEventListener("message", onPush)
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", refresh); navigator.serviceWorker?.removeEventListener("message", onPush) }
  }, [open, revision])
  const unread = items.filter(item => !item.read).length
  async function view(item: NotificationDTO) {
    try {
      await notificationsApi.markRead(item.id)
      setItems(rows => rows.map(row => row.id === item.id ? { ...row, read: true } : row))
      const metadata = JSON.parse(item.metadata || "{}")
      const url = new URL(metadata.link || "/account", window.location.origin)
      if (url.origin === window.location.origin) window.location.assign(url.href)
    } catch { setError("Couldn’t open this update. Please try again.") }
  }
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
      <Bell size={20} />{unread > 0 && <span className="absolute right-0 top-0 rounded-full bg-emerald-900 px-1.5 text-xs text-white">{unread > 99 ? "99+" : unread}</span>}
    </button></DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>Your updates</DialogTitle><DialogDescription>Orders, payments, appointments, and pharmacy updates.</DialogDescription></DialogHeader>
      {error ? <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => setRevision(n => n + 1)}>Retry</Button></div> : null}
      {!items.length && !error ? <p className="py-8 text-center text-sm text-muted-foreground">You’re all caught up. New updates will appear here.</p> : null}
      <ul className="space-y-2">{items.map(item => <li key={item.id}><button onClick={() => void view(item)} className={`w-full rounded-xl border p-4 text-left focus-visible:outline-2 ${item.read ? "bg-background" : "border-emerald-300 bg-emerald-50 text-emerald-950"}`}>
        <p className="text-sm font-semibold">{!item.read ? "• " : ""}{item.title}</p><p className="mt-1 text-sm">{item.message}</p>
        <time className="mt-2 block text-xs" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
      </button></li>)}</ul>
    </DialogContent>
  </Dialog>
}
