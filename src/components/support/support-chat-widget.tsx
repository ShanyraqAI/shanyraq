"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bot,
  CheckCircle2,
  Headphones,
  LoaderCircle,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

interface SupportChatWidgetProps {
  source: "LANDING" | "DASHBOARD";
  defaultName?: string;
  defaultContact?: string;
}

const CHAT_ID_KEY = "shanyraq-support-chat-id";
const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Здравствуйте! Я AI-помощник Shanyraq. Подскажу по возможностям сервиса, настройке и работе с разделами.",
};

const suggestions = [
  "Как начать работу?",
  "Как добавить бронирование?",
  "Какие каналы можно подключить?",
];

function createId(prefix: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

async function readError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error || "Что-то пошло не так. Попробуйте ещё раз.";
}

export function SupportChatWidget({
  source,
  defaultName = "",
  defaultContact = "",
}: SupportChatWidgetProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"chat" | "handoff" | "success">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [name, setName] = useState(defaultName);
  const [contact, setContact] = useState(defaultContact);
  const [supportMessage, setSupportMessage] = useState("");
  const [ticketReference, setTicketReference] = useState("");
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, mode]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function getChatId() {
    try {
      const existing = localStorage.getItem(CHAT_ID_KEY);
      if (existing) return existing;
      const id = createId("chat");
      localStorage.setItem(CHAT_ID_KEY, id);
      return id;
    } catch {
      return createId("chat");
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setError("");
    setInput("");
    setSending(true);

    const userMessage: ChatMessage = { id: createId("user"), role: "user", content: trimmed };
    const assistantId = createId("assistant");
    const conversation = [...messages, userMessage].slice(-20);
    setMessages([...conversation, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: getChatId(),
          messages: conversation.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok) throw new Error(await readError(response));
      if (!response.body) throw new Error("Не удалось открыть поток ответа.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      async function consumeStream(currentAnswer: string): Promise<string> {
        const { done, value } = await reader.read();
        if (done) return currentAnswer + decoder.decode();
        const nextAnswer = currentAnswer + decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, content: nextAnswer } : message,
          ),
        );
        return consumeStream(nextAnswer);
      }

      const answer = await consumeStream("");
      if (answer) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, content: answer } : message,
          ),
        );
      }
      if (!answer.trim()) throw new Error("AI-помощник не вернул ответ.");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Не удалось получить ответ.";
      setMessages((current) => current.filter((item) => item.id !== assistantId));
      setError(message);
    } finally {
      setSending(false);
    }
  }

  function submitChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function openHandoff() {
    const latestQuestion = [...messages].reverse().find((message) => message.role === "user");
    if (!supportMessage && latestQuestion) setSupportMessage(latestQuestion.content);
    setError("");
    setMode("handoff");
  }

  async function submitHandoff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");

    try {
      const response = await fetch("/api/support/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          sourcePath: pathname,
          name: name.trim() || undefined,
          contact: contact.trim(),
          message: supportMessage.trim(),
          transcript: messages
            .filter((message) => message.content.trim())
            .slice(-20)
            .map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok) throw new Error(await readError(response));
      const result = await response.json() as { reference: string };
      setTicketReference(result.reference);
      setMode("success");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось отправить обращение.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {open && (
        <section
          role="dialog"
          aria-label="Поддержка Shanyraq"
          className="absolute bottom-16 right-0 flex h-[min(620px,calc(100vh-6rem))] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl shadow-black/15"
        >
          <header className="flex items-center justify-between border-b bg-card px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="relative grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="size-5" aria-hidden="true" />
                <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">Помощник Shanyraq</p>
                <p className="text-xs text-muted-foreground">AI-консультант · обычно отвечает сразу</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 rounded-full"
              onClick={() => setOpen(false)}
              aria-label="Закрыть поддержку"
            >
              <X className="size-4" />
            </Button>
          </header>

          {mode === "chat" && (
            <>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn("flex items-end gap-2", message.role === "user" && "justify-end")}
                  >
                    {message.role === "assistant" && (
                      <div className="mb-1 grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <Bot className="size-4" aria-hidden="true" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[82%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                        message.role === "user"
                          ? "rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-bl-md bg-muted text-foreground",
                      )}
                    >
                      {message.content || (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <LoaderCircle className="size-3.5 animate-spin" /> Думаю…
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {messages.length === 1 && (
                  <div className="grid gap-2 pt-1 pl-9">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="rounded-xl border bg-card px-3 py-2 text-left text-xs font-medium transition-colors hover:border-primary/40 hover:bg-accent"
                        onClick={() => void sendMessage(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                {error && (
                  <div className="ml-9 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive">
                    <p>{error}</p>
                    <button type="button" className="mt-2 font-semibold underline underline-offset-2" onClick={openHandoff}>
                      Передать вопрос менеджеру
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t bg-card p-3">
                <button
                  type="button"
                  className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  onClick={openHandoff}
                >
                  <Headphones className="size-3.5" /> Связаться с живым менеджером
                </button>
                <form onSubmit={submitChat} className="flex items-end gap-2">
                  <Textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value.slice(0, 2_000))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        if (input.trim()) void sendMessage(input);
                      }
                    }}
                    placeholder="Напишите ваш вопрос…"
                    className="max-h-28 min-h-10 resize-none rounded-xl"
                    rows={1}
                    disabled={sending}
                    aria-label="Сообщение помощнику"
                  />
                  <Button type="submit" size="icon" className="size-10 shrink-0 rounded-xl" disabled={sending || !input.trim()}>
                    {sending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                    <span className="sr-only">Отправить</span>
                  </Button>
                </form>
                <p className="mt-2 text-center text-[10px] text-muted-foreground">AI может ошибаться — важные данные лучше перепроверить.</p>
              </div>
            </>
          )}

          {mode === "handoff" && (
            <form onSubmit={submitHandoff} className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
              <div>
                <button type="button" className="mb-3 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setMode("chat")}>
                  ← Вернуться к чату
                </button>
                <h2 className="text-base font-semibold">Передать вопрос менеджеру</h2>
                <p className="mt-1 text-sm text-muted-foreground">Сохраним обращение и свяжемся по указанному контакту.</p>
              </div>
              <label className="grid gap-1.5 text-sm font-medium">
                Ваше имя <span className="text-xs font-normal text-muted-foreground">необязательно</span>
                <Input value={name} onChange={(event) => setName(event.target.value.slice(0, 100))} placeholder="Как к вам обращаться?" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Email или телефон
                <Input value={contact} onChange={(event) => setContact(event.target.value.slice(0, 160))} placeholder="name@example.com или +7…" required minLength={5} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Опишите вопрос
                <Textarea value={supportMessage} onChange={(event) => setSupportMessage(event.target.value.slice(0, 4_000))} placeholder="Что произошло и чем мы можем помочь?" className="min-h-28 resize-none" required minLength={10} />
              </label>
              {error && <p className="rounded-lg bg-destructive/5 p-3 text-xs text-destructive">{error}</p>}
              <div className="mt-auto">
                <Button type="submit" className="w-full" disabled={sending || contact.trim().length < 5 || supportMessage.trim().length < 10}>
                  {sending ? <LoaderCircle className="animate-spin" /> : <Headphones />} Отправить менеджеру
                </Button>
                <p className="mt-2 text-center text-[10px] text-muted-foreground">К обращению приложится история этого чата.</p>
              </div>
            </form>
          )}

          {mode === "success" && (
            <div className="grid flex-1 place-items-center p-6 text-center">
              <div>
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-700">
                  <CheckCircle2 className="size-7" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">Обращение принято</h2>
                <p className="mt-2 text-sm text-muted-foreground">Менеджер свяжется с вами по указанному контакту.</p>
                <p className="mt-3 font-mono text-xs font-semibold tracking-wide text-primary">{ticketReference}</p>
                <Button type="button" variant="outline" className="mt-6" onClick={() => { setMode("chat"); setOpen(false); }}>
                  Готово
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      <Button
        type="button"
        size="icon"
        className="size-14 rounded-2xl shadow-lg shadow-primary/25 transition-transform hover:scale-105"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Закрыть поддержку" : "Открыть поддержку"}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-6" />}
      </Button>
    </div>
  );
}
