import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { cx } from "./ui";

/** Área clicável para escolher foto, com preview e botão de remover. */
export function ImagePicker({
  url,
  onPick,
  onRemove,
  size = 96,
  label = "Foto",
  hex,
}: {
  url: string | null | undefined;
  onPick: (f: File) => void;
  onRemove?: () => void;
  size?: number;
  label?: string;
  hex?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        title="Clique para escolher uma foto"
        className={cx(
          "group flex h-full w-full items-center justify-center overflow-hidden rounded-lg border bg-ink/60 cursor-pointer transition-colors",
          url ? "border-line" : "border-dashed border-line hover:border-accent",
        )}
      >
        {url ? (
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-[10px] text-muted group-hover:text-accent">
            <ImagePlus className="size-5" />
            {size >= 72 && label}
          </span>
        )}
        {hex && <span className="absolute bottom-1 left-1 size-3 rounded-full border border-white/60" style={{ background: hex }} />}
      </button>
      {url && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="Remover foto"
          className="absolute -top-2 -right-2 rounded-full border border-line bg-surface p-0.5 text-muted hover:text-danger cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
