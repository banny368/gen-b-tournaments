"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { callRpc } from "@/lib/rpc";

type Message = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { username: string | null; display_name: string | null } | null;
};

export function GlobalChat({
  channelId,
  currentUserId,
  initialMessages,
}: {
  channelId: string | null;
  currentUserId: string | null;
  initialMessages: Message[];
}) {
  const t = useTranslations("chat");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!channelId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const row = payload.new as { id: string; content: string; created_at: string; user_id: string };
          setMessages((prev) => [
            ...prev,
            { ...row, profiles: { username: null, display_name: null } },
          ]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);

  async function send() {
    if (!channelId || !draft.trim() || sending) return;
    setSending(true);
    const res = await callRpc("send_chat_message", { p_channel_id: channelId, p_content: draft.trim() });
    setSending(false);
    if (res.success) {
      setDraft("");
    } else if (res.error?.code === "RATE_LIMITED") {
      alert(t("rateLimited"));
    } else if (res.error?.code === "PROFANITY") {
      alert(t("blocked"));
    }
  }

  if (!channelId) return null;

  return (
    <div className="flex h-[65vh] flex-col rounded-card border border-border bg-surface shadow-card">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => {
          const mine = m.user_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                  mine
                    ? "rounded-br-md bg-primary text-white"
                    : "rounded-bl-md border border-border bg-surface-2"
                }`}
              >
                {!mine && (
                  <p className="mb-0.5 text-xs font-semibold text-primary">
                    {m.profiles?.display_name ?? m.profiles?.username ?? "Player"}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-muted"}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 border-t border-border p-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder={t("messagePlaceholder")}
          maxLength={500}
        />
        <Button size="icon" onClick={send} disabled={!draft.trim() || sending} aria-label={t("send")}>
          <Send />
        </Button>
      </div>
    </div>
  );
}
