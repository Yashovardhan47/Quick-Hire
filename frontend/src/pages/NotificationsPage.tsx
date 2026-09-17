import { useCallback, useEffect, useState } from "react";
import { Bell, Check, Mail } from "lucide-react";
import { api } from "../lib/api";

type Notification = { id: string; event_type: string; title: string; body: string; read_at: string | null; created_at: string };
type Preferences = { in_app_enabled: boolean; browser_enabled: boolean; email_transactional_enabled: boolean; email_digest_enabled: boolean };

export default function NotificationsPage() {
  const [rows, setRows] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [status, setStatus] = useState("");
  const load = useCallback(async () => {
    try {
      const [items, prefs] = await Promise.all([api<Notification[]>("/notifications"), api<Preferences>("/notifications/preferences")]);
      setRows(items); setPreferences(prefs);
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Unable to load notifications"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(next: Preferences) {
    try {
      setPreferences(await api<Preferences>("/notifications/preferences", { method: "PUT", body: JSON.stringify(next) }));
      window.dispatchEvent(new CustomEvent("quickhire:browser-preference", { detail: next.browser_enabled }));
      setStatus("Notification preferences saved.");
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : "Unable to save preferences"); }
  }

  async function enableBrowser() {
    if (!preferences) return;
    if (!("Notification" in window)) { setStatus("This browser does not support desktop notifications."); return; }
    const permission = await window.Notification.requestPermission();
    const next = { ...preferences, browser_enabled: permission === "granted" };
    await save(next);
  }

  async function markRead(id: string) {
    await api(`/notifications/${id}/read`, { method: "POST" });
    setRows(current => current.map(row => row.id === id ? { ...row, read_at: new Date().toISOString() } : row));
  }

  return <section className="workspace">
    <div className="section-heading"><div><span className="eyebrow">NOTIFICATIONS</span><h2>Updates that survive page refreshes</h2></div><button className="secondary" disabled={!preferences} onClick={() => void enableBrowser()}><Bell size={16} /> Enable browser alerts</button></div>
    {status && <div className="inline-notice" role="status">{status}</div>}
    {preferences && <article className="panel preferences-panel"><div><Mail /><div><h3>Delivery preferences</h3><p>Transactional email requires the production email provider to be configured.</p></div></div><label className="confirmation-check"><input type="checkbox" checked={preferences.email_transactional_enabled} onChange={event => void save({ ...preferences, email_transactional_enabled: event.target.checked })} /> Email important application, interview and message events</label><label className="confirmation-check"><input type="checkbox" checked={preferences.email_digest_enabled} onChange={event => void save({ ...preferences, email_digest_enabled: event.target.checked })} /> Include me in future email digests</label></article>}
    <div className="notification-list">{rows.map(row => <article className={`panel notification-card ${row.read_at ? "read" : "unread"}`} key={row.id}><div><span className="eyebrow">{row.event_type.replaceAll(".", " ")}</span><h3>{row.title}</h3><p>{row.body}</p><small>{new Date(row.created_at).toLocaleString()}</small></div>{!row.read_at && <button className="text-button" onClick={() => void markRead(row.id)}><Check size={16} /> Mark read</button>}</article>)}{rows.length === 0 && <div className="empty-state"><Bell /><h3>You are caught up</h3><p>Application, message and interview updates will appear here.</p></div>}</div>
  </section>;
}
