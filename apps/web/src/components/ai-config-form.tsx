"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import type { AiConfig } from "@/lib/types";

const PROVIDERS = ["anthropic", "openai", "ollama"];

interface AiConfigFormProps {
  config?: AiConfig;
  readOnly: boolean;
  onSubmit: (values: { provider: string; model: string }) => Promise<unknown>;
}

export function AiConfigForm({ config, readOnly, onSubmit }: AiConfigFormProps) {
  const [provider, setProvider] = useState(config?.provider ?? "anthropic");
  const [model, setModel] = useState(config?.model ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!config) return;
    setProvider(config.provider);
    setModel(config.model);
  }, [config]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({ provider, model });
      toast.success("AI configuration updated");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not update configuration");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-provider">Provider</Label>
        <Select value={provider} onValueChange={setProvider} disabled={readOnly}>
          <SelectTrigger id="ai-provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ai-model">Model</Label>
        <Input
          id="ai-model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="claude-sonnet-5"
          disabled={readOnly}
          required
        />
      </div>
      {!readOnly && (
        <Button type="submit" disabled={isSubmitting} className="w-fit">
          {isSubmitting ? "Saving..." : "Save configuration"}
        </Button>
      )}
    </form>
  );
}
