"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAppStore } from "@/store/use-app-store"
import { assistantApi, type AssistantMessage } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { MessageCircle, X, Send, Loader2, Bot, ShieldAlert, Phone } from "lucide-react"
import { PHARMACY } from "@/lib/constants"

const GREETING: AssistantMessage = {
  role: "assistant",
  content:
    "Karibu! I'm the Sphere Pharmacy assistant. I can help with hours, location, how ordering works, delivery fees and general questions. For medication or dosage questions I'll connect you to our pharmacy team — they're the right people for that.",
}

const QUICK_PROMPTS = [
  "What are your opening hours?",
  "How does ordering work?",
  "Do you deliver to Kasarani?",
  "How do I order a prescription item?",
]

export function AssistantWidget() {
  const open = useAppStore((s) => s.assistantOpen)
  const setOpen = useAppStore((s) => s.setAssistantOpen)
  const [messages, setMessages] = useState<AssistantMessage[]>([GREETING])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open])

  async function send(text: string) {
    const content = text.trim()
    if (!content || loading) return
    const next: AssistantMessage[] = [...messages, { role: "user", content }]
    setMessages(next)
    setInput("")
    setLoading(true)
    try {
      const res = await assistantApi.chat(next)
      setMessages((m) => [...m, { role: "assistant", content: res.reply, escalated: res.escalated }])
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Sorry — I'm having trouble right now. Please WhatsApp or call us on ${PHARMACY.phoneDisplay} and we'll help you directly.`,
          escalated: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* floating button */}
      <Button
        onClick={() => setOpen(!open)}
        size="icon"
        className={cn(
          "fab-glow fixed bottom-24 right-4 z-50 h-12 w-12 rounded-full md:bottom-6",
          open && "hidden"
        )}
        aria-label="Open pharmacy assistant chat"
      >
        <MessageCircle className="h-5 w-5" />
      </Button>

      {/* chat panel */}
      {open ? (
        <div
          role="dialog"
          aria-label="Pharmacy assistant"
          className="fixed inset-x-3 bottom-24 z-50 flex max-h-[75vh] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl md:inset-x-auto md:bottom-6 md:right-6 md:w-96"
        >
          {/* header */}
          <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/15">
              <Bot className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-tight">Sphere Assistant</p>
              <p className="text-[11px] opacity-80">General questions · escalates medical queries</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-full p-1.5 hover:bg-primary-foreground/15">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* messages */}
          <div ref={scrollRef} className="scroll-slim flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-muted"
                  )}
                >
                  {m.content}
                  {m.escalated ? (
                    <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-100 px-2 py-1.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Medication question — talk to our team:
                      <a href={`https://wa.me/${PHARMACY.whatsapp}`} target="_blank" rel="noopener noreferrer" className="underline">
                        WhatsApp
                      </a>
                      <span>·</span>
                      <a href={`tel:${PHARMACY.phone}`} className="underline">
                        Call
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Assistant is typing…
              </div>
            ) : null}

            {/* quick prompts */}
            {messages.length <= 1 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="rounded-full border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* input */}
          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    send(input)
                  }
                }}
                placeholder="Ask about hours, delivery, ordering…"
                className="max-h-24 min-h-[44px] flex-1 resize-none text-sm"
                rows={1}
                aria-label="Message the assistant"
              />
              <Button size="icon" className="h-10 w-10 shrink-0" onClick={() => send(input)} disabled={!input.trim() || loading} aria-label="Send message">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Phone className="h-3 w-3" /> For medical/dosage questions we&apos;ll connect you to the pharmacy team.
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}
