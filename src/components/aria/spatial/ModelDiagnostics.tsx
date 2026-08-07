import { Activity, AlertTriangle, CheckCircle2, Cpu, Link2, Loader2 } from "lucide-react";
import type { Model3DDiagnostics, Model3DResult } from "@/lib/aria/spatial/model3d";
import { cn } from "@/lib/utils";

interface Props {
  status: string;
  result: Model3DResult | null;
  diag: Model3DDiagnostics | null;
  error: string | null;
  busy?: boolean;
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-primary/10 py-1 last:border-0">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span
        className={cn(
          "truncate font-mono text-[10px]",
          ok === true ? "text-emerald-400" : ok === false ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Developer diagnostics for the 3D pipeline: provider status, timings, mesh + material health. */
export function ModelDiagnostics({ status, result, diag, error, busy }: Props) {
  return (
    <div className="space-y-2 rounded-lg border border-primary/25 bg-background/70 p-2">
      <div className="flex items-center gap-1.5 font-display text-[10px] uppercase tracking-[0.25em] text-primary">
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Cpu className="h-3 w-3" />} pipeline diagnostics
      </div>

      <Row label="stage" value={status} />
      <Row label="3d provider" value={result?.provider ?? "stability"} ok={error ? false : result ? true : null} />
      <Row label="prompt ai" value={result?.aiProvider ?? "openai"} />
      {result && (
        <>
          <Row label="format" value={result.format.toUpperCase()} ok />
          <Row label="size" value={`${(result.bytes / 1024 / 1024).toFixed(2)} MB`} />
          <Row label="quality" value={result.quality} />
          <Row label="total" value={`${(result.totalMs / 1000).toFixed(1)}s`} />
          {result.stages.map((s) => (
            <Row key={s.stage} label={s.stage} value={`${(s.ms / 1000).toFixed(1)}s`} />
          ))}
          <Row label="asset" value={result.path} />
        </>
      )}
      {diag && (
        <>
          <Row label="meshes" value={String(diag.meshes)} />
          <Row label="polygons" value={diag.triangles.toLocaleString()} />
          <Row label="materials" value={`${diag.materials} ${diag.materialsOk ? "ok" : "broken"}`} ok={diag.materialsOk} />
          <Row
            label="textures"
            value={diag.texturesOk ? `${diag.textures} loaded` : "none / vertex colour"}
            ok={diag.texturesOk}
          />
        </>
      )}
      {result?.enhancedPrompt && (
        <p className="rounded border border-primary/20 bg-primary/5 p-1.5 text-[10px] leading-relaxed text-muted-foreground">
          <span className="font-mono uppercase tracking-widest text-primary/70">enhanced · </span>
          {result.enhancedPrompt}
        </p>
      )}
      {result?.modelUrl && (
        <a
          href={result.modelUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[10px] text-primary underline-offset-2 hover:underline"
        >
          <Link2 className="h-3 w-3" /> open GLB asset
        </a>
      )}
      {error ? (
        <p className="flex items-start gap-1.5 rounded border border-destructive/40 bg-destructive/10 p-1.5 text-[10px] leading-relaxed text-destructive">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {error}
        </p>
      ) : result ? (
        <p className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400">
          <CheckCircle2 className="h-3 w-3" /> asset live in workspace
        </p>
      ) : (
        <p className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          <Activity className="h-3 w-3" /> awaiting generation
        </p>
      )}
    </div>
  );
}
