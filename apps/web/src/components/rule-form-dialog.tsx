"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import type { Rule, RuleAction } from "@/lib/types";

const CHANNELS = ["email", "webhook", "dashboard"];

interface RuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: Rule;
  onSubmit: (values: {
    name: string;
    eventType: string;
    enabled: boolean;
    conditions?: unknown;
    actions: RuleAction[];
  }) => Promise<unknown>;
}

function emptyAction(): RuleAction {
  return { channel: "email", target: "", template: "" };
}

export function RuleFormDialog({ open, onOpenChange, rule, onSubmit }: RuleFormDialogProps) {
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [conditionsText, setConditionsText] = useState("");
  const [actions, setActions] = useState<RuleAction[]>([emptyAction()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(rule?.name ?? "");
    setEventType(rule?.eventType ?? "");
    setEnabled(rule?.enabled ?? true);
    setConditionsText(
      rule?.conditions && Object.keys(rule.conditions as object).length > 0
        ? JSON.stringify(rule.conditions, null, 2)
        : "",
    );
    setActions(rule?.actions && rule.actions.length > 0 ? rule.actions : [emptyAction()]);
  }, [open, rule]);

  function updateAction(index: number, patch: Partial<RuleAction>) {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function removeAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let conditions: unknown;
    if (conditionsText.trim()) {
      try {
        conditions = JSON.parse(conditionsText);
      } catch {
        toast.error("Conditions must be valid JSON");
        return;
      }
    }

    const cleanedActions = actions
      .filter((a) => a.target.trim())
      .map((a) => ({
        channel: a.channel,
        target: a.target.trim(),
        ...(a.template?.trim() ? { template: a.template.trim() } : {}),
      }));

    if (cleanedActions.length === 0) {
      toast.error("At least one action with a target is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ name, eventType, enabled, conditions, actions: cleanedActions });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{rule ? "Edit rule" : "Create rule"}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rule-name">Name</Label>
                <Input
                  id="rule-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="High CPU alert"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rule-event-type">Event type</Label>
                <Input
                  id="rule-event-type"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  placeholder="cpu.high or *"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="rule-enabled" checked={enabled} onCheckedChange={setEnabled} />
              <Label htmlFor="rule-enabled">Enabled</Label>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rule-conditions">Conditions (JSON, optional)</Label>
              <textarea
                id="rule-conditions"
                value={conditionsText}
                onChange={(e) => setConditionsText(e.target.value)}
                placeholder='{"and": [{"field": "severity", "op": "eq", "value": "critical"}]}'
                rows={3}
                className="rounded-md border border-input bg-background px-3 py-2 font-mono text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Actions</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setActions((prev) => [...prev, emptyAction()])}
                >
                  <Plus />
                  Add action
                </Button>
              </div>
              {actions.map((action, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 rounded-md border border-border p-2"
                >
                  <Select
                    value={action.channel}
                    onValueChange={(value) => updateAction(index, { channel: value })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Target (email, URL, or user id)"
                    value={action.target}
                    onChange={(e) => updateAction(index, { target: e.target.value })}
                  />
                  <Input
                    placeholder="Template (optional)"
                    value={action.template ?? ""}
                    onChange={(e) => updateAction(index, { template: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAction(index)}
                    disabled={actions.length === 1}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : rule ? "Save changes" : "Create rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
