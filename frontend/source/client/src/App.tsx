import { useState, useCallback, useRef } from "react";
import {
  Zap,
  Paperclip,
  Scale,
  ArrowRight,
  ArrowLeft,
  FileText,
  FileCheck,
  CheckCircle2,
  Loader2,
  Send,
  Download,
  Sparkles,
  Lightbulb,
} from "lucide-react";
import IdentifyWidget, { getResponsavel } from "./components/identify-widget";
import {
  getTemplates,
  uploadOficio,
  uploadComplementar,
  gerarMinuta,
  gerarCartaEspontanea,
  refinarMinuta,
  downloadDocx,
  type Template,
  type Briefing,
  type MinutaMeta,
} from "./lib/api";

// ── Fallback caso a API de templates não responda ──
const FALLBACK_TEMPLATES: Template[] = [
  {
    id: "objetiva",
    nome: "Resposta Objetiva",
    descricao: "Ideal para respostas curtas com 1 a 2 pontos. Tom direto, sem subdivisões.",
    uso: "1–2 pontos · resposta rápida",
  },
  {
    id: "documentacao",
    nome: "Resposta com Documentação",
    descricao: "Quando a resposta encaminha documentos como anexos ou inclui referências a arquivos.",
    uso: "anexos · encaminhamentos · documentos",
  },
  {
    id: "juridica",
    nome: "Resposta Jurídico-Regulatória",
    descricao: "Para respostas com fundamentação legal, citação de normas, resoluções ou cláusulas contratuais.",
    uso: "normas · contratos · fundamentação legal",
  },
];

const TEMPLATE_ICONS: Record<string, any> = {
  objetiva: Zap,
  documentacao: Paperclip,
  juridica: Scale,
};

const MALHA_OPTIONS = [
  { key: "norte", nome: "Rumo Malha Norte S.A.", sigla: "RMN" },
  { key: "paulista", nome: "Rumo Malha Paulista S.A.", sigla: "RMP" },
  { key: "oeste", nome: "Rumo Malha Oeste S.A.", sigla: "RMO" },
  { key: "sul", nome: "Rumo Malha Sul S.A.", sigla: "RMS" },
  { key: "central", nome: "Rumo Malha Central S.A.", sigla: "RMC" },
  { key: "rumo", nome: "RUMO S.A. (Holding)", sigla: "RUMO" },
];

type FlowType = "resposta" | "espontanea" | null;

const STEPS_RESPOSTA = [
  { number: 1, key: "modelos", label: "Modelos" },
  { number: 2, key: "oficio", label: "Ofício recebido" },
  { number: 3, key: "dados-resposta", label: "Dados da resposta" },
  { number: 4, key: "minuta", label: "Minuta gerada" },
  { number: 5, key: "ajuda", label: "Como usar" },
];

const STEPS_ESPONTANEA = [
  { number: 1, key: "modelos", label: "Modelos" },
  { number: 2, key: "dados-espontanea", label: "Dados da carta" },
  { number: 4, key: "minuta", label: "Minuta gerada" },
  { number: 5, key: "ajuda", label: "Como usar" },
];

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="info-card">
      <h2 className="font-semibold text-white text-[15px] mb-1">{title}</h2>
      <div style={{ color: "hsl(var(--text-muted))", fontSize: "13px", lineHeight: "1.6" }}>{children}</div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
      style={{
        background: disabled || loading ? "hsl(var(--muted))" : "hsl(var(--primary))",
        color: disabled || loading ? "hsl(var(--text-muted))" : "hsl(var(--primary-foreground))",
        cursor: disabled || loading ? "not-allowed" : "pointer",
      }}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
      style={{
        background: "hsl(var(--surface-card))",
        color: "hsl(var(--text-secondary))",
        border: "1px solid hsl(var(--border))",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: "hsl(var(--text-muted))" }}>
        {label} {required && <span style={{ color: "hsl(var(--destructive))" }}>*</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{
          background: "hsl(var(--surface-card))",
          border: "1px solid hsl(var(--border))",
          color: "hsl(var(--text-primary))",
        }}
      />
    </div>
  );
}

export default function App() {
  // ── Estado global do fluxo ──
  const [flowType, setFlowType] = useState<FlowType>(null);
  const [activeStepKey, setActiveStepKey] = useState("modelos");
  const [completedKeys, setCompletedKeys] = useState<Set<string>>(new Set());

  // ── Etapa 1: templates ──
  const [templates, setTemplates] = useState<Template[]>(FALLBACK_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

  // ── Etapa 2 (resposta): ofício ──
  const [oficioFile, setOficioFile] = useState<File | null>(null);
  const [uploadingOficio, setUploadingOficio] = useState(false);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const oficioInputRef = useRef<HTMLInputElement>(null);

  // ── Etapa 3 (resposta): pontos ──
  const [pontosRespostas, setPontosRespostas] = useState<Record<number, string>>({});

  // ── Etapa 2b (espontânea): dados ──
  const [destNome, setDestNome] = useState("");
  const [destCargo, setDestCargo] = useState("");
  const [destArea, setDestArea] = useState("");
  const [malhasSelecionadas, setMalhasSelecionadas] = useState<Set<string>>(new Set());
  const [referencia, setReferencia] = useState("");
  const [processo, setProcesso] = useState("");
  const [assunto, setAssunto] = useState("");
  const [docsRelacionados, setDocsRelacionados] = useState<string[]>([]);
  const docsInputRef = useRef<HTMLInputElement>(null);

  // ── Etapa 4: minuta ──
  const [minutaTexto, setMinutaTexto] = useState<string | null>(null);
  const [minutaMeta, setMinutaMeta] = useState<MinutaMeta | null>(null);
  const [gerandoMinuta, setGerandoMinuta] = useState(false);
  const [refinamentoMsg, setRefinamentoMsg] = useState("");
  const [refinando, setRefinando] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);
  const [numeroCarta, setNumeroCarta] = useState("0001");
  const [exportando, setExportando] = useState(false);

  const steps = flowType === "espontanea" ? STEPS_ESPONTANEA : STEPS_RESPOSTA;

  const loadTemplatesIfNeeded = useCallback(() => {
    if (templatesLoaded) return;
    setTemplatesLoaded(true);
    getTemplates()
      .then((r) => {
        if (r.templates?.length) setTemplates(r.templates);
      })
      .catch(() => {
        /* mantém fallback */
      });
  }, [templatesLoaded]);

  // dispara no primeiro render
  useState(() => {
    loadTemplatesIfNeeded();
  });

  function goTo(key: string) {
    setActiveStepKey(key);
  }

  function markCompleted(key: string) {
    setCompletedKeys((prev) => new Set(prev).add(key));
  }

  function escolherFluxo(tipo: FlowType) {
    setFlowType(tipo);
    markCompleted("modelos");
    goTo(tipo === "espontanea" ? "dados-espontanea" : "oficio");
  }

  async function handleUploadOficio(file: File) {
    setOficioFile(file);
    setUploadingOficio(true);
    try {
      const r = await uploadOficio(file);
      setBriefing(r.briefing);
      const inicial: Record<number, string> = {};
      r.briefing.pontos?.forEach((_, i) => (inicial[i] = ""));
      setPontosRespostas(inicial);
      markCompleted("oficio");
      goTo("dados-resposta");
    } catch (e: any) {
      alert(e.message || "Erro ao processar ofício.");
    } finally {
      setUploadingOficio(false);
    }
  }

  async function handleGerarMinutaResposta() {
    if (!briefing) return;
    setGerandoMinuta(true);
    try {
      const pontosRespondidos = briefing.pontos.map((ponto, i) => ({
        ponto,
        resposta: pontosRespostas[i] || "",
      }));
      const r = await gerarMinuta({ modeloId: selectedTemplate || "objetiva", briefing, pontosRespondidos });
      setMinutaTexto(r.minuta);
      setMinutaMeta(r.meta);
      setHistorico([]);
      markCompleted("dados-resposta");
      goTo("minuta");
    } catch (e: any) {
      alert(e.message || "Erro ao gerar minuta.");
    } finally {
      setGerandoMinuta(false);
    }
  }

  async function handleGerarCartaEspontanea() {
    setGerandoMinuta(true);
    try {
      const malha = Array.from(malhasSelecionadas).join(",");
      const r = await gerarCartaEspontanea({
        modeloId: selectedTemplate || "documentacao",
        destinatario: destNome,
        cargoDestinatario: destCargo,
        area: destArea,
        malha,
        referencia,
        processo,
        assunto,
      });
      setMinutaTexto(r.minuta);
      setMinutaMeta(r.meta);
      setHistorico([]);
      markCompleted("dados-espontanea");
      goTo("minuta");
    } catch (e: any) {
      alert(e.message || "Erro ao gerar carta.");
    } finally {
      setGerandoMinuta(false);
    }
  }

  async function handleRefinar() {
    if (!minutaTexto || !refinamentoMsg.trim()) return;
    setRefinando(true);
    try {
      const r = await refinarMinuta({
        textoAtual: minutaTexto,
        mensagem: refinamentoMsg,
        historico,
      });
      setMinutaTexto(r.texto);
      setHistorico((h) => [
        ...h,
        { role: "user", content: refinamentoMsg, minutaRef: minutaTexto },
        { role: "assistant", content: r.texto },
      ]);
      setRefinamentoMsg("");
    } catch (e: any) {
      alert(e.message || "Erro ao refinar minuta.");
    } finally {
      setRefinando(false);
    }
  }

  async function handleBaixarDocx() {
    if (!minutaTexto || !minutaMeta) return;
    setExportando(true);
    try {
      const { responsavel, area } = getResponsavel();
      await downloadDocx(numeroCarta, minutaTexto, {
        ...minutaMeta,
        responsavel,
        area,
      });
    } catch (e: any) {
      alert(e.message || "Erro ao gerar DOCX.");
    } finally {
      setExportando(false);
    }
  }

  function toggleMalha(key: string) {
    setMalhasSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const nomeArquivoPreview = () => {
    const ano = new Date().getFullYear();
    const siglas = MALHA_OPTIONS.filter((m) => malhasSelecionadas.has(m.key))
      .map((m) => m.sigla)
      .join(", ");
    return `${numeroCarta.padStart(4, "0")} - GREG - ${ano} - ${minutaMeta?.assunto || assunto || "Assunto"}${
      siglas ? ` - ${siglas}` : ""
    }`;
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(var(--surface-app))" }}>
      {/* ── Header ── */}
      <header className="border-b" style={{ borderColor: "hsl(var(--border))" }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "hsl(var(--primary))" }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="8" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <circle cx="8" cy="19" r="1.5" fill="white" stroke="none" />
              <circle cx="16" cy="19" r="1.5" fill="white" stroke="none" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-semibold text-white text-[17px] leading-tight">ARCA</h1>
              <span className="badge-active">ativo</span>
            </div>
            <p style={{ color: "hsl(var(--text-muted))", fontSize: "12px", marginTop: "1px" }}>
              Assistente de Redação de Cartas para ANTT
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <p style={{ color: "hsl(var(--text-muted))", fontSize: "12px" }}>Regulatório · Grupo Rumo</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-8 w-full">
        {/* ── Stepper ferroviário: vagões sobre trilhos ── */}
        <div className="relative mb-10" style={{ minHeight: "105px" }}>
          {/* Trilhos com dormentes */}
          <div
            style={{
              position: "absolute",
              left: "20px",
              right: "20px",
              bottom: "9px",
              height: "11px",
              pointerEvents: "none",
              zIndex: 0,
            }}
          >
            <div style={{ height: "3px", background: "hsl(var(--border) / 0.9)", borderRadius: "2px" }} />
            <div
              style={{
                height: "5px",
                backgroundImage:
                  "repeating-linear-gradient(90deg, transparent 0px, transparent 14px, hsl(210 30% 28% / 0.55) 14px, hsl(210 30% 28% / 0.55) 18px)",
              }}
            />
            <div style={{ height: "3px", background: "hsl(var(--border) / 0.9)", borderRadius: "2px" }} />
          </div>

          {/* Vagões */}
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", gap: "6px" }}>
            {steps.map((step) => {
              const ativo = activeStepKey === step.key;
              const concluido = completedKeys.has(step.key) && !ativo;
              const corBorda = ativo
                ? "hsl(var(--primary))"
                : concluido
                ? "hsl(var(--rumo-green) / 0.65)"
                : "hsl(var(--border))";
              const corFundo = ativo
                ? "hsl(var(--primary) / 0.13)"
                : concluido
                ? "hsl(var(--rumo-green) / 0.09)"
                : "hsl(var(--surface-card))";
              const corTexto = ativo
                ? "hsl(var(--primary))"
                : concluido
                ? "hsl(var(--rumo-green))"
                : "hsl(var(--text-muted))";
              const corRoda = ativo
                ? "hsl(var(--primary) / 0.55)"
                : concluido
                ? "hsl(var(--rumo-green) / 0.4)"
                : "hsl(var(--surface-hover))";
              const corRodaBorda = ativo
                ? "hsl(var(--primary))"
                : concluido
                ? "hsl(var(--rumo-green) / 0.8)"
                : "hsl(var(--border))";
              return (
                <button
                  key={step.key}
                  onClick={() => goTo(step.key)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  {/* Cabine da locomotiva — cresce sobre o vagão ativo */}
                  <div
                    style={{
                      height: ativo ? "15px" : "0px",
                      overflow: "hidden",
                      transition: "height 0.3s ease",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        width: "38%",
                        height: "15px",
                        background: "hsl(var(--primary))",
                        borderRadius: "5px 5px 0 0",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: "-7px",
                          left: "10px",
                          width: "7px",
                          height: "8px",
                          background: "hsl(var(--primary))",
                          borderRadius: "2px 2px 0 0",
                        }}
                      />
                    </div>
                  </div>

                  {/* Corpo do vagão */}
                  <div
                    style={{
                      width: "100%",
                      height: "62px",
                      background: corFundo,
                      border: `1.5px solid ${corBorda}`,
                      borderRadius: "6px 6px 3px 3px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      transition: "all 0.25s ease",
                      boxShadow: ativo ? "0 0 14px hsl(var(--primary) / 0.22)" : "none",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        color: corTexto,
                        transition: "color 0.25s",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {concluido ? (
                        <CheckCircle2 style={{ width: "14px", height: "14px", color: "hsl(var(--rumo-green))" }} />
                      ) : (
                        step.number.toString().padStart(2, "0")
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 500,
                        color: corTexto,
                        transition: "color 0.25s",
                        textAlign: "center",
                        lineHeight: 1.25,
                        padding: "0 5px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "100%",
                      }}
                    >
                      {step.label}
                    </span>
                  </div>

                  {/* Rodas */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      width: "calc(100% - 14px)",
                      marginTop: "-5px",
                    }}
                  >
                    {[0, 1].map((i) => (
                      <div
                        key={i}
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          background: corRoda,
                          border: `2px solid ${corRodaBorda}`,
                          transition: "all 0.25s",
                          flexShrink: 0,
                        }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══════ ETAPA 1 — Modelos/Templates ═══════ */}
        {activeStepKey === "modelos" && (
          <div className="space-y-4">
            <InfoCard title="Selecione o modelo de carta">
              Escolha o tipo de carta mais adequado para esta resposta. O modelo define a estrutura,
              o tom e a formatação do documento final gerado.
            </InfoCard>

            {templates.map((tpl) => {
              const Icon = TEMPLATE_ICONS[tpl.id] || FileText;
              const selected = selectedTemplate === tpl.id;
              return (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl.id)}
                  className="info-card w-full text-left transition-all flex items-start gap-4"
                  style={{
                    borderColor: selected ? "hsl(var(--primary))" : "hsl(var(--border))",
                    background: selected ? "hsl(var(--primary) / 0.08)" : "hsl(var(--surface-card))",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: selected ? "hsl(var(--primary))" : "hsl(var(--surface-hover))" }}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={{ color: selected ? "hsl(var(--primary-foreground))" : "hsl(var(--text-muted))" }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-white text-sm">{tpl.nome}</span>
                      {selected && (
                        <span className="text-xs font-medium" style={{ color: "hsl(var(--rumo-green))" }}>
                          ● selecionado
                        </span>
                      )}
                    </div>
                    <p style={{ color: "hsl(var(--text-muted))", fontSize: "13px", lineHeight: "1.5" }}>
                      {tpl.descricao}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <span style={{ color: "hsl(var(--text-muted))", fontSize: "12px" }}>Melhor para:</span>
                      {tpl.uso.split("·").map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded text-xs"
                          style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
                        >
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}

            <div className="flex justify-end gap-3 pt-2">
              <SecondaryButton disabled={!selectedTemplate} onClick={() => escolherFluxo("espontanea")}>
                Carta Espontânea <ArrowRight className="w-4 h-4" />
              </SecondaryButton>
              <PrimaryButton disabled={!selectedTemplate} onClick={() => escolherFluxo("resposta")}>
                Carta Resposta <ArrowRight className="w-4 h-4" />
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ═══════ ETAPA 2 (resposta) — Ofício recebido ═══════ */}
        {activeStepKey === "oficio" && (
          <div className="space-y-4">
            <InfoCard title="Ofício recebido da ANTT">
              Faça upload do PDF do ofício da ANTT. A IA irá extrair número, prazo, signatário e todos os
              pontos a serem atendidos.
            </InfoCard>

            <div className="upload-zone" onClick={() => oficioInputRef.current?.click()}>
              <input
                ref={oficioInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadOficio(f);
                  e.target.value = "";
                }}
              />
              {uploadingOficio ? (
                <>
                  <Loader2 className="upload-zone-icon animate-spin" />
                  <p className="font-medium text-white text-sm">Processando ofício com IA...</p>
                </>
              ) : (
                <>
                  <FileText className="upload-zone-icon" />
                  <p className="font-medium text-white text-sm">Clique para adicionar o ofício da ANTT</p>
                  <p style={{ color: "hsl(var(--text-muted))", fontSize: "12px" }}>PDF do ofício recebido</p>
                </>
              )}
            </div>

            {oficioFile && !uploadingOficio && (
              <div className="info-card flex items-center gap-3">
                <FileCheck className="w-4 h-4 flex-shrink-0" style={{ color: "hsl(var(--rumo-green))" }} />
                <span className="flex-1 text-sm text-white truncate">{oficioFile.name}</span>
              </div>
            )}

            <div className="flex justify-start pt-2">
              <SecondaryButton onClick={() => goTo("modelos")}>
                <ArrowLeft className="w-4 h-4" /> Voltar
              </SecondaryButton>
            </div>
          </div>
        )}

        {/* ═══════ ETAPA 3 (resposta) — Dados da resposta ═══════ */}
        {activeStepKey === "dados-resposta" && briefing && (
          <div className="space-y-4">
            <InfoCard title="Dados da resposta">
              Responda cada ponto identificado no ofício. A IA usará estas informações para redigir a
              minuta completa.
            </InfoCard>

            <div className="info-card space-y-1">
              <p className="text-xs font-semibold uppercase" style={{ color: "hsl(var(--text-muted))" }}>
                Ofício {briefing.numero}
              </p>
              <p style={{ color: "hsl(var(--text-secondary))", fontSize: "13px" }}>
                {briefing.signatarioAntt} · {briefing.area} · Prazo: {briefing.prazo}
              </p>
            </div>

            {briefing.pontos.map((ponto, i) => (
              <div key={i} className="info-card">
                <label className="block text-xs mb-1.5" style={{ color: "hsl(var(--text-muted))" }}>
                  Ponto {i + 1}
                </label>
                <p className="text-sm text-white mb-2">{ponto}</p>
                <textarea
                  value={pontosRespostas[i] || ""}
                  onChange={(e) => setPontosRespostas((p) => ({ ...p, [i]: e.target.value }))}
                  placeholder="Digite a resposta para este ponto..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-y"
                  style={{
                    background: "hsl(var(--surface-app))",
                    border: "1px solid hsl(var(--border))",
                    color: "hsl(var(--text-primary))",
                  }}
                />
              </div>
            ))}

            <div className="flex justify-between pt-2">
              <SecondaryButton onClick={() => goTo("oficio")}>
                <ArrowLeft className="w-4 h-4" /> Voltar
              </SecondaryButton>
              <PrimaryButton onClick={handleGerarMinutaResposta} loading={gerandoMinuta}>
                <Sparkles className="w-4 h-4" /> Gerar minuta
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ═══════ ETAPA 2b (espontânea) — Dados da carta ═══════ */}
        {activeStepKey === "dados-espontanea" && (
          <div className="space-y-4">
            <InfoCard title="Dados da carta">
              Preencha os dados do destinatário na ANTT e descreva o assunto. A IA redigirá a carta
              completa.
            </InfoCard>

            <div className="info-card space-y-3">
              <p className="text-xs font-semibold uppercase" style={{ color: "hsl(var(--primary))" }}>
                Destinatário (ANTT)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Nome" value={destNome} onChange={setDestNome} placeholder="Ex.: João da Silva" />
                <TextField
                  label="Cargo"
                  value={destCargo}
                  onChange={setDestCargo}
                  placeholder="Ex.: Superintendente de Fiscalização"
                />
              </div>
              <TextField
                label="Área / Superintendência"
                value={destArea}
                onChange={setDestArea}
                placeholder="Ex.: SUFER — Superintendência de Fiscalização e Regulação"
              />
            </div>

            <div className="info-card space-y-3">
              <p className="text-xs font-semibold uppercase" style={{ color: "hsl(var(--primary))" }}>
                Remetente e Referências
              </p>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "hsl(var(--text-muted))" }}>
                  Entidade(s) Rumo respondente(s) <span style={{ color: "hsl(var(--destructive))" }}>*</span>
                </label>
                <div
                  className="rounded-lg p-2 space-y-1"
                  style={{ background: "hsl(var(--surface-app))", border: "1px solid hsl(var(--border))" }}
                >
                  {MALHA_OPTIONS.map((m) => (
                    <label
                      key={m.key}
                      className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm"
                      style={{ color: "hsl(var(--text-secondary))" }}
                    >
                      <input
                        type="checkbox"
                        checked={malhasSelecionadas.has(m.key)}
                        onChange={() => toggleMalha(m.key)}
                      />
                      {m.nome}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Referência (opcional)"
                  value={referencia}
                  onChange={setReferencia}
                  placeholder="Ex.: Resolução nº 6.057/2024"
                />
                <TextField
                  label="Processo SEI (opcional)"
                  value={processo}
                  onChange={setProcesso}
                  placeholder="Ex.: 50505.018666/2026-59"
                />
              </div>
            </div>

            <div className="info-card">
              <label className="block text-xs mb-1.5" style={{ color: "hsl(var(--primary))" }}>
                ASSUNTO DA CARTA <span style={{ color: "hsl(var(--destructive))" }}>*</span>
              </label>
              <p className="mb-2" style={{ color: "hsl(var(--text-muted))", fontSize: "12px" }}>
                Descreva o que a carta precisa comunicar. Seja objetivo e forneça os dados e argumentos
                relevantes — a IA estruturará a carta completa a partir dessas informações.
              </p>
              <textarea
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                rows={4}
                placeholder="Ex.: Informar à ANTT sobre a conclusão das obras..."
                className="w-full px-3 py-2 rounded-lg text-sm resize-y"
                style={{
                  background: "hsl(var(--surface-app))",
                  border: "1px solid hsl(var(--border))",
                  color: "hsl(var(--text-primary))",
                }}
              />
            </div>

            <div className="info-card flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase" style={{ color: "hsl(var(--text-muted))" }}>
                  Documentos relacionados (opcional)
                </p>
                <p style={{ color: "hsl(var(--text-muted))", fontSize: "12px" }}>
                  Nota técnica, resolução ou qualquer doc que dê contexto adicional à IA
                </p>
              </div>
              <input
                ref={docsInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    await uploadComplementar(f);
                    setDocsRelacionados((d) => [...d, f.name]);
                  }
                  e.target.value = "";
                }}
              />
              <SecondaryButton onClick={() => docsInputRef.current?.click()}>
                <Paperclip className="w-4 h-4" /> Adicionar PDF
              </SecondaryButton>
            </div>

            <div className="flex justify-between pt-2">
              <SecondaryButton onClick={() => goTo("modelos")}>
                <ArrowLeft className="w-4 h-4" /> Voltar
              </SecondaryButton>
              <PrimaryButton
                disabled={!assunto.trim() || malhasSelecionadas.size === 0}
                loading={gerandoMinuta}
                onClick={handleGerarCartaEspontanea}
              >
                <Sparkles className="w-4 h-4" /> Gerar carta
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ═══════ ETAPA 4 — Minuta gerada ═══════ */}
        {activeStepKey === "minuta" && minutaTexto && (
          <div className="space-y-4">
            <InfoCard title="Minuta para aprovação">
              Revise o texto gerado. Após aprovação, exporte o arquivo Word pronto para revisão e envio.
            </InfoCard>

            <div className="info-card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase" style={{ color: "hsl(var(--primary))" }}>
                  Texto da minuta
                </p>
                <span className="text-xs font-medium" style={{ color: "hsl(var(--rumo-green))" }}>
                  ● gerada
                </span>
              </div>
              <textarea
                value={minutaTexto}
                onChange={(e) => setMinutaTexto(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 rounded-lg text-sm resize-y leading-relaxed"
                style={{
                  background: "hsl(var(--surface-app))",
                  border: "1px solid hsl(var(--border))",
                  color: "hsl(var(--text-primary))",
                }}
              />
            </div>

            <div className="info-card">
              <p className="text-xs font-semibold uppercase mb-2" style={{ color: "hsl(var(--text-muted))" }}>
                Refinamento com IA
              </p>
              <p className="mb-2" style={{ color: "hsl(var(--text-muted))", fontSize: "12px" }}>
                Converse com a IA para ajustar o texto. Ex.: "torne o 3º parágrafo mais objetivo".
              </p>
              <div className="flex gap-2">
                <input
                  value={refinamentoMsg}
                  onChange={(e) => setRefinamentoMsg(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRefinar()}
                  placeholder="Ex.: torne o segundo parágrafo mais formal..."
                  className="flex-1 px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: "hsl(var(--surface-app))",
                    border: "1px solid hsl(var(--border))",
                    color: "hsl(var(--text-primary))",
                  }}
                />
                <PrimaryButton onClick={handleRefinar} disabled={!refinamentoMsg.trim()} loading={refinando}>
                  <Send className="w-4 h-4" /> Enviar
                </PrimaryButton>
              </div>
            </div>

            <div className="info-card">
              <p className="text-xs font-semibold uppercase mb-2" style={{ color: "hsl(var(--text-muted))" }}>
                Número da carta
              </p>
              <div className="flex items-center gap-2 flex-wrap text-sm" style={{ color: "hsl(var(--text-secondary))" }}>
                <input
                  value={numeroCarta}
                  onChange={(e) => setNumeroCarta(e.target.value)}
                  className="w-16 px-2 py-1 rounded text-sm text-center"
                  style={{
                    background: "hsl(var(--surface-app))",
                    border: "1px solid hsl(var(--border))",
                    color: "hsl(var(--text-primary))",
                  }}
                />
                <span>{nomeArquivoPreview()}</span>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <SecondaryButton onClick={() => goTo(flowType === "espontanea" ? "dados-espontanea" : "dados-resposta")}>
                <ArrowLeft className="w-4 h-4" /> Voltar e ajustar
              </SecondaryButton>
              <PrimaryButton onClick={handleBaixarDocx} loading={exportando}>
                <Download className="w-4 h-4" /> Baixar .docx
              </PrimaryButton>
            </div>
          </div>
        )}

        {activeStepKey === "minuta" && !minutaTexto && (
          <InfoCard title="Nenhuma minuta gerada ainda">
            Volte à etapa anterior e preencha os dados para gerar a minuta.
          </InfoCard>
        )}

        {/* ═══════ ETAPA 5 — Como usar ═══════ */}
        {activeStepKey === "ajuda" && (
          <div className="space-y-5">
            <div className="info-card">
              <h2 className="font-semibold text-white text-[15px] mb-1">Como usar o ARCA</h2>
              <p style={{ color: "hsl(var(--text-muted))", fontSize: "13px", lineHeight: "1.6" }}>
                A ferramenta opera em dois modos:{" "}
                <strong className="text-white">Carta Resposta</strong> (quando a ANTT envia um ofício
                solicitando informações) e <strong className="text-white">Carta Espontânea</strong>{" "}
                (quando a Rumo toma a iniciativa de comunicação). Nos dois casos, a IA redige a minuta
                completa no padrão institucional Rumo e exporta o arquivo Word pronto para revisão.
              </p>
            </div>

            {/* ── Modo Carta Resposta ── */}
            <div className="info-card" style={{ borderColor: "hsl(var(--rumo-green) / 0.3)" }}>
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: "hsl(var(--rumo-green))" }}
              >
                Modo Carta Resposta (resposta a ofício)
              </p>
              <div className="space-y-3">
                {[
                  {
                    num: "1",
                    title: "Escolha o modelo de carta",
                    desc: "Selecione o tipo de carta adequado ao teor do ofício. O modelo define a estrutura, o tom e a formatação do documento final.",
                  },
                  {
                    num: "2",
                    title: "Faça upload do ofício recebido",
                    desc: "Envie o PDF do ofício da ANTT. A IA extrai automaticamente número, processo SEI, prazo, signatário, malha(s) envolvida(s) e todos os pontos que precisam de resposta.",
                  },
                  {
                    num: "2+",
                    title: "Adicione documentos complementares (opcional)",
                    desc: "Se o ofício vier acompanhado de nota técnica, resolução ou outro documento de referência, faça upload aqui. Esses arquivos enriquecem o contexto da IA mas não são listados individualmente na carta.",
                  },
                  {
                    num: "3",
                    title: "Forneça as respostas de mérito",
                    desc: "Preencha a resposta para cada ponto levantado no ofício. Seja preciso — apenas você detém as informações técnicas reais. A IA usa o que você escreveu para redigir a minuta.",
                  },
                  {
                    num: "4",
                    title: "Revise, refine e exporte",
                    desc: "Leia a minuta. Use o chat para solicitar ajustes pontuais sem regerar do zero. Informe o número interno da carta (ex: 0001) e exporte em .docx.",
                  },
                ].map((s) => (
                  <div key={s.num} className="flex gap-3">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                      style={{ background: "hsl(var(--rumo-green) / 0.12)", color: "hsl(var(--rumo-green))" }}
                    >
                      {s.num}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm mb-0.5">{s.title}</p>
                      <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--text-muted))" }}>
                        {s.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Modo Carta Espontânea ── */}
            <div className="info-card" style={{ borderColor: "hsl(var(--primary) / 0.3)" }}>
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: "hsl(var(--primary))" }}
              >
                Modo Carta Espontânea (comunicação proativa)
              </p>
              <div className="space-y-3">
                {[
                  {
                    num: "1",
                    title: "Escolha o modelo de carta",
                    desc: "Selecione o tipo de carta. Para comunicações proativas use preferencialmente o modelo Documentação ou Objetiva.",
                  },
                  {
                    num: "2",
                    title: "Preencha os dados da carta",
                    desc: "Informe destinatário, cargo e área na ANTT; marque a(s) malha(s) Rumo remetente(s) — pode ser mais de uma; descreva o assunto com os dados e argumentos relevantes; e, se houver, informe processo SEI e referência. Adicione documentos complementares para enriquecer o contexto da IA.",
                  },
                  {
                    num: "3",
                    title: "Revise, refine e exporte",
                    desc: "Revise a minuta gerada, use o chat para ajustes e exporte. Informe o número interno da carta antes de baixar o arquivo.",
                  },
                ].map((s) => (
                  <div key={s.num} className="flex gap-3">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                      style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
                    >
                      {s.num}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm mb-0.5">{s.title}</p>
                      <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--text-muted))" }}>
                        {s.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Modelos de carta ── */}
            <div className="info-card">
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: "hsl(var(--text-secondary))" }}
              >
                Os três modelos de carta
              </p>
              <div className="space-y-3">
                {[
                  {
                    icon: Zap,
                    nome: "Resposta Objetiva",
                    desc: "Para respostas curtas com 1 a 2 pontos. Tom direto, sem subdivisões — ideal para dilações de prazo, confirmações e comunicados simples.",
                  },
                  {
                    icon: Paperclip,
                    nome: "Resposta com Documentação",
                    desc: "Quando a carta encaminha documentos como anexos ou faz referência a arquivos. Inclui seção de documentos encaminhados ao final do corpo.",
                  },
                  {
                    icon: Scale,
                    nome: "Resposta Jurídico-Regulatória",
                    desc: "Para respostas com fundamentação legal, citação de normas, resoluções ANTT ou cláusulas contratuais. Estrutura com numeração romana e linguagem jurídica formal.",
                  },
                ].map((m) => (
                  <div key={m.nome} className="flex gap-3">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: "hsl(var(--surface-hover))" }}
                    >
                      <m.icon className="w-3.5 h-3.5" style={{ color: "hsl(var(--text-secondary))" }} />
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm mb-0.5">{m.nome}</p>
                      <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--text-muted))" }}>
                        {m.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Identificação e histórico ── */}
            <div className="info-card" style={{ borderColor: "hsl(var(--rumo-green) / 0.3)" }}>
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: "hsl(var(--rumo-green))" }}
              >
                Identificação e histórico compartilhado
              </p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ background: "hsl(var(--rumo-green) / 0.12)", color: "hsl(var(--rumo-green))" }}
                  >
                    👤
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm mb-0.5">Identifique-se (canto inferior esquerdo)</p>
                    <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--text-muted))" }}>
                      Preencha seu nome e área uma única vez. Cada carta que você baixar será registrada
                      automaticamente em seu nome no histórico da equipe.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ background: "hsl(var(--rumo-green) / 0.12)", color: "hsl(var(--rumo-green))" }}
                  >
                    🗂
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm mb-0.5">Histórico de cartas da equipe</p>
                    <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--text-muted))" }}>
                      Toda carta exportada fica registrada no{" "}
                      <a
                        href={`${(window as any).API_URL || ""}/historico`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "hsl(var(--primary))", textDecoration: "underline" }}
                      >
                        histórico compartilhado
                      </a>
                      , com filtros por responsável, malha e período. Em "Ver detalhes" os campos aparecem
                      na mesma ordem da lista do SharePoint, prontos para copiar — e é possível baixar
                      novamente o .docx de qualquer carta já gerada.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Boas práticas ── */}
            <div className="info-card">
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: "hsl(204 76% 65%)" }}
              >
                Boas práticas
              </p>
              <div className="space-y-2">
                {[
                  {
                    tip: "Respostas de mérito detalhadas geram minutas melhores.",
                    detail:
                      "Quanto mais contexto técnico você fornecer nos campos de resposta, menor a necessidade de refinamento posterior.",
                  },
                  {
                    tip: "Use o chat de refinamento para ajustes pontuais.",
                    detail:
                      'Exemplos: "Torne o 3º parágrafo mais objetivo", "Adicione menção ao prazo de 30 dias", "Remova a menção à resolução X".',
                  },
                  {
                    tip: "O texto da minuta também pode ser editado diretamente.",
                    detail:
                      "Além do chat, você pode clicar no texto e ajustar palavras ou frases manualmente antes de exportar.",
                  },
                  {
                    tip: "O número da carta é obrigatório antes de exportar.",
                    detail:
                      "Digite apenas os 4 dígitos do número sequencial. O arquivo será nomeado automaticamente como: 0001 - GREG - 2026 - Assunto - RMC.docx",
                  },
                  {
                    tip: "Documentos complementares são contexto, não conteúdo.",
                    detail:
                      "Notas técnicas e resoluções anexadas enriquecem a minuta indiretamente. A IA não os lista na carta — use-os para fundamentar argumentos.",
                  },
                  {
                    tip: "O arquivo exportado já está no padrão visual Rumo.",
                    detail:
                      "Revise o conteúdo no Word, salve como PDF quando precisar da versão final para envio.",
                  },
                ].map((s, n) => (
                  <div key={n} className="flex gap-2">
                    <Lightbulb
                      className="w-3.5 h-3.5 flex-shrink-0 mt-1"
                      style={{ color: "hsl(204 76% 65%)" }}
                    />
                    <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--text-muted))" }}>
                      <strong className="text-white">{s.tip}</strong> {s.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <SecondaryButton onClick={() => goTo("modelos")}>
              <ArrowLeft className="w-4 h-4" /> Voltar ao início
            </SecondaryButton>
          </div>
        )}
      </main>

      <IdentifyWidget />
    </div>
  );
}
