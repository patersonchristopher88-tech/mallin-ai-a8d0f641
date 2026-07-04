import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Wand2, Upload, X, Loader2, Download } from "lucide-react";
import { useRef, useState } from "react";
import { streamImage } from "@/lib/streamImage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "motion/react";

export const Route = createFileRoute("/_authenticated/edit")({
  ssr: false,
  head: () => ({ meta: [{ title: "Edit Image — ARIA" }] }),
  component: EditPage,
});

function EditPage() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [input, setInput] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onFile(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Choose an image");
    const reader = new FileReader();
    reader.onload = () => setInput(reader.result as string);
    reader.readAsDataURL(f);
    setOutput(null);
  }

  async function run() {
    if (!input || !prompt.trim() || busy) return;
    setBusy(true);
    setOutput(null);
    setIsFinal(false);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? null;
      await streamImage(
        "/api/edit-image",
        { imageDataUrl: input, prompt: prompt.trim() },
        token,
        (url, final) => {
          setOutput(url);
          if (final) setIsFinal(true);
        },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Edit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-0 max-w-3xl flex-1 flex-col px-4 py-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link
          to="/studio"
          className="grid h-10 w-10 place-items-center rounded-lg border border-primary/30 bg-card/60 text-primary"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <Wand2 className="h-5 w-5 text-primary" />
        <h1 className="font-display text-lg uppercase tracking-widest text-primary hud-text-glow">
          Edit Image
        </h1>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <div className="hud-corner relative aspect-square overflow-hidden rounded-xl border border-primary/25 bg-card/40">
          {input ? (
            <>
              <img src={input} alt="input" className="h-full w-full object-contain" />
              <button
                onClick={() => setInput(null)}
                className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-md bg-background/80 text-foreground"
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="grid h-full w-full place-items-center gap-2 text-muted-foreground"
            >
              <Upload className="h-6 w-6" />
              <span className="font-mono text-[11px] uppercase tracking-widest">Upload</span>
            </button>
          )}
        </div>

        <div className="hud-corner relative aspect-square overflow-hidden rounded-xl border border-primary/25 bg-card/40">
          {output ? (
            <motion.img
              key={output}
              src={output}
              alt="output"
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1, filter: isFinal ? "blur(0)" : "blur(14px)" }}
              transition={{ duration: 0.25 }}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              {busy ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <span className="font-mono text-[11px] uppercase tracking-widest">Result</span>
              )}
            </div>
          )}
          {output && isFinal && (
            <a
              href={output}
              download="edit.png"
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-md bg-background/80 text-foreground"
              aria-label="Download"
            >
              <Download className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the edit… e.g. 'add a neon Tokyo skyline behind the subject'"
          rows={2}
          className="flex-1 resize-none rounded-lg border border-primary/25 bg-card/40 px-3 py-2 text-sm focus:border-primary/60 focus:outline-none"
        />
        <button
          onClick={run}
          disabled={!input || !prompt.trim() || busy}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-primary bg-primary/15 text-primary disabled:opacity-40"
          aria-label="Run edit"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        </button>
      </div>

      <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Powered by Gemini 3.1 Flash Image · Nano Banana 2
      </p>
    </div>
  );
}
