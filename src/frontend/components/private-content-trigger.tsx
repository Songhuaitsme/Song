"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { privateContentMessage } from "@/shared/content-access";

export function PrivateContentTrigger({ title }: { title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const messageId = useId();
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);

  return <>
    <button className="private-content-trigger" ref={trigger} onClick={() => setOpen(true)} aria-haspopup="dialog">{title}</button>
    {open && createPortal(<dialog className="private-content-dialog" ref={dialog} aria-labelledby={titleId} aria-describedby={messageId} onClose={() => { setOpen(false); trigger.current?.focus(); }}>
      <h2 id={titleId}>{title}</h2>
      <p id={messageId}>{privateContentMessage}</p>
      <form method="dialog"><button autoFocus>关闭</button></form>
    </dialog>, document.body)}
  </>;
}
