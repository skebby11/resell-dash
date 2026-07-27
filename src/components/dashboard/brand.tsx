import { Disc3 } from "lucide-react";

export function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Disc3 className="size-5" strokeWidth={2.25} />
      </span>
      <div className="flex flex-col leading-none">
        <span className="font-display text-[1.35rem] italic leading-none tracking-tight text-foreground">
          Rewind
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Reselling Studio
        </span>
      </div>
    </div>
  );
}
