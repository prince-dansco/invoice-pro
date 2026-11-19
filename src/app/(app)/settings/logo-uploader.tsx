"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { LOGO_MAX_BYTES } from "@/lib/logo";
import type { FormState } from "@/lib/validation/form-state";

import { removeLogo, uploadLogo } from "./actions";

const ACCEPT = "image/png,image/jpeg,image/webp";
/** Longest side of a converted logo. Far more than a printed invoice needs. */
const MAX_SIDE = 1200;

/** Re-encodes a WebP image as PNG, scaling it down if it's very large. */
async function webpToPng(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("PNG encoding failed");
  return new File([blob], file.name.replace(/\.webp$/i, "") + ".png", { type: "image/png" });
}

export function LogoUploader({ logoUrl }: { logoUrl: string | null }) {
  const [state, action, uploading] = useActionState<FormState, FormData>(uploadLogo, {});
  const [removing, startRemove] = useTransition();
  const [clientError, setClientError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) toast.success(state.success);
  }, [state]);

  async function onFileChosen(input: HTMLInputElement) {
    setClientError(null);
    let file = input.files?.[0];
    if (!file) return;
    // Quick checks for fast feedback; the server checks the file contents again.
    if (!ACCEPT.split(",").includes(file.type)) return setClientError("Use a PNG, JPG or WebP image.");
    if (file.type === "image/webp") {
      // PDFs can only embed PNG and JPEG, so WebP is converted here, in the browser.
      file = await webpToPng(file).catch(() => undefined);
      if (!file) return setClientError("We couldn't read that WebP image. Try a PNG or JPG instead.");
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
    }
    if (file.size > LOGO_MAX_BYTES) return setClientError("That image is over 1 MB. Choose a smaller one.");
    formRef.current?.requestSubmit();
  }

  function onRemove() {
    startRemove(async () => {
      const result = await removeLogo().catch(() => ({ error: "Couldn't reach the server. Try again.", success: undefined }));
      if (result.error) toast.error(result.error);
      else toast.success(result.success);
    });
  }

  const busy = uploading || removing;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40">
          {logoUrl ? (
            // Signed URLs change hourly, so next/image caching wouldn't help here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Your business logo" className="size-full object-contain p-1.5" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
          )}
        </div>
        <form ref={formRef} action={action} className="flex flex-wrap gap-2">
          <label className="inline-flex">
            <input
              type="file"
              name="logo"
              accept={ACCEPT}
              className="peer sr-only"
              disabled={busy}
              onChange={(ev) => void onFileChosen(ev.target)}
            />
            <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:pointer-events-none peer-disabled:opacity-50">
              {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
              {uploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
            </span>
          </label>
          {logoUrl && (
            <Button type="button" variant="ghost" disabled={busy} onClick={onRemove}>
              {removing ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
              Remove
            </Button>
          )}
        </form>
      </div>
      <p className="text-xs text-muted-foreground">PNG, JPG or WebP, up to 1 MB. A wide logo on a transparent background works best.</p>
      {clientError ? <FormMessage state={{ error: clientError }} /> : state.error && <FormMessage state={{ error: state.error }} />}
    </div>
  );
}
