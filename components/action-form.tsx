"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/actions";

export function Submit({ children, className = "button", disabled = false }: { children: ReactNode; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending || disabled} type="submit">{pending ? "Aguarde…" : children}</button>;
}
export function ActionForm({ action, children, className = "form-grid" }: { action: (state: ActionState, data: FormData) => Promise<ActionState>; children: ReactNode; className?: string }) {
  const [state, formAction] = useActionState(action, {});
  return <form action={formAction} className={className}>
    {children}
    {state.error && <p role="alert" className="notice error full">{state.error}</p>}
    {state.success && <p role="status" className="notice success full">{state.success}</p>}
  </form>;
}
