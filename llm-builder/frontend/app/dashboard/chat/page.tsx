"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { useTopBar } from "@/app/dashboard/TopBarContext";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Modal } from "@/app/components/ui/Modal";
import { MoreVerticalIcon } from "@/app/components/ui/icons";

type Deployment = { id: string; name: string };
type Session = { id: string; deployment_id: string; title: string; updated_at: string };
type Citation = { text: string; source: string; score: number };
type Message = { id: string; role: string; content: string; citations: Citation[] | null; created_at: string };

export default function ChatPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatDeploymentId, setNewChatDeploymentId] = useState("");
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [renameSession, setRenameSession] = useState<Session | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  useTopBar(
    "Chat",
    <Button
      variant="primary"
      onClick={() => {
        setShowNewChat(true);
        setNewChatDeploymentId(deployments[0]?.id ?? "");
      }}
    >
      Start New Chat
    </Button>
  );

  const loadDeployments = async () => {
    try {
      const list = await apiRequest<Deployment[]>("/api/v1/deployments");
      setDeployments(list);
      if (list.length && !selectedDeploymentId) setSelectedDeploymentId(list[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSessions = async () => {
    try {
      const list = await apiRequest<Session[]>("/api/v1/chat/sessions");
      setSessions(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadDeployments();
    loadSessions();
  }, []);

  useEffect(() => {
    if (!currentSession) {
      setMessages([]);
      return;
    }
    apiRequest<Message[]>(`/api/v1/chat/sessions/${currentSession.id}/messages`)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [currentSession?.id]);

  useEffect(() => {
    if (!menuSessionId) return;
    const close = () => setMenuSessionId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuSessionId]);

  const createSessionForDeployment = async (deploymentId: string) => {
    setLoading(true);
    try {
      const s = await apiRequest<{ id: string; deployment_id: string; title: string }>("/api/v1/chat/sessions", {
        method: "POST",
        body: JSON.stringify({ deployment_id: deploymentId }),
      });
      const session = { ...s, updated_at: new Date().toISOString() };
      setCurrentSession(session);
      setSelectedDeploymentId(deploymentId);
      setSessions((prev: Session[]) => [session, ...prev]);
      return session;
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatDeploymentId.trim()) return;
    await createSessionForDeployment(newChatDeploymentId);
    setShowNewChat(false);
    setNewChatDeploymentId(deployments[0]?.id ?? "");
  };

  const updateSessionTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameSession || !renameTitle.trim()) return;
    try {
      const updated = await apiRequest<{ id: string; deployment_id: string; title: string }>(
        `/api/v1/chat/sessions/${renameSession.id}`,
        { method: "PATCH", body: JSON.stringify({ title: renameTitle.trim() }) }
      );
      setSessions((prev) =>
        prev.map((s) => (s.id === renameSession.id ? { ...s, title: updated.title } : s))
      );
      if (currentSession?.id === renameSession.id) setCurrentSession((s) => (s ? { ...s, title: updated.title } : null));
      setRenameSession(null);
      setRenameTitle("");
    } catch (err) {
      console.error(err);
    }
  };

  const deleteSessionById = async (sessionId: string) => {
    if (!confirm("Delete this chat? Messages cannot be recovered.")) return;
    setMenuSessionId(null);
    try {
      await apiRequest(`/api/v1/chat/sessions/${sessionId}`, { method: "DELETE" });
      if (currentSession?.id === sessionId) setCurrentSession(null);
      await loadSessions();
    } catch (err) {
      console.error(err);
    }
  };

  const send = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!currentSession || !input.trim() || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    try {
      const res = await apiRequest<{ response: string; citations: { text: string; source: string; score: number }[] }>(
        `/api/v1/chat/sessions/${currentSession.id}/messages`,
        { method: "POST", body: JSON.stringify({ content }) }
      );
      setMessages((prev: Message[]) => [
        ...prev,
        { id: "u-" + Date.now(), role: "user", content, citations: null, created_at: new Date().toISOString() },
        { id: "a-" + Date.now(), role: "assistant", content: res.response, citations: res.citations || [], created_at: new Date().toISOString() },
      ]);
    } catch (err) {
      setMessages((prev: Message[]) => [
        ...prev,
        { id: "u-" + Date.now(), role: "user", content, citations: null, created_at: new Date().toISOString() },
        { id: "a-" + Date.now(), role: "assistant", content: "Error: " + (err instanceof Error ? err.message : String(err)), citations: [], created_at: new Date().toISOString() },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <PageHeader description="Pick a deployment and chat. Answers are grounded in your documents when a knowledge base is linked." />

      <Modal open={showNewChat} onClose={() => setShowNewChat(false)} title="Start New Chat">
        <form onSubmit={startNewChat} className="space-y-4">
          <div>
            <label className="label">Deployment</label>
            <select
              value={newChatDeploymentId}
              onChange={(e) => setNewChatDeploymentId(e.target.value)}
              className="input"
              required
            >
              <option value="">Select deployment</option>
              {deployments.map((d: Deployment) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary" disabled={loading || deployments.length === 0}>
              {loading ? "Starting…" : "Start chat"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowNewChat(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={renameSession != null} onClose={() => { setRenameSession(null); setRenameTitle(""); }} title="Rename chat">
        <form onSubmit={updateSessionTitle} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input
              type="text"
              placeholder="Chat title"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              className="input"
              required
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary">
              Save
            </Button>
            <Button type="button" variant="secondary" onClick={() => { setRenameSession(null); setRenameTitle(""); }}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      <div className="flex gap-4 flex-1 min-h-0">
        <Card className="w-56 flex-shrink-0 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h2 className="font-semibold text-slate-800 text-sm">Chats</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {sessions.length > 0 && (
              <>
                <p className="px-3 pt-1 pb-1 text-xs font-semibold text-slate-500 uppercase">Recent</p>
                {sessions.slice(0, 5).map((s: Session) => (
                  <div
                    key={s.id}
                    className={`group flex items-center gap-1 w-full rounded-[var(--radius)] text-sm transition-colors ${
                      currentSession?.id === s.id ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setCurrentSession(s)}
                      className="flex-1 min-w-0 text-left px-3 py-2 truncate"
                      title={s.title}
                    >
                      {s.title}
                    </button>
                    <div className="relative flex-shrink-0 pr-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuSessionId((id) => (id === s.id ? null : s.id));
                        }}
                        className="p-1.5 rounded hover:bg-slate-200/80 text-slate-500 hover:text-slate-700"
                        title="Options"
                        aria-label="Chat options"
                      >
                        <MoreVerticalIcon className="w-4 h-4" />
                      </button>
                      {menuSessionId === s.id && (
                        <div
                          className="absolute right-0 top-full z-10 mt-0.5 min-w-[8rem] py-1 rounded-[var(--radius)] border border-[var(--border)] bg-white shadow-lg"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setRenameSession(s);
                              setRenameTitle(s.title);
                              setMenuSessionId(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSessionById(s.id)}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </Card>

        <Card className="flex-1 flex flex-col min-w-0 min-h-0">
          {currentSession ? (
            <>
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <p className="text-sm font-medium text-slate-800">
                  {deployments.find((d: Deployment) => d.id === currentSession.deployment_id)?.name ?? "Chat"}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <p className="text-sm text-slate-500">Start the conversation below.</p>
                )}
                {messages.map((m: Message) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-[var(--radius-lg)] px-4 py-3 text-left ${
                        m.role === "user" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                      {m.citations && m.citations.length > 0 && (
                        <details
                          className={`mt-2 text-xs ${m.role === "user" ? "text-brand-100" : "text-slate-600"}`}
                          open={m.role === "assistant" && m.content.startsWith("Error generating response")}
                        >
                          <summary className="cursor-pointer hover:underline">
                            {m.role === "assistant" && m.content.startsWith("Error generating response")
                              ? `Retrieved context (${m.citations.length} chunk${m.citations.length !== 1 ? "s" : ""}) — model error above`
                              : `Data from document (${m.citations.length} chunk${m.citations.length !== 1 ? "s" : ""})`}
                          </summary>
                          <ul className="mt-2 pl-4 space-y-2 list-none">
                            {m.citations.map((c: Citation, i: number) => (
                              <li key={i} className="border-l-2 border-slate-300 pl-2 py-1">
                                <span className="font-medium">{c.source}</span>
                                <pre className="mt-0.5 whitespace-pre-wrap break-words text-slate-700 bg-white/80 p-2 rounded mt-1 text-xs">
                                  {c.text}
                                </pre>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={send} className="p-4 border-t border-[var(--border)] flex gap-2">
                <textarea
                  value={input}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  rows={2}
                  className="input flex-1 resize-none"
                  onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <Button type="submit" variant="primary" disabled={sending} className="self-end">
                  {sending ? "…" : "Send"}
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <EmptyState
                title="No chat selected"
                description="Start a new chat or pick one from the list. Use Start New Chat to begin with a deployment."
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
