"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTenant } from "@/lib/tenant-context";
import { useCreateEvent } from "@/lib/hooks/use-events";
import { ApiError } from "@/lib/api-client";
import { Send } from "lucide-react";

export function SendEventDialog() {
  const { activeTenant } = useTenant();
  const createEvent = useCreateEvent();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [payloadText, setPayloadText] = useState('{\n  "host": "web-01"\n}');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let payload: unknown;
    try {
      payload = payloadText.trim() ? JSON.parse(payloadText) : {};
    } catch {
      toast.error("Payload must be valid JSON");
      return;
    }

    try {
      await createEvent.mutateAsync({
        tenantId: activeTenant!.id,
        type,
        source: source || undefined,
        payload,
      });
      toast.success("Event sent");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not send event");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Send />
          Send test event
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send a test event</DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-type">Event type</Label>
              <Input
                id="event-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="cpu.high"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-source">Source (optional)</Label>
              <Input
                id="event-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="monitoring-agent"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-payload">Payload (JSON)</Label>
              <textarea
                id="event-payload"
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                rows={5}
                className="rounded-md border border-input bg-background px-3 py-2 font-mono text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={createEvent.isPending}>
              {createEvent.isPending ? "Sending..." : "Send event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
