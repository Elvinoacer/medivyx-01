"use client"

import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAppStore } from "@/store/use-app-store"
import { assistantApi, type AssistantMessage } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { MessageCircle, X, Send, Loader2, Bot, ShieldCheck, Phone, Sparkles, ExternalLink } from "lucide-react"
import { PHARMACY, waLink } from "@/lib/constants"

const GREETING: AssistantMessage = {
  role: "assistant",
  content:
    "Karibu! 👋\n\nI'm Sphere Pharmacy's quick-answer assistant. Ask me about **hours, delivery, ordering, payments, or prescriptions**. For medication advice, I'll connect you with the pharmacy team instead.",
}

const QUICK_PROMPTS = [
  "What are your opening hours?",
  "How does ordering work?",
  "Do you deliver to Kasarani?",
  "How do I upload a prescription?",
]

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="assistant-markdown text-[13px] leading-6">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export function AssistantWidget() {
  const open = useAppStore((s) => s.assistantOpen)
  const setOpen = useAppStore((s) => s.setAssistantOpen)
  const [messages, setMessages] = useState<AssistantMessage[]>([GREETING])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
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
      setMessages((current) => [...current, { role: "assistant", content: res.reply, escalated: res.escalated }])
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `I’m having trouble right now. Please **WhatsApp or call us on ${PHARMACY.phoneDisplay}** and our pharmacy team will help you.`,
          escalated: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(!open)}
        size="icon"
        className={cn(
          "fixed bottom-24 right-4 z-[70] h-14 w-14 rounded-full bg-primary shadow-[0_12px_30px_-12px_hsl(var(--primary))] ring-4 ring-background/80 transition-transform hover:scale-105 md:bottom-6 md:right-6",
          open && "hidden"
        )}
        aria-label="Open Sphere Pharmacy AI assistant"
      >
        <MessageCircle className="h-6 w-6" />
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-emerald-400 text-[10px] font-bold text-emerald-950">AI</span>
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-label="Sphere Pharmacy AI assistant"
          className="fixed inset-x-3 bottom-24 z-[70] flex max-h-[78vh] flex-col overflow-hidden rounded-[26px] border border-border/80 bg-background/95 shadow-2xl backdrop-blur-xl md:bottom-6 md:right-6 md:left-auto md:w-[405px]"
        >
          <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-primary via-primary to-emerald-800 px-4 pb-4 pt-4 text-primary-foreground">
            <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                <Bot className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Sphere AI Assistant</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-2 py-0.5 text-[10px] font-medium ring-1 ring-white/15">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Online
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-primary-foreground/75">Quick answers for pharmacy service questions.</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-full p-2 transition-colors hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative mt-3 flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2 text-[11px] text-primary-foreground/80 ring-1 ring-white/10">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>No account, prescription, payment or private-record data is exposed to the AI.</span>
            </div>
          </div>

          <div ref={scrollRef} className="scroll-slim flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message, index) => {
              const user = message.role === "user"
              return (
                <div key={index} className={cn("flex", user ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[87%] rounded-2xl px-3.5 py-3 shadow-sm",
                      user
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md border border-border/70 bg-muted/65 text-foreground"
                    )}
                  >
                    {user ? <p className="whitespace-pre-wrap text-[13px] leading-5">{message.content}</p> : <MarkdownMessage content={message.content} />}
                    {message.escalated ? (
                      <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-50/80 px-2.5 py-2 text-[11px] text-amber-900 dark:border-amber-500/20 dark:bg-amber-950/40 dark:text-amber-100">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1">A pharmacy team member is the right person for this.</span>
                      </div>
                    ) : null}
                    {message.escalated ? (
                      <div className="mt-2 flex gap-2">
                        <a href={waLink("Hi Sphere Pharmacy, I need help from the pharmacy team.")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-medium hover:bg-background">
                          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                        </a>
                        <a href={`tel:${PHARMACY.phone}`} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-medium hover:bg-background">
                          <Phone className="h-3.5 w-3.5" /> Call
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}

            {loading ? (
              <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </span>
              </div>
            ) : null}

            {messages.length <= 1 ? (
              <div className="pt-1">
                <p className="mb-2 flex items-center gap-1 text-[11px] font-medium text-muted-foreground"><Sparkles className="h-3 w-3" /> Try a quick question</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => send(prompt)}
                      className="rounded-full border bg-background px-3 py-1.5 text-left text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-border/80 bg-background/90 p-3">
            <div className="rounded-2xl border border-border bg-muted/30 p-2 focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
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
                  placeholder="Ask about delivery, ordering, hours…"
                  className="max-h-28 min-h-[42px] resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
                  rows={1}
                  aria-label="Message Sphere AI Assistant"
                />
                <Button size="icon" className="h-10 w-10 shrink-0 rounded-xl" onClick={() => send(input)} disabled={!input.trim() || loading} aria-label="Send message">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> General service info only.</span>
              <a href={waLink("Hi Sphere Pharmacy, I'd rather chat on WhatsApp.")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary">
                Prefer WhatsApp?
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
