"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RevealApiKeyDialogProps {
  rawKey: string | null;
  onClose: () => void;
}

export function RevealApiKeyDialog({ rawKey, onClose }: RevealApiKeyDialogProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!rawKey) return;
    await navigator.clipboard.writeText(rawKey);
    setCopied(true);
    toast.success("Copied to clipboard");
  }

  return (
    <Dialog open={Boolean(rawKey)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your new API key</DialogTitle>
          <DialogDescription>
            Copy this key now -- you won&apos;t be able to see it again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3">
          <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs">{rawKey}</code>
          <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
            {copied ? <Check className="text-success" /> : <Copy />}
          </Button>
        </div>
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            Store this key securely. For security reasons, we cannot show it to you again -- you
            will need to rotate it if you lose it.
          </span>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
