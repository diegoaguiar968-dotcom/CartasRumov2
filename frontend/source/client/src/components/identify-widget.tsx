import { useState, useEffect } from "react";
import { User } from "lucide-react";

const K_NOME = "arca-responsavel";
const K_AREA = "arca-area";
const K_EMAIL = "arca-email";

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
  return { responsavel: get(K_NOME), area: get(K_AREA), email: get(K_EMAIL) };
}

export default function IdentifyWidget() {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [area, setArea] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNome(get(K_NOME));
    setArea(get(K_AREA));
    setEmail(get(K_EMAIL));
  }, []);

  useEffect(() => {
    if (!open) return;
    set(K_NOME, nome.trim());
    set(K_AREA, area.trim());
    set(K_EMAIL, email.trim());
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nome, area, email]);

  const inputStyle = {
    background: "hsl(var(--surface-app))",
    border: "1px solid hsl(var(--border))",
    color: "hsl(var(--text-primary))",
  };

  return (
    <div className="fixed left-4 bottom-4 z-50" style={{ fontFamily: "var(--font-body)" }}>
      {open && (
        <div
          className="mb-2 rounded-lg p-3 w-60 shadow-lg"
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
            style={inputStyle}
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Seu e-mail corporativo"
            type="email"
            className="w-full mb-1.5 px-2 py-1.5 rounded text-sm"
            style={inputStyle}
          />
          <input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Sua área (opcional)"
            className="w-full px-2 py-1.5 rounded text-sm"
            style={inputStyle}
          />
          <p className="text-[11px] mt-1.5" style={{ color: "hsl(var(--text-muted))", lineHeight: 1.4 }}>
            O e-mail preenche o campo "Responsável" ao registrar no SharePoint.
          </p>
          <p className="text-[11px] h-4" style={{ color: "hsl(var(--rumo-green))" }}>
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
