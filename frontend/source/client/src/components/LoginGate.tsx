import { useState } from "react";
import { User, Mail, Building2, ArrowRight } from "lucide-react";
import { AREA_OPCOES, getResponsavel, setResponsavel } from "./identify-widget";

/**
 * Tela de identificação exibida antes de liberar o ARCA. Coleta nome, e-mail
 * e área — os mesmos dados do widget do canto (compartilham o localStorage).
 * Ao concluir, chama `onConcluir`, e o app passa a renderizar normalmente com
 * o widget recolhido no canto inferior esquerdo.
 */
export default function LoginGate({ onConcluir }: { onConcluir: () => void }) {
  const inicial = getResponsavel();
  const [nome, setNome] = useState(inicial.responsavel);
  const [email, setEmail] = useState(inicial.email);
  const [area, setArea] = useState(inicial.area);
  const [erro, setErro] = useState("");

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const podeEntrar = nome.trim().length >= 2 && emailValido && !!area;

  function entrar() {
    if (!podeEntrar) {
      setErro(
        nome.trim().length < 2
          ? "Informe seu nome."
          : !emailValido
            ? "Informe um e-mail válido."
            : "Selecione sua área."
      );
      return;
    }
    setResponsavel({ nome, area, email });
    onConcluir();
  }

  const inputStyle = {
    background: "hsl(var(--surface-app))",
    border: "1px solid hsl(var(--border))",
    color: "hsl(var(--text-primary))",
  };
  const labelStyle = { color: "hsl(var(--text-muted))" };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "hsl(var(--surface-app))", fontFamily: "var(--font-body)" }}
    >
      <div
        className="arca-fade w-full max-w-md rounded-2xl p-8"
        style={{
          background: "hsl(var(--surface-card))",
          border: "1px solid hsl(var(--border))",
          boxShadow: "0 24px 60px hsl(210 100% 4% / 0.5)",
        }}
      >
        {/* Marca */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "hsl(var(--primary))" }}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="8" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <circle cx="8" cy="19" r="1.5" fill="white" stroke="none" />
              <circle cx="16" cy="19" r="1.5" fill="white" stroke="none" />
            </svg>
          </div>
          <div>
            <h1 className="font-semibold text-white text-lg leading-tight">ARCA</h1>
            <p style={{ color: "hsl(var(--text-muted))", fontSize: "12px" }}>
              Assistente de Redação de Cartas para ANTT
            </p>
          </div>
        </div>

        <p className="text-white font-medium mb-1">Identifique-se para começar</p>
        <p className="text-sm mb-6" style={{ color: "hsl(var(--text-muted))", lineHeight: 1.5 }}>
          Seus dados identificam quem gerou cada carta e preenchem o responsável ao registrar no SharePoint.
        </p>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs mb-1.5" style={labelStyle}>
              <User className="w-3.5 h-3.5" /> Nome
            </label>
            <input
              autoFocus
              value={nome}
              onChange={(e) => { setNome(e.target.value); setErro(""); }}
              onKeyDown={(e) => e.key === "Enter" && entrar()}
              placeholder="Seu nome completo"
              className="w-full px-3 py-2.5 rounded-lg text-sm"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs mb-1.5" style={labelStyle}>
              <Mail className="w-3.5 h-3.5" /> E-mail corporativo
            </label>
            <input
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErro(""); }}
              onKeyDown={(e) => e.key === "Enter" && entrar()}
              placeholder="nome@rumolog.com"
              type="email"
              className="w-full px-3 py-2.5 rounded-lg text-sm"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs mb-1.5" style={labelStyle}>
              <Building2 className="w-3.5 h-3.5" /> Área
            </label>
            <select
              value={area}
              onChange={(e) => { setArea(e.target.value); setErro(""); }}
              className="w-full px-3 py-2.5 rounded-lg text-sm"
              style={inputStyle}
            >
              <option value="">Selecione sua área…</option>
              {AREA_OPCOES.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        {erro && (
          <p className="text-sm mt-4" style={{ color: "hsl(0 70% 68%)" }}>{erro}</p>
        )}

        <button
          onClick={entrar}
          disabled={!podeEntrar}
          className="w-full mt-6 flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-opacity"
          style={{
            background: podeEntrar ? "hsl(var(--rumo-green))" : "hsl(var(--surface-raised))",
            color: podeEntrar ? "white" : "hsl(var(--text-muted))",
            cursor: podeEntrar ? "pointer" : "not-allowed",
          }}
        >
          Entrar <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
