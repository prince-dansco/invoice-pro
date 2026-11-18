"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import type { SavedClient } from "@/app/(app)/clients/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

import { ClientForm } from "./client-form";

/**
 * Adds a client without leaving the current page (IP-144). The invoice editor
 * passes onCreated to select the new client straight away; because this is a
 * dialog, the editor's unsaved state is untouched.
 */
export function NewClientDialog({
  onCreated,
  trigger,
}: {
  onCreated: (client: SavedClient) => void;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  // Remount the form each time so it opens empty.
  const [formKey, setFormKey] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setFormKey((k) => k + 1);
      }}
    >
      <DialogTrigger render={trigger ?? <Button type="button" variant="outline" />}>
        {!trigger && (
          <>
            <Plus aria-hidden />
            New client
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
          <DialogDescription>Only the name is required. You can add more details later.</DialogDescription>
        </DialogHeader>
        <ClientForm
          key={formKey}
          compact
          submitLabel="Add client"
          onSaved={(client, message) => {
            toast.success(message);
            setOpen(false);
            onCreated(client);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
