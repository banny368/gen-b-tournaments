"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogTitle,
} from "@radix-ui/react-alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Header({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

function Footer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex gap-3", className)} {...props} />;
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogOverlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
      <AlertDialogContent className="glass fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card p-6 focus:outline-none">
        <Header>
          <AlertDialogTitle className="font-display text-lg font-semibold">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted">{description}</AlertDialogDescription>
        </Header>
        <Footer className="mt-5">
          <AlertDialogCancel className={cn(buttonVariants({ variant: "outline" }), "flex-1")}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: destructive ? "danger" : "default" }), "flex-1")}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </Footer>
      </AlertDialogContent>
    </AlertDialog>
  );
}
