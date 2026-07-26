"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { ApiError } from "@/lib/api-client";
import type { CreatedApiKey } from "@/lib/types";

interface CreateApiKeyDialogProps {
  onCreate: (values: { name: string; rateLimit?: number }) => Promise<CreatedApiKey>;
  onCreated: (result: CreatedApiKey) => void;
}

export function CreateApiKeyDialog({ onCreate, onCreated }: CreateApiKeyDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rateLimit, setRateLimit] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await onCreate({
        name,
        rateLimit: rateLimit ? Number(rateLimit) : undefined,
      });
      setOpen(false);
      setName("");
      setRateLimit("");
      onCreated(result);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not create API key");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New API key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apikey-name">Name</Label>
              <Input
                id="apikey-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="production-ingest"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="apikey-rate-limit">Rate limit (requests/min)</Label>
              <Input
                id="apikey-rate-limit"
                type="number"
                min={1}
                value={rateLimit}
                onChange={(e) => setRateLimit(e.target.value)}
                placeholder="Default"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
