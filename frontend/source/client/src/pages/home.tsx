import { useState, useRef, useCallback } from "react";
import {
  Upload, FileText, CheckCircle2, ChevronRight, X, ArrowRight,
  FileCheck, MessageSquareText, Sparkles, Download, Loader2, AlertCircle
} from "lucide-react";
import { uploadModels, analyzeModels, uploadOficio, generateMinuta, downloadDocx, downloadPdf } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const STEPS = [
  { number: 1, label: "Modelos" },
  { number: 2, label: "Ofício recebido" },
  { number: 3, label: "Dados da resposta" },
  { number: 4, label: "Minuta gerada" },
  { number: 5, label: "Como usar" },
];

interface UploadedFile {
  name: string;
  size: number;
  nativeFile: File;
}

export default function HomePage() {
  const [activeStep, setActiveStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  // Step 1
  const [modelFiles, setModelFiles] = useState<UploadedFile[]>([]);
  const [uploadingModels, setUploadingModels] = useState(false);
  const [analyzingModels, setAnalyzingModels] = useState(false);
  const [modelPatterns, setModelPatterns] = useState<string | null>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  // Step 2
  const [oficioFile, setOficioFile] = useState<UploadedFile | null>(null);
  const [uploadingOficio, setUploadingOficio] = useState(false);
  const [briefing, setBriefing] = useState<any>(null);
  const oficioInputRef = useRef<HTMLInputElement>(null);

  // Step 3
  const [signatario, setSignatario] = useState("");
  const [cargo, setCargo] = useState("");
  const [pontos, setPontos] = useState([{ id: 1, pergunta: "", resposta: "" }]);
  const [generatingMinuta, setGeneratingMinuta] = useState(false);

  // Step 4
  const [minutaText, setMinutaText] = useState<string | null>(null);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Drag state
  const [dragOver, setDragOver] = useState(false);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const markComplete = (step: number) => setCompletedSteps(prev => new Set([...prev, step]));

  // ── Step 1: Model upload + analyze ──
  const handleModelFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const pdfs = Array.from(files).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"));
    setModelFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      const newFiles = pdfs.filter(f => !names.has(f.name)).map(f => ({
        name: f.name,
        size: f.size,
        nativeFile: f,
      }));
      return [...prev, ...newFiles];
    });
  }, []);

  const removeModelFile = (name: string) => setModelFiles(prev => prev.filter(f => f.name !== name));

  const processModels = async () => {
    if (modelFiles.length === 0) return;
    try {
      setUploadingModels(true);
      await uploadModels(modelFiles.map(f => f.nativeFile));
      setUploadingModels(false);

      setAnalyzingModels(true);
      const result = await analyzeModels();
      setModelPatterns(result.patterns);
      setAnalyzingModels(false);

      markComplete(1);
      setActiveStep(2);
      toast({ title: "Modelos processados", description: `${modelFiles.length} carta(s) analisada(s) com sucesso.` });
    } catch (err: any) {
      setUploadingModels(false);
      setAnalyzingModels(false);
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // ── Step 2: Ofício upload ──
  const handleOficioFile = useCallback((files: FileList | null) => {
    if (!files || !files[0]) return;
    const f = files[0];
    setOficioFile({ name: f.name, size: f.size, nativeFile: f });
  }, []);

  const processOficio = async () => {
    if (!oficioFile) return;
    try {
      setUploadingOficio(true);
      const result = await uploadOficio(oficioFile.nativeFile);
      setBriefing(result.briefing);
      setUploadingOficio(false);

      // Pre-fill pontos from briefing
      if (result.briefing.pontos && result.briefing.pontos.length > 0) {
        setPontos(result.briefing.pontos.map((p: string, i: number) => ({
          id: i + 1,
          pergunta: p,
          resposta: "",
        })));
      }

      markComplete(2);
      setActiveStep(3);
      toast({ title: "Ofício analisado", description: "Briefing extraído. Preencha os dados para a resposta." });
    } catch (err: any) {
      setUploadingOficio(false);
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // ── Step 3: Generate minuta ──
  const handleGenerateMinuta = async () => {
    try {
      setGeneratingMinuta(true);
      const result = await generateMinuta({
        signatario,
        cargo,
        pontos: pontos.map(p => ({ pergunta: p.pergunta, resposta: p.resposta })),
      });
      setMinutaText(result.minuta);
      setGeneratingMinuta(false);
      markComplete(3);
      setActiveStep(4);
      toast({ title: "Minuta gerada", description: "Revise o texto antes de exportar." });
    } catch (err: any) {
      setGeneratingMinuta(false);
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // ── Step 4: Export ──
  const handleExportDocx = async () => {
    try {
      setExportingDocx(true);
      await downloadDocx(signatario, cargo);
      setExportingDocx(false);
      toast({ title: "DOCX gerado", description: "Download iniciado." });
    } catch (err: any) {
      setExportingDocx(false);
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleExportPdf = async () => {
    try {
      setExportingPdf(true);
      await downloadPdf(signatario, cargo);
      setExportingPdf(false);
      toast({ title: "PDF gerado", description: "Download iniciado." });
    } catch (err: any) {
      setExportingPdf(false);
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const isLoading = uploadingModels || analyzingModels || uploadingOficio || generatingMinuta;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "hsl(var(--surface-app))" }}>

      {/* ── Header ── */}
      <header
        className="border-b"
        style={{ background: "hsl(var(--surface-panel))", borderColor: "hsl(var(--border))" }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0"
            style={{ background: "hsl(var(--primary))" }}
          >
            <svg viewBox="0 0 40 40" width="40" height="40" aria-label="Rumo Logística">
              <rect width="40" height="40" rx="8" fill="hsl(var(--primary))" />
              <path d="M10 10h10c4 0 7 2.5 7 6s-3 6-7 6l7 8H23l-6.5-8H14v8H10V10zm4 4v6h6c1.8 0 3-1.1 3-3s-1.2-3-3-3h-6z" fill="white" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-semibold text-white text-[15px] leading-tight">
                Agente Rumo — Respostas à ANTT
              </h1>
              <span className="badge-active">ativo</span>
            </div>
            <p style={{ color: "hsl(var(--text-muted))", fontSize: "12px", marginTop: "2px" }}>
              Relações Institucionais / Regulatório · Geração de ofícios com padrão Rumo
            </p>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-8 w-full">

        {/* ── Step Navigation ── */}
        <div className="flex gap-2 mb-8">
          {STEPS.map(step => (
            <button
              key={step.number}
              className={`step-pill ${activeStep === step.number ? "active" : ""} ${completedSteps.has(step.number) ? "completed" : ""}`}
              onClick={() => setActiveStep(step.number)}
              data-testid={`step-${step.number}`}
            >
              <span className="step-number">
                {completedSteps.has(step.number) ? (
                  <CheckCircle2 className="w-6 h-6" style={{ color: "hsl(var(--rumo-green))" }} />
                ) : step.number}
              </span>
              <span className="step-label">{step.label}</span>
            </button>
          ))}
        </div>

        {/* ── Loading overlay ── */}
        {isLoading && (
          <div className="mb-6 info-card flex items-center gap-3" style={{ borderColor: "hsl(var(--primary) / 0.4)" }}>
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "hsl(var(--primary))" }} />
            <span className="text-sm" style={{ color: "hsl(var(--text-secondary))" }}>
              {uploadingModels && "Enviando PDFs dos modelos..."}
              {analyzingModels && "Analisando padrões com IA... Isso pode levar até 30s."}
              {uploadingOficio && "Processando ofício da ANTT com IA..."}
              {generatingMinuta && "Gerando minuta da resposta com IA... Isso pode levar até 60s."}
            </span>
          </div>
        )}

        {/* ─────── STEP 1 ─────── */}
        {activeStep === 1 && (
          <div className="space-y-5">
            <div className="info-card">
              <h2 className="font-semibold text-white text-[15px] mb-1">
                Base de modelos (cartas anteriores enviadas à ANTT)
              </h2>
              <p style={{ color: "hsl(var(--text-muted))", fontSize: "13px", lineHeight: "1.6" }}>
                Faça upload dos PDFs de cartas já enviadas pela Rumo. A IA aprenderá o padrão visual,
                o tom jurídico-institucional e a estrutura de cada tipo de resposta.
              </p>
            </div>

            <div
              className={`upload-zone ${dragOver ? "drag-over" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleModelFiles(e.dataTransfer.files); }}
              onClick={() => modelInputRef.current?.click()}
              data-testid="upload-zone-models"
            >
              <input ref={modelInputRef} type="file" accept=".pdf" multiple className="hidden"
                onChange={e => { handleModelFiles(e.target.files); e.target.value = ""; }}
                data-testid="input-models"
              />
              <FileText className="upload-zone-icon" />
              <p className="font-medium text-white text-sm">Clique para adicionar PDFs de modelos</p>
              <p style={{ color: "hsl(var(--text-muted))", fontSize: "12px" }}>
                Cartas já enviadas à ANTT · múltiplos arquivos aceitos
              </p>
            </div>

            {modelFiles.length > 0 && (
              <div className="info-card space-y-3">
                <p className="text-xs font-semibold" style={{ color: "hsl(var(--text-muted))", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {modelFiles.length} arquivo{modelFiles.length > 1 ? "s" : ""} selecionado{modelFiles.length > 1 ? "s" : ""}
                </p>
                {modelFiles.map(f => (
                  <div key={f.name} className="flex items-center gap-3">
                    <FileCheck className="w-4 h-4 flex-shrink-0" style={{ color: "hsl(var(--rumo-green))" }} />
                    <span className="flex-1 text-sm text-white truncate">{f.name}</span>
                    <span className="text-xs" style={{ color: "hsl(var(--text-muted))" }}>{formatSize(f.size)}</span>
                    <button onClick={() => removeModelFile(f.name)} className="ml-1 hover:text-red-400 transition-colors"
                      style={{ color: "hsl(var(--text-muted))" }}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {modelPatterns && (
              <div className="info-card space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--rumo-green))" }}>
                  Padrões identificados
                </p>
                <pre className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "hsl(var(--text-secondary))", fontFamily: "var(--font-body)" }}>
                  {modelPatterns}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={processModels} disabled={modelFiles.length === 0 || isLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: modelFiles.length === 0 || isLoading ? "hsl(var(--muted))" : "hsl(var(--primary))",
                  color: modelFiles.length === 0 || isLoading ? "hsl(var(--text-muted))" : "hsl(var(--primary-foreground))",
                  cursor: modelFiles.length === 0 || isLoading ? "not-allowed" : "pointer",
                }}
                data-testid="btn-process-models"
              >
                {(uploadingModels || analyzingModels) ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {completedSteps.has(1) ? "Reprocessar modelos" : "Processar e avançar"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─────── STEP 2 ─────── */}
        {activeStep === 2 && (
          <div className="space-y-5">
            <div className="info-card">
              <h2 className="font-semibold text-white text-[15px] mb-1">Ofício recebido da ANTT</h2>
              <p style={{ color: "hsl(var(--text-muted))", fontSize: "13px", lineHeight: "1.6" }}>
                Faça upload do PDF do ofício da ANTT. A IA irá extrair número, prazo, signatário e todos os pontos a serem atendidos.
              </p>
            </div>

            <div
              className={`upload-zone ${dragOver ? "drag-over" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleOficioFile(e.dataTransfer.files); }}
              onClick={() => oficioInputRef.current?.click()}
              data-testid="upload-zone-oficio"
            >
              <input ref={oficioInputRef} type="file" accept=".pdf" className="hidden"
                onChange={e => { handleOficioFile(e.target.files); e.target.value = ""; }}
                data-testid="input-oficio"
              />
              <FileText className="upload-zone-icon" />
              <p className="font-medium text-white text-sm">Clique para adicionar o ofício da ANTT</p>
              <p style={{ color: "hsl(var(--text-muted))", fontSize: "12px" }}>Apenas um arquivo PDF</p>
            </div>

            {oficioFile && !briefing && (
              <div className="info-card flex items-center gap-3">
                <FileCheck className="w-5 h-5 flex-shrink-0" style={{ color: "hsl(var(--rumo-green))" }} />
                <span className="flex-1 text-sm text-white truncate">{oficioFile.name}</span>
                <span className="text-xs" style={{ color: "hsl(var(--text-muted))" }}>{formatSize(oficioFile.size)}</span>
              </div>
            )}

            {briefing && (
              <div className="info-card space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--rumo-green))" }}>
                    Briefing extraído
                  </p>
                  <span className="badge-active">pronto</span>
                </div>
                <div className="space-y-2 text-sm" style={{ color: "hsl(var(--text-secondary))" }}>
                  {[
                    ["Número/Referência", briefing.numero],
                    ["Data", briefing.data],
                    ["Signatário ANTT", briefing.signatarioAntt],
                    ["Área", briefing.area],
                    ["Prazo", briefing.prazo],
                    ["Natureza", briefing.natureza],
                    ["Fundamento legal", briefing.fundamentoLegal],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex gap-3">
                      <span className="font-medium w-40 flex-shrink-0" style={{ color: "hsl(var(--text-muted))" }}>{label}:</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
                {briefing.pontos && briefing.pontos.length > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid hsl(var(--border))" }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: "hsl(var(--primary))" }}>PONTOS A RESPONDER:</p>
                    <ol className="space-y-1 text-sm list-decimal list-inside" style={{ color: "hsl(var(--text-secondary))" }}>
                      {briefing.pontos.map((p: string, i: number) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2 gap-3">
              {!briefing && oficioFile && (
                <button onClick={processOficio} disabled={isLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                  data-testid="btn-process-oficio"
                >
                  {uploadingOficio ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Analisar ofício
                  <Sparkles className="w-4 h-4" />
                </button>
              )}
              {briefing && (
                <button onClick={() => { markComplete(2); setActiveStep(3); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                  data-testid="btn-advance-step2"
                >
                  Próximo: Dados da resposta
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─────── STEP 3 ─────── */}
        {activeStep === 3 && (
          <div className="space-y-5">
            <div className="info-card">
              <h2 className="font-semibold text-white text-[15px] mb-1">Dados da resposta</h2>
              <p style={{ color: "hsl(var(--text-muted))", fontSize: "13px", lineHeight: "1.6" }}>
                {briefing
                  ? "Os pontos do ofício foram pré-preenchidos. Informe os dados de conteúdo para redigir a resposta."
                  : "Informe os dados de conteúdo para cada ponto levantado no ofício da ANTT."}
              </p>
            </div>

            {/* Signatário */}
            <div className="info-card space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--primary))" }}>
                Dados do signatário
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "hsl(var(--text-muted))" }}>Nome completo</label>
                  <input type="text" value={signatario} onChange={e => setSignatario(e.target.value)}
                    placeholder="Ex.: João da Silva"
                    className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none transition-all"
                    style={{ background: "hsl(var(--surface-hover))", border: "1px solid hsl(var(--border))", fontFamily: "var(--font-body)" }}
                    onFocus={e => e.target.style.borderColor = "hsl(204, 76%, 55%)"}
                    onBlur={e => e.target.style.borderColor = "hsl(210, 30%, 28%)"}
                    data-testid="input-signatario"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium" style={{ color: "hsl(var(--text-muted))" }}>Cargo / Área</label>
                  <input type="text" value={cargo} onChange={e => setCargo(e.target.value)}
                    placeholder="Ex.: Diretor de Relações Institucionais"
                    className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none transition-all"
                    style={{ background: "hsl(var(--surface-hover))", border: "1px solid hsl(var(--border))", fontFamily: "var(--font-body)" }}
                    onFocus={e => e.target.style.borderColor = "hsl(204, 76%, 55%)"}
                    onBlur={e => e.target.style.borderColor = "hsl(210, 30%, 28%)"}
                    data-testid="input-cargo"
                  />
                </div>
              </div>
            </div>

            {/* Pontos */}
            <div className="info-card space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--primary))" }}>
                Pontos a responder
              </p>
              {pontos.map((ponto, idx) => (
                <div key={ponto.id} className="space-y-2 pb-4"
                  style={{ borderBottom: idx < pontos.length - 1 ? "1px solid hsl(var(--border))" : "none" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-white">Ponto {idx + 1}</p>
                    {pontos.length > 1 && (
                      <button onClick={() => setPontos(prev => prev.filter((_, i) => i !== idx))}
                        className="text-xs hover:text-red-400" style={{ color: "hsl(var(--text-muted))" }}>
                        Remover
                      </button>
                    )}
                  </div>
                  <input type="text" value={ponto.pergunta}
                    onChange={e => setPontos(prev => prev.map((p, i) => i === idx ? { ...p, pergunta: e.target.value } : p))}
                    placeholder="Pergunta/solicitação da ANTT"
                    className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                    style={{ background: "hsl(var(--surface-hover))", border: "1px solid hsl(var(--border))", fontFamily: "var(--font-body)" }}
                    data-testid={`input-pergunta-${ponto.id}`}
                  />
                  <textarea rows={3} value={ponto.resposta}
                    onChange={e => setPontos(prev => prev.map((p, i) => i === idx ? { ...p, resposta: e.target.value } : p))}
                    placeholder="Informe os dados, argumentos e informações para responder este ponto..."
                    className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none resize-none"
                    style={{ background: "hsl(var(--surface-hover))", border: "1px solid hsl(var(--border))", fontFamily: "var(--font-body)" }}
                    data-testid={`textarea-resposta-${ponto.id}`}
                  />
                </div>
              ))}
              <button
                onClick={() => setPontos(prev => [...prev, { id: prev.length + 1, pergunta: "", resposta: "" }])}
                className="text-sm font-medium transition-colors"
                style={{ color: "hsl(var(--primary))" }}
                data-testid="btn-add-ponto"
              >
                + Adicionar ponto
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={handleGenerateMinuta} disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: isLoading ? "hsl(var(--muted))" : "hsl(var(--primary))",
                  color: isLoading ? "hsl(var(--text-muted))" : "hsl(var(--primary-foreground))",
                  cursor: isLoading ? "not-allowed" : "pointer",
                }}
                data-testid="btn-generate-minuta"
              >
                {generatingMinuta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Gerar minuta
              </button>
            </div>
          </div>
        )}

        {/* ─────── STEP 4 ─────── */}
        {activeStep === 4 && (
          <div className="space-y-5">
            <div className="info-card">
              <h2 className="font-semibold text-white text-[15px] mb-1">Minuta para aprovação</h2>
              <p style={{ color: "hsl(var(--text-muted))", fontSize: "13px", lineHeight: "1.6" }}>
                Revise o texto gerado. Após aprovação, gere os arquivos Word e PDF para envio.
              </p>
            </div>

            <div className="info-card space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--primary))" }}>
                  Texto da minuta
                </p>
                {minutaText && <span className="badge-active">gerada</span>}
              </div>
              <div
                className="rounded-lg p-5 text-sm leading-relaxed overflow-auto max-h-[500px]"
                style={{
                  background: "hsl(var(--surface-hover))",
                  border: "1px solid hsl(var(--border))",
                  color: "hsl(var(--text-secondary))",
                  fontFamily: "var(--font-body)",
                  whiteSpace: "pre-wrap",
                }}
                data-testid="minuta-preview"
              >
                {minutaText || (
                  <p className="italic" style={{ color: "hsl(var(--text-muted))" }}>
                    Nenhuma minuta gerada ainda. Volte à Etapa 3 para gerar.
                  </p>
                )}
              </div>
            </div>

            {minutaText && (
              <div className="flex justify-end pt-2 gap-3">
                <button onClick={() => setActiveStep(3)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: "hsl(var(--muted))", color: "hsl(var(--text-secondary))", border: "1px solid hsl(var(--border))" }}>
                  Voltar e ajustar
                </button>
                <button onClick={handleExportDocx} disabled={exportingDocx}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: "hsl(var(--surface-card))", color: "hsl(var(--text-secondary))", border: "1px solid hsl(var(--border))" }}
                  data-testid="btn-export-docx"
                >
                  {exportingDocx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Baixar .docx
                </button>
                <button onClick={handleExportPdf} disabled={exportingPdf}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                  data-testid="btn-export-pdf"
                >
                  {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Baixar PDF
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─────── STEP 5 ─────── */}
        {activeStep === 5 && (
          <div className="space-y-5">
            <div className="info-card">
              <h2 className="font-semibold text-white text-[15px] mb-1">Como usar o Agente Rumo</h2>
              <p style={{ color: "hsl(var(--text-muted))", fontSize: "13px", lineHeight: "1.6" }}>
                Guia rápido de uso e boas práticas para produzir respostas de alta qualidade à ANTT.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {[
                { num: "01", title: "Sessão de treinamento", desc: "Envie PDFs de cartas-modelo antes de iniciar. Quanto mais exemplos, melhor a IA aprende o padrão visual e linguístico da Rumo.", color: "hsl(var(--primary))" },
                { num: "02", title: "Upload do ofício", desc: "Faça upload do PDF do ofício recebido. A IA extrai automaticamente número, prazo, signatário e pontos a responder.", color: "hsl(var(--rumo-green))" },
                { num: "03", title: "Forneça as informações", desc: "Preencha os dados de mérito para cada ponto. Não invente — apenas você detém as informações técnicas reais.", color: "hsl(204 76% 65%)" },
                { num: "04", title: "Revise e exporte", desc: "Leia a minuta com atenção. Solicite ajustes se necessário. Exporte em .docx (editável) e PDF (final).", color: "hsl(var(--rumo-green))" },
              ].map(item => (
                <div key={item.num} className="info-card flex gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: `${item.color}1a`, color: item.color }}>
                    {item.num}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm mb-1">{item.title}</p>
                    <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--text-muted))" }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="info-card" style={{ borderColor: "hsl(var(--primary) / 0.3)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "hsl(var(--primary))" }}>
                Arquivos gerados
              </p>
              <div className="space-y-1.5 text-sm" style={{ color: "hsl(var(--text-secondary))" }}>
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
                  <span><strong className="text-white">Word (.docx)</strong> — editável, fonte Verdana, cabeçalho e rodapé Rumo</span>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "hsl(var(--primary))" }} />
                  <span><strong className="text-white">PDF</strong> — versão final com barra azul institucional e dados da Rumo</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
