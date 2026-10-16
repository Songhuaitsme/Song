"use client";

import { useRef, useState, type FormEvent } from "react";
import { messageText, type GuestbookMessage, type MessagePage } from "@/shared/guestbook";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

export const messageDate = (date: number) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
export function MessageContent({ message }: { message: GuestbookMessage }) {
  return <>
    <div className="guestbook-message-meta"><strong data-text-page="guestbook" data-text-role="label">{message.nickname}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{messageDate(message.createdAt)}</time></div>
    <p className="guestbook-message-body" data-text-page="guestbook" data-text-role="body">{message.body}</p>
    {message.reply && <div className="guestbook-owner-reply"><div className="guestbook-message-meta"><strong>主人回复</strong>{message.repliedAt && <time dateTime={new Date(message.repliedAt).toISOString()}>{messageDate(message.repliedAt)}</time>}</div><p data-text-page="guestbook" data-text-role="body">{message.reply}</p></div>}
  </>;
}
export function Guestbook({ initial }: { initial: MessagePage | null }) {
  const [data, setData] = useState(initial), [nickname, setNickname] = useState(""), [body, setBody] = useState(""), [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(""), [status, setStatus] = useState("");
  const [listError, setListError] = useState(initial ? "" : "暂时无法读取留言，请稍后重试");
  const submission = useRef<{ id: string; key: string } | null>(null), lastPage = useRef(1);
  async function load(page: number) {
    lastPage.current = page; setLoading(true); setListError("");
    try { const response = await fetch(`/api/messages?page=${page}`, { cache: "no-store" }); const result = await response.json() as MessagePage & { error?: string }; if (!response.ok) throw new Error(result.error || "无法读取留言"); setData(result); return true; }
    catch { setListError("暂时无法读取留言，请稍后重试"); return false; }
    finally { setLoading(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (sending) return;
    setError(""); setStatus("");
    let name: string, text: string;
    try { name = messageText(nickname, "昵称", 30); text = messageText(body, "留言", 1000); }
    catch (error) { setError(error instanceof Error ? error.message : "请检查填写内容"); return; }
    const key = JSON.stringify([name, text]); if (submission.current?.key !== key) submission.current = { id: crypto.randomUUID(), key };
    setSending(true);
    try {
      const response = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: submission.current.id, nickname: name, body: text, website }) });
      const result = await response.json() as { message: GuestbookMessage | null; error?: string }; if (!response.ok) throw new Error(result.error || "留言未能提交，请重试");
      setBody(""); setNickname(name); submission.current = null; setStatus("留言已发布，谢谢你留下的想法。");
      const published = result.message;
      if (!(await load(1)) && published) setData(current => { const items = [published, ...(current?.items ?? []).filter(item => item.id !== published.id)].slice(0, 20); const total = Math.max(items.length, (current?.total ?? 0) + (current?.items.some(item => item.id === published.id) ? 0 : 1)); return { items, total, page: 1, pages: Math.max(1, Math.ceil(total / 20)), counts: { all: total, public: total, hidden: 0 } }; });
    } catch (error) { setError(error instanceof Error ? error.message : "留言未能提交，输入已保留，请重试"); }
    finally { setSending(false); }
  }
  return <div className="guestbook-content">
    <form className="guestbook-form" onSubmit={submit} aria-label="发布留言" aria-busy={sending}>
      <h2>留下你的想法</h2><p className="guestbook-form-note">提交后公开展示，无需登录。</p>
      <label htmlFor="guestbook-nickname">昵称 <span>{Array.from(nickname.trim()).length}/30</span></label><Input id="guestbook-nickname" name="nickname" required autoComplete="nickname" maxLength={120} value={nickname} disabled={sending} onChange={event => setNickname(event.target.value)} placeholder="怎么称呼你"/>
      <label htmlFor="guestbook-body">留言 <span>{Array.from(body.trim()).length}/1000</span></label><Textarea id="guestbook-body" name="body" required value={body} disabled={sending} onChange={event => setBody(event.target.value)} placeholder="关于照片、文字，或今天的一点感受……" rows={5}/>
      <div className="guestbook-trap" aria-hidden="true"><label htmlFor="guestbook-website">请留空</label><input id="guestbook-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)}/></div>
      {error && <p className="guestbook-error" role="alert">{error}</p>}<div className="guestbook-submit"><p role="status" aria-live="polite">{status}</p><Button type="submit" disabled={sending || loading}>{sending ? "正在发布…" : "发布留言"}</Button></div>
    </form>
    <section className="guestbook-list" aria-label="公开留言" aria-busy={loading}>
      <div className="guestbook-list-heading"><h2>这里留下的声音</h2>{data && <span>{data.total} 条留言</span>}</div>
      {listError && <div className="guestbook-error" role="alert"><p>{listError}</p><Button variant="outline" disabled={loading || sending} onClick={() => void load(lastPage.current)}>重新加载</Button></div>}
      {data?.items.map(message => <article className="guestbook-message" key={message.id} id={`message-${message.id}`}><MessageContent message={message}/></article>)}
      {data && !data.items.length && <p className="guestbook-empty">这里还很安静，欢迎留下第一条留言。</p>}
      {data && data.pages > 1 && <nav className="guestbook-pagination" aria-label="留言分页"><Button variant="outline" disabled={loading || sending || data.page <= 1} onClick={() => void load(data.page - 1)}>上一页</Button><span>第 {data.page} / {data.pages} 页</span><Button variant="outline" disabled={loading || sending || data.page >= data.pages} onClick={() => void load(data.page + 1)}>下一页</Button></nav>}
    </section>
  </div>;
}
