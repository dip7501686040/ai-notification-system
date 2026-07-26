"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, LogOut, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";
import { useCreateTenant } from "@/lib/hooks/use-tenants";
import { slugify } from "@/lib/utils";
import { ApiError } from "@/lib/api-client";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and dashes only"),
});
type FormValues = z.infer<typeof schema>;

export default function TenantsPickerPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { tenants, setActiveTenantId } = useTenant();
  const [open, setOpen] = useState(false);
  const createTenant = useCreateTenant();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const name = watch("name");

  function handleNameChange(value: string) {
    setValue("name", value);
    setValue("slug", slugify(value));
  }

  async function onSubmit(values: FormValues) {
    try {
      const tenant = await createTenant.mutateAsync(values);
      setActiveTenantId(tenant.id);
      setOpen(false);
      reset();
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not create organization");
    }
  }

  function selectTenant(id: string) {
    setActiveTenantId(id);
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Choose an organization</h1>
          <p className="text-sm text-muted-foreground">Signed in as {user?.email ?? "..."}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut />
          Sign out
        </Button>
      </div>

      {tenants.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {tenants.map((tenant) => (
            <Card
              key={tenant.id}
              className="cursor-pointer transition-colors hover:border-primary"
              onClick={() => selectTenant(tenant.id)}
            >
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <div className="flex size-9 items-center justify-center rounded-lg bg-secondary">
                  <Building2 className="size-4" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{tenant.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {tenant.role}
                </Badge>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-fit">
            <Plus />
            Create organization
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Create a new organization</DialogTitle>
            </DialogHeader>
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Organization name</Label>
                <Input
                  id="name"
                  value={name ?? ""}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Acme Inc"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" {...register("slug")} placeholder="acme-inc" />
                {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="submit" disabled={createTenant.isPending}>
                {createTenant.isPending ? "Creating..." : "Create organization"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
