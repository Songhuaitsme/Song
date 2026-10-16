"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { type ManagedMessage, type MessagePage } from "@/shared/guestbook";
import { messageDate } from "./guestbook";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";

export type ReplyDraft = { text: string; original: string; version: number };
export function GuestbookManager({ csrfToken, drafts, onDirtyChange, onBusyChange }: { csrfToken: string; drafts: Map<string, ReplyDraft>; onDirtyChange(dirty: boolean): void; onBusyChange(busy: boolean): void }) {
  const [data, setData] = useState<MessagePage<ManagedMessage> | null>(null), [view, setView] = useState({ visibility: "all", query: "", page: 1 });
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(""), [deleting, setDeleting] = useState<ManagedMessage | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [, render] = useState(0), generation = useRef(0), requestLock = useRef(false);
  const changed = () => { render(value => value + 1); onDirtyChange(drafts.size > 0); };
  async function load() {
    const current = ++generation.current; setLoading(true); setError("");
    try {
      const response = await fetch(`/api/studio/messages?${new URLSearchParams({ visibility: view.visibility, q: view.query, page: String(view.page) })}`, { cache: "no-store" });
      const result = await response.json() as MessagePage<ManagedMessage> & { error?: string }; if (!response.ok) throw new Error(result.error || "无法读取留言");
      if (current !== generation.current) return;
      for (const message of result.items as ManagedMessage[]) if (drafts.get(message.id)?.text === message.reply) drafts.delete(message.id);
      setData(result); onDirtyChange(drafts.size > 0);
    } catch (error) { if (current === generation.current) setError(error instanceof Error ? error.message : "无法读取留言"); }
    finally { if (current === generation.current) setLoading(false); }
  }
  useEffect(() => { const timer = setTimeout(() => void load(), 200); return () => { clearTimeout(timer); generation.current++; }; }, [view]); // eslint-disable-line react-hooks/exhaustive-deps
  async function operate(message: ManagedMessage, action: "reply" | "set-visibility" | "delete") {
    if (requestLock.current) return; requestLock.current = true; setBusy(true); onBusyChange(true);
    const draft = drafts.get(message.id), version = action === "reply" ? draft?.version ?? message.version : message.version;
    try {
      const response = await fetch("/api/studio/messages", { method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify({ action, id: message.id, version, ...(action === "reply" ? { reply: draft?.text ?? message.reply } : action === "set-visibility" ? { visibility: message.visibility === "public" ? "hidden" : "public" } : {}) }) });
      const result = await response.json() as { message: ManagedMessage | null; error?: string }; if (!response.ok) throw new Error(result.error || "留言操作失败，回复草稿已保留");
      if (action === "reply" || action === "delete") drafts.delete(message.id);
      else if (draft && draft.version === message.version && result.message) drafts.set(message.id, { ...draft, version: result.message.version });
      setData(current=>{
        if(!current)return current;const saved=result.message,visible=!!saved&&(view.visibility==="all"||view.visibility===saved.visibility);
        return {...current,total:current.total-(visible?0:1),counts:{all:current.counts.all-(saved?0:1),public:current.counts.public+(saved?.visibility==="public"?1:0)-(message.visibility==="public"?1:0),hidden:current.counts.hidden+(saved?.visibility==="hidden"?1:0)-(message.visibility==="hidden"?1:0)},items:current.items.flatMap(item=>item.id!==message.id?[item]:visible?[saved!]:[])};
      });
      changed(); setDeleting(null); await load(); toast.success(action === "reply" ? "回复已保存" : action === "delete" ? "留言已删除" : message.visibility === "public" ? "留言已隐藏" : "留言已公开");
    } catch (error) { toast.error(error instanceof Error ? error.message : "操作失败，回复草稿已保留"); }
    finally { requestLock.current = false; setBusy(false); onBusyChange(false); }
  }
  return <section className="guestbook-manager" aria-label="留言管理">
    <div className="studio-actions"><div><h2>留言管理</h2><p>访客提交后直接公开；你可以回复、隐藏或删除。</p></div><Button variant="outline" disabled={busy || loading} onClick={() => void load()}>刷新留言</Button></div>
    <div className="studio-status-filters" role="group" aria-label="留言状态筛选">{(["all", "public", "hidden"] as const).map(visibility => <button key={visibility} type="button" disabled={busy} aria-pressed={view.visibility === visibility} onClick={() => setView(current => ({ ...current, visibility, page: 1 }))}>{visibility === "all" ? "全部" : visibility === "public" ? "公开" : "隐藏"}<span>{data?.counts[visibility] ?? 0}</span></button>)}</div>
    <Input aria-label="搜索留言" value={view.query} disabled={busy} placeholder="搜索昵称或留言内容" onChange={event => setView(current => ({ ...current, query: event.target.value, page: 1 }))}/>
    {drafts.size > 0 && <div className="privacy-note"><p role="status">有 {drafts.size} 条未保存回复，切换筛选或分页不会丢失。</p><Button size="sm" variant="ghost" disabled={busy} onClick={() => setDiscarding(true)}>放弃回复草稿</Button></div>}
    {error && <div className="guestbook-error" role="alert"><p>{error}</p><Button variant="outline" disabled={busy || loading} onClick={() => void load()}>重新加载</Button></div>}
    {loading && <p role="status">正在读取留言…</p>}
    <div className="guestbook-admin-list" aria-busy={loading}>{data?.items.map(message => {
      const draft = drafts.get(message.id), stale = !!draft && draft.version !== message.version;
      return <article className="guestbook-admin-message" key={message.id} data-message-id={message.id}>
        <div className="guestbook-message-meta"><strong>{message.nickname}</strong><time dateTime={new Date(message.createdAt).toISOString()}>{messageDate(message.createdAt)}</time><span className={`message-visibility is-${message.visibility}`}>{message.visibility === "public" ? "公开" : "隐藏"}</span><span>{message.reply ? "已回复" : "未回复"}</span>{draft && <span className="studio-unsaved">未保存</span>}</div>
        <p className="guestbook-message-body">{message.body}</p>
        <label htmlFor={`reply-${message.id}`}>主人回复 <span className="series-writing-hint">清空并保存即可移除回复 · 最多 2000 字</span></label>
        <Textarea id={`reply-${message.id}`} value={draft?.text ?? message.reply} disabled={busy} rows={3} onChange={event => { const text = event.target.value; if (text === message.reply) drafts.delete(message.id); else drafts.set(message.id, { text, original: draft?.original ?? message.reply, version: draft?.version ?? message.version }); changed(); }}/>
        {stale && <div className="guestbook-error" role="alert"><p>这条留言已有新修改，草稿已保留。请核对当前回复：{message.reply || "尚无回复"}</p><Button size="sm" variant="outline" disabled={busy} onClick={() => { drafts.set(message.id, { ...draft!, original: message.reply, version: message.version }); changed(); }}>保留草稿并使用最新版本</Button></div>}
        <div className="row-actions"><Button disabled={busy || loading || !draft || stale} onClick={() => void operate(message, "reply")}>保存回复</Button><Button variant="outline" disabled={busy || loading} onClick={() => void operate(message, "set-visibility")}>{message.visibility === "public" ? "隐藏留言" : "重新公开"}</Button><Button variant="ghost" disabled={busy || loading} onClick={() => setDeleting(message)}>删除留言</Button></div>
      </article>;
    })}</div>
    {data && !data.items.length && !loading && <p className="guestbook-empty">{view.query || view.visibility !== "all" ? "没有符合条件的留言。" : "还没有收到留言。"}</p>}
    {data && <nav className="guestbook-pagination" aria-label="管理留言分页"><Button variant="outline" disabled={busy || loading || data.page <= 1} onClick={() => setView(current => ({ ...current, page: data.page - 1 }))}>上一页</Button><span>找到 {data.total} 条 · 第 {data.page} / {data.pages} 页</span><Button variant="outline" disabled={busy || loading || data.page >= data.pages} onClick={() => setView(current => ({ ...current, page: data.page + 1 }))}>下一页</Button></nav>}
    <AlertDialog open={!!deleting} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除这条留言？</AlertDialogTitle><AlertDialogDescription>留言、主人回复及此条未保存的回复草稿都会移除，访客将无法再看到。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>取消</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); if (deleting) void operate(deleting, "delete"); }}>{busy ? "正在删除…" : "确认删除"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={discarding} onOpenChange={setDiscarding}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>放弃所有未保存回复？</AlertDialogTitle><AlertDialogDescription>这些草稿尚未发布，放弃后需要重新输入。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => { drafts.clear(); changed(); }}>放弃草稿</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
