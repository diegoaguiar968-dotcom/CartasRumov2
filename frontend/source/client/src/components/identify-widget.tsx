import { useState, useEffect } from "react";
import { User } from "lucide-react";

const K_NOME = "arca-responsavel";
const K_AREA = "arca-area";

function get(k: string) {
  try {
    return localStorage.getItem(k) || "";
  } catch {
    return "";
  }
}
function set(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* noop */
  }
}

export function getResponsavel() {
  return { responsavel: get(K_NOME), area: get(K_AREA) };
}

export default function IdentifyWidget() {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [area, setArea] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNome(get(K_NOME));
    setArea(get(K_AREA));
  }, []);

  useEffect(() => {
    if (!open) return;
    set(K_NOME, nome.trim());
    set(K_AREA, area.trim());
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nome, area]);

  return (
    <div className="fixed left-4 bottom-4 z-50" style={{ fontFamily: "var(--font-body)" }}>
      {open && (
        <div
          className="mb-2 rounded-lg p-3 w-56 shadow-lg"
          style={{ background: "hsl(var(--surface-card))", border: "1px solid hsl(var(--border))" }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-wide mb-2"
            style={{ color: "hsl(var(--rumo-green))" }}
          >
            👤 Identificação
          </p>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome"
            className="w-full mb-1.5 px-2 py-1.5 rounded text-sm"
            style={{
              background: "hsl(var(--surface-app))",
              border: "1px solid hsl(var(--border))",
              color: "hsl(var(--text-primary))",
            }}
          />
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Sua área (opcional)"
            className="w-full px-2 py-1.5 rounded text-sm"
            style={{
              background: "hsl(var(--surface-app))",
              border: "1px solid hsl(var(--border))",
              color: "hsl(var(--text-primary))",
            }}
          />
          <p className="text-[11px] h-4 mt-1" style={{ color: "hsl(var(--rumo-green))" }}>
            {saved ? "Salvo ✓" : ""}
          </p>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-lg"
        style={{ background: "hsl(var(--rumo-green))", color: "white" }}
      >
        <User className="w-4 h-4" />
        {nome || "Identifique-se"}
      </button>
    </div>
  );
}
