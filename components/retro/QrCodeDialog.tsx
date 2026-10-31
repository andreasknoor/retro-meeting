"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Big QR code of the retro link for people joining by phone, e.g. over a shared screen in a
 * video call. Generated in the browser: the link is the only key to the retro, so it never goes
 * to a QR service.
 */
export function QrCodeDialog({ link, name, onClose }: { link: string; name: string; onClose: () => void }) {
  const [svg, setSvg] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(link, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }).then(
      (markup) => !cancelled && setSvg(markup),
      () => !cancelled && setSvg(null),
    );
    return () => {
      cancelled = true;
    };
  }, [link]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="QR code for this retro"
        className="grid w-full max-w-md gap-4 rounded-2xl bg-card p-6 text-center text-card-foreground shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-xl font-bold">Join on your phone</h2>
          <p className="text-sm text-muted-foreground">Scan to open “{name}”.</p>
        </div>
        {/* Always black on white, also in dark mode, so every scanner reads it. */}
        <div
          role="img"
          aria-label={`QR code for ${link}`}
          className="mx-auto aspect-square w-full max-w-80 rounded-xl bg-white [&>svg]:size-full"
          // The markup comes from the qrcode library, built from our own link.
          dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
        />
        <p className="font-mono text-sm break-all">{link}</p>
        <Button ref={closeRef} variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
