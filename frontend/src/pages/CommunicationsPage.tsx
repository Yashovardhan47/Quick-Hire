import { FormEvent, useCallback, useEffect, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { api, getSession } from "../lib/api";

type Conversation = {
  id: string;
  application_id: string;
  job_id: string;
  job_title: string;
  counterpart_name: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};

type Message = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export default function CommunicationsPage() {
  const user = getSession()?.user;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const rows = await api<Conversation[]>("/communications/conversations");
      setConversations(rows);
      setSelectedId(current => current || rows[0]?.id || "");
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Unable to load conversations");
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!conversationId) { setMessages([]); return; }
    try {
      const rows = await api<Message[]>(`/communications/conversations/${conversationId}/messages`);
      setMessages(rows);
      await api(`/communications/conversations/${conversationId}/read`, { method: "POST" });
      setConversations(current => current.map(row => row.id === conversationId ? { ...row, unread_count: 0 } : row));
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Unable to load messages");
    }
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);
  useEffect(() => { void loadMessages(selectedId); }, [selectedId, loadMessages]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadConversations();
      if (selectedId) void loadMessages(selectedId);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [loadConversations, loadMessages, selectedId]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const selected = conversations.find(row => row.id === selectedId);
    if (!selected || !draft.trim()) return;
    setWorking(true);
    setStatus("");
    try {
      await api(`/communications/applications/${selected.application_id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: draft.trim() }),
      });
      setDraft("");
      await Promise.all([loadMessages(selected.id), loadConversations()]);
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Unable to send message");
    } finally {
      setWorking(false);
    }
  }

  const selected = conversations.find(row => row.id === selectedId);
  return (
    <section className="workspace">
      <div className="section-heading"><div><span className="eyebrow">SECURE COMMUNICATION</span><h2>Application messages</h2></div><span className="safe-badge">Stored and access-controlled</span></div>
      {status && <div className="inline-notice" role="status">{status}</div>}
      <div className="message-layout">
        <aside className="panel conversation-list">
          <h3>Conversations</h3>
          {conversations.map(row => <button key={row.id} className={selectedId === row.id ? "selected" : ""} onClick={() => setSelectedId(row.id)}>
            <span><strong>{row.counterpart_name}</strong>{row.unread_count > 0 && <b>{row.unread_count}</b>}</span>
            <small>{row.job_title}</small><p>{row.last_message ?? "Application channel ready"}</p>
          </button>)}
          {conversations.length === 0 && <div className="empty-state compact"><MessageCircle /><p>A conversation appears after a candidate applies.</p></div>}
        </aside>
        <article className="panel message-thread">
          {selected ? <>
            <header><div><span className="eyebrow">{selected.job_title}</span><h3>{selected.counterpart_name}</h3></div></header>
            <div className="message-scroll" aria-live="polite">
              {messages.map(message => <div className={`message-bubble ${message.sender_id === user?.id ? "mine" : "theirs"}`} key={message.id}>
                <strong>{message.sender_id === user?.id ? "You" : message.sender_name}</strong><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString()}</small>
              </div>)}
              {messages.length === 0 && <p className="thread-empty">Start a job-related conversation here.</p>}
            </div>
            <form className="message-composer" onSubmit={send}><label><span className="sr-only">Message</span><textarea value={draft} onChange={event => setDraft(event.target.value)} maxLength={5000} placeholder="Write a clear application update…" required /></label><button className="primary" disabled={working || !draft.trim()}><Send size={17} /> Send</button></form>
          </> : <div className="empty-state"><MessageCircle /><h3>No conversation selected</h3><p>Choose an application conversation from the left.</p></div>}
        </article>
      </div>
    </section>
  );
}
