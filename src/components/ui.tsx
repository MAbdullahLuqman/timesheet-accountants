"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const buttonStyles = cva("inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-[12px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-45", {
  variants: {
    variant: {
      primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
      secondary: "border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[#e3eddf]",
      ghost: "text-[var(--accent)] hover:bg-[var(--accent-soft)]",
      danger: "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
      quiet: "text-[var(--accent)] hover:text-[var(--accent-hover)]",
    },
  },
  defaultVariants: { variant: "secondary" },
});

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>>(({ className, variant, ...props }, ref) => <button ref={ref} className={cn(buttonStyles({ variant }), className)} {...props} />);
Button.displayName = "Button";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "rose" | "blue" }) {
  const tones = { neutral: "border-zinc-200 bg-zinc-50 text-zinc-600", green: "border-emerald-200 bg-emerald-50 text-emerald-800", amber: "border-amber-200 bg-amber-50 text-amber-800", rose: "border-rose-200 bg-rose-50 text-rose-800", blue: "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]" };
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4", tones[tone])}>{children}</span>;
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  return <span role="img" aria-label={name} title={name} className={cn("inline-grid shrink-0 place-items-center rounded-full border border-zinc-200 bg-zinc-100 font-semibold text-zinc-600", size === "sm" ? "size-7 text-[9px]" : "size-8 text-[10px]")}>{initials}</span>;
}

export function Drawer({ open, onOpenChange, title, description, children, className }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; className?: string }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="drawer-overlay" />
      <DialogPrimitive.Content className={cn("drawer-content", className)}>
        <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
          <div><DialogPrimitive.Title className="text-[15px] font-semibold tracking-[-0.02em]">{title}</DialogPrimitive.Title>{description && <DialogPrimitive.Description className="mt-1 text-xs text-zinc-500">{description}</DialogPrimitive.Description>}</div>
          <DialogPrimitive.Close asChild><Button variant="ghost" className="-mr-2 -mt-1 size-8 p-0" aria-label="Close drawer"><X size={16} /></Button></DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}

export function Modal({ open, onOpenChange, title, description, children, className }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; className?: string }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content className={cn("dialog-content", className)}>
        <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
          <div><DialogPrimitive.Title className="text-[15px] font-semibold">{title}</DialogPrimitive.Title>{description && <DialogPrimitive.Description className="mt-1 text-xs text-zinc-500">{description}</DialogPrimitive.Description>}</div>
          <DialogPrimitive.Close asChild><Button variant="ghost" className="-mr-2 -mt-1 size-8 p-0" aria-label="Close dialog"><X size={16} /></Button></DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}

export function PageHeading({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-[22px] font-semibold tracking-[-0.035em] text-zinc-900">{title}</h1><p className="mt-1 text-[12px] text-zinc-500">{subtitle}</p></div>{actions && <div className="flex items-center gap-2">{actions}</div>}</div>;
}

export function SectionTitle({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-3"><div><h2 className="text-[13px] font-semibold text-zinc-900">{title}</h2>{detail && <p className="mt-1 text-[11px] text-zinc-500">{detail}</p>}</div>{action}</div>;
}
