import { useState, useRef, useEffect, useMemo } from "react";

export interface AutocompleteOption {
  id: string;
  primary: string;
  secondary?: string;
  search: string; // texto usado para casar (será normalizado)
}

const norm = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/**
 * Campo de texto livre com sugestões abaixo. Digitar filtra; clicar (ou Enter)
 * seleciona. O texto continua editável — não obriga escolher da lista.
 */
export default function Autocomplete({
  value,
  onChangeText,
  onSelect,
  options,
  placeholder,
  maxResults = 8,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onSelect: (id: string) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  maxResults?: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtradas = useMemo(() => {
    const q = norm(value);
    if (!q) return [] as AutocompleteOption[];
    const termos = q.split(/\s+/).filter(Boolean);
    return options
      .filter((o) => {
        const s = norm(o.search);
        return termos.every((t) => s.includes(t));
      })
      .slice(0, maxResults);
  }, [value, options, maxResults]);

  useEffect(() => setDestaque(0), [value]);

  // fecha ao clicar fora
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const mostrar = aberto && filtradas.length > 0;

  function escolher(id: string) {
    onSelect(id);
    setAberto(false);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        value={value}
        onChange={(e) => {
          onChangeText(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={(e) => {
          if (!mostrar) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setDestaque((d) => Math.min(d + 1, filtradas.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setDestaque((d) => Math.max(d - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            escolher(filtradas[destaque].id);
          } else if (e.key === "Escape") {
            setAberto(false);
          }
        }}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{
          background: "hsl(var(--surface-card))",
          border: "1px solid hsl(var(--border))",
          color: "hsl(var(--text-primary))",
        }}
      />
      {mostrar && (
        <div
          className="arca-fade"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 40,
            background: "hsl(var(--surface-panel))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "10px",
            boxShadow: "0 12px 32px hsl(210 100% 4% / 0.45)",
            overflow: "hidden",
            maxHeight: "280px",
            overflowY: "auto",
          }}
        >
          {filtradas.map((o, i) => (
            <button
              key={o.id}
              // onMouseDown para não perder o clique com o blur do input
              onMouseDown={(e) => {
                e.preventDefault();
                escolher(o.id);
              }}
              onMouseEnter={() => setDestaque(i)}
              className="w-full text-left"
              style={{
                display: "block",
                padding: "8px 12px",
                background: i === destaque ? "hsl(var(--surface-hover))" : "transparent",
                border: "none",
                borderBottom: "1px solid hsl(var(--border) / 0.4)",
                cursor: "pointer",
              }}
            >
              <div className="text-sm" style={{ color: "hsl(var(--text-primary))" }}>
                {o.primary}
              </div>
              {o.secondary && (
                <div className="text-xs" style={{ color: "hsl(var(--text-muted))", marginTop: "1px" }}>
                  {o.secondary}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
