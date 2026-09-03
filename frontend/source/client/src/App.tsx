import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  ChevronDown,
  AlertTriangle,
  Search,
  Copy,
  Trash2,
  PencilLine,
  RefreshCw,
  Share2,
  FolderPlus,
} from "lucide-react";
import IdentifyWidget, { getResponsavel, AREA_OPCOES, estaIdentificado } from "./components/identify-widget";
import LoginGate from "./components/LoginGate";
import { InfoCard, PrimaryButton, SecondaryButton, TextField } from "./components/ui-kit";
import Stepper from "./components/Stepper";
import AjudaStep from "./components/steps/AjudaStep";
import Autocomplete, { type AutocompleteOption } from "./components/Autocomplete";
import { Toaster } from "./components/ui/toaster";
import { useToast } from "./hooks/use-toast";
import {
  getTemplates,
  uploadOficio,
  uploadComplementar,
  removeComplementar,
  gerarMinuta,
  gerarCartaEspontanea,
  refinarMinuta,
  downloadDocx,
  getHistorico,
  getHistoricoOpcoes,
  getHistoricoDetalhe,
  excluirHistoricoEntrada,
  atualizarHistoricoEntrada,
  baixarHistoricoDocx,
  registrarSharePoint,
  criarPastaSharePoint,
  getSharepointMode,
  getFormsUrl,
  type SharepointMode,
  getProximoNumero,
  numeroJaExiste,
  getAnttServidores,
  type Template,
  type Briefing,
  type DocumentoComplementar,
  type MinutaMeta,
  type AiFeedback,
  type HistoricoEntrada,
  type AnttServidor,
  type AnttSuperintendencia,
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
  { key: "rumo", nome: "RUMO S.A. (Holding)", sigla: "RSA" },
];

// Opções da coluna "Forma de Envio" no SharePoint
const FORMA_OPCOES = ["SEI", "E-mail", "Presencialmente"];

// Malhas operantes (a holding RSA fica de fora do atalho "Todas as malhas")
const MALHAS_OPERANTES_KEYS = ["norte", "paulista", "oeste", "sul", "central"];

// Converte a string de malha salva ("RMN, RMP" ou "Todas as malhas") em keys
function malhaStrParaKeys(str: string): string[] {
  const s = String(str || "").trim();
  if (!s) return [];
  if (s.toLowerCase() === "todas as malhas") return [...MALHAS_OPERANTES_KEYS];
  const siglas = s.split(",").map((x) => x.trim().toUpperCase());
  return MALHA_OPTIONS.filter((m) => siglas.includes(m.sigla)).map((m) => m.key);
}
// Converte keys de volta na string canônica (com atalho "Todas as malhas")
function keysParaMalhaStr(keys: string[]): string {
  const set = new Set(keys);
  if (MALHAS_OPERANTES_KEYS.every((k) => set.has(k)) && !set.has("rumo")) return "Todas as malhas";
  return MALHA_OPTIONS.filter((m) => set.has(m.key)).map((m) => m.sigla).join(", ");
}

type FlowType = "resposta" | "espontanea" | null;

/**
 * Ponto a responder já no formato editável da tela. O `id` mantém a identidade
 * do card mesmo quando pontos são excluídos ou adicionados no meio da lista.
 */
interface PontoEditavel {
  id: number;
  ponto: string;
  resposta: string;
}

let seqPonto = 0;
const novoPontoId = () => ++seqPonto;

/** Converte os pontos do briefing (objeto novo ou string antiga) para a tela. */
function pontosDoBriefing(briefing: Briefing | null): PontoEditavel[] {
  return (briefing?.pontos || []).map((p) => {
    const texto = typeof p === "string" ? p : p?.ponto || "";
    const sugestao = typeof p === "string" ? "" : p?.sugestao || "";
    return { id: novoPontoId(), ponto: texto, resposta: sugestao };
  });
}

const STEPS_RESPOSTA = [
  { number: 1, key: "modelos", label: "Modelos" },
  { number: 2, key: "oficio", label: "Ofício recebido" },
  { number: 3, key: "dados-resposta", label: "Dados da resposta" },
  { number: 4, key: "minuta", label: "Minuta gerada" },
  { number: 5, key: "historico", label: "Histórico" },
  { number: 6, key: "ajuda", label: "Como usar" },
];

const STEPS_ESPONTANEA = [
  { number: 1, key: "modelos", label: "Modelos" },
  { number: 2, key: "dados-espontanea", label: "Dados da carta" },
  { number: 4, key: "minuta", label: "Minuta gerada" },
  { number: 5, key: "historico", label: "Histórico" },
  { number: 6, key: "ajuda", label: "Como usar" },
];

// Opções da coluna "Assuntos" no SharePoint (devem casar exatamente com a lista)
// ATENÇÃO: estes rótulos precisam ser IDÊNTICOS às opções da coluna "Assuntos"
// no SharePoint (inclusive maiúsculas e acentos). Um valor diferente não casa
// com nenhuma opção da lista e entra como escolha nova, sem cor.
const ASSUNTOS_OPCOES = [
  "Patrimônio",
  "Ativos",
  "Passivos",
  "Interferências",
  "DUP",
  "Investimentos Obrigatórios",
  "Obrigações Contratuais",
  "Indicadores",
  "Acidentes",
  "Solicitação de acesso",
  "Fiscalização",
  "Projeto de RDT/RPMF",
  "Resposta Ofício",
  "Outros",
];

// Campos do painel de detalhes — mesma ordem e rótulos da lista do SharePoint
const CAMPOS_SHAREPOINT: { rot: string; chave: keyof HistoricoEntrada | null }[] = [
  { rot: "Título", chave: "titulo" },
  { rot: "Conferida?", chave: null },
  { rot: "Responsável", chave: "responsavel" },
  { rot: "Área do Responsável", chave: "area" },
  { rot: "Data de Envio", chave: null },
  { rot: "Assuntos", chave: "assuntos" },
  { rot: "Tema", chave: "tema" },
  { rot: "Órgão", chave: "orgao" },
  { rot: "Malha", chave: "malha" },
  { rot: "Ofício", chave: "oficio" },
  { rot: "Dilação?", chave: null },
  { rot: "Prazo com Dilação", chave: null },
  { rot: "Forma de Envio", chave: "forma_envio" },
  { rot: "Número do Processo", chave: "processo" },
  { rot: "Protocolo", chave: null },
];

export default function App() {
  const { toast } = useToast();
  // Tela de login inicial: bloqueia o app até nome, e-mail e área serem informados
  const [identificado, setIdentificado] = useState(estaIdentificado);
  const notificarErro = useCallback(
    (msg: string) => toast({ variant: "destructive", title: "Ops", description: msg }),
    [toast]
  );
  const notificar = useCallback(
    (titulo: string, msg?: string) => toast({ title: titulo, description: msg }),
    [toast]
  );

  // Modal de confirmação (substitui window.confirm, no estilo do app)
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    titulo: string;
    descricao: string;
    perigo?: boolean;
    rotuloOk?: string;
    resolve?: (v: boolean) => void;
  }>({ open: false, titulo: "", descricao: "" });

  const confirmar = useCallback(
    (opts: { titulo: string; descricao: string; perigo?: boolean; rotuloOk?: string }) =>
      new Promise<boolean>((resolve) => setConfirmState({ open: true, ...opts, resolve })),
    []
  );
  const responderConfirm = useCallback((v: boolean) => {
    setConfirmState((s) => {
      s.resolve?.(v);
      return { ...s, open: false };
    });
  }, []);

  // ── Estado global do fluxo ──
  const [flowType, setFlowType] = useState<FlowType>(null);
  const [activeStepKey, setActiveStepKey] = useState(() =>
    window.location.hash === "#/historico" ? "historico" : "modelos"
  );
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

  // ── Etapa 3 (resposta): destinatário (editável) + pontos ──
  const [respDestNome, setRespDestNome] = useState("");
  const [respDestCargo, setRespDestCargo] = useState("");
  const [respDestArea, setRespDestArea] = useState("");
  const [respMatch, setRespMatch] = useState<AnttServidor | null>(null);
  const [respMatchDispensado, setRespMatchDispensado] = useState(false);
  // Pontos com identidade própria: podem ser editados, excluídos e adicionados
  const [pontos, setPontos] = useState<PontoEditavel[]>([]);

  // ── Documentos complementares do fluxo resposta ──
  const [docsResposta, setDocsResposta] = useState<DocumentoComplementar[]>([]);
  const [enviandoDocsResposta, setEnviandoDocsResposta] = useState(false);
  const docsRespostaInputRef = useRef<HTMLInputElement>(null);

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
  const [numeroSugerido, setNumeroSugerido] = useState(false);
  const [exportando, setExportando] = useState(false);

  // Sugere o próximo número sequencial com base no histórico do ano
  const sugerirNumero = useCallback(() => {
    getProximoNumero()
      .then((r) => {
        if (r.proximo) {
          setNumeroCarta(String(r.proximo).padStart(4, "0"));
          setNumeroSugerido(true);
        }
      })
      .catch(() => {});
  }, []);
  const [aiFeedback, setAiFeedback] = useState<AiFeedback | null>(null);
  const [feedbackAberto, setFeedbackAberto] = useState(true);

  // ── Vagão Histórico ──
  const [histEntradas, setHistEntradas] = useState<HistoricoEntrada[]>([]);
  const [histCarregando, setHistCarregando] = useState(false);
  const [histDbOff, setHistDbOff] = useState(false);
  const [histBusca, setHistBusca] = useState("");
  const [histFiltroResp, setHistFiltroResp] = useState("");
  const [histFiltroMalha, setHistFiltroMalha] = useState("");
  const [histFiltroOrgao, setHistFiltroOrgao] = useState("");
  const [histFiltroAssunto, setHistFiltroAssunto] = useState("");
  const [histFiltroForma, setHistFiltroForma] = useState("");
  const [histFiltroSP, setHistFiltroSP] = useState(""); // "", "sim", "nao"
  // Link a abrir manualmente quando o navegador bloqueia a aba nova
  const [linkPendente, setLinkPendente] = useState<{ url: string; aviso: string } | null>(null);
  const [histOrdenar, setHistOrdenar] = useState("criado_em");
  const [histDirecao, setHistDirecao] = useState<"asc" | "desc">("desc");
  const [histOpcoes, setHistOpcoes] = useState<{ responsaveis: string[]; malhas: string[]; orgaos: string[] }>({
    responsaveis: [],
    malhas: [],
    orgaos: [],
  });
  const [histDetalhe, setHistDetalhe] = useState<HistoricoEntrada | null>(null);
  const [histMinutaAberta, setHistMinutaAberta] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [histTotal, setHistTotal] = useState(0);
  const [registrandoSP, setRegistrandoSP] = useState(false);
  const [spMode, setSpMode] = useState<SharepointMode>("none");
  const [spPastaAtiva, setSpPastaAtiva] = useState(false);
  const [criandoPasta, setCriandoPasta] = useState(false);
  // Arquivos relacionados à carta aberta no histórico. Ficam só no navegador
  // até você clicar em registrar / criar pasta — o ARCA não os armazena.
  const [anexosCarta, setAnexosCarta] = useState<File[]>([]);
  const anexosInputRef = useRef<HTMLInputElement>(null);
  const HIST_PAGINA = 50;

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

  // ── Base de servidores da ANTT (autocomplete de destinatário) ──
  const [anttServidores, setAnttServidores] = useState<AnttServidor[]>([]);
  const [anttSuperintendencias, setAnttSuperintendencias] = useState<AnttSuperintendencia[]>([]);

  useEffect(() => {
    getAnttServidores()
      .then((r) => {
        setAnttServidores(r.servidores);
        setAnttSuperintendencias(r.superintendencias);
      })
      .catch(() => {});
    getSharepointMode()
      .then(({ modo, pasta }) => {
        setSpMode(modo);
        setSpPastaAtiva(pasta);
      })
      .catch(() => {});
  }, []);

  const siglaParaNome = useMemo(
    () => Object.fromEntries(anttSuperintendencias.map((s) => [s.sigla, s.nome])),
    [anttSuperintendencias]
  );
  const areaLabel = useCallback(
    (sigla: string) => (siglaParaNome[sigla] ? `${sigla} — ${siglaParaNome[sigla]}` : sigla),
    [siglaParaNome]
  );

  const servidorOptions: AutocompleteOption[] = useMemo(
    () =>
      anttServidores.map((s, i) => ({
        id: String(i),
        primary: s.nome,
        secondary: `${s.cargo} · ${s.sigla}`,
        search: `${s.nome} ${s.cargo} ${s.sigla} ${s.unidade}`,
      })),
    [anttServidores]
  );
  const superintendenciaOptions: AutocompleteOption[] = useMemo(
    () =>
      anttSuperintendencias.map((s) => ({
        id: s.sigla,
        primary: `${s.sigla} — ${s.nome}`,
        search: `${s.sigla} ${s.nome}`,
      })),
    [anttSuperintendencias]
  );

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
      // Cada ponto já chega com a sugestão de direção preenchida pela IA
      setPontos(pontosDoBriefing(r.briefing));
      // O backend descarta os complementares ao receber um novo ofício
      setDocsResposta([]);

      // Pré-preenche o destinatário com a extração e tenta casar com a base ANTT
      const { nome, cargo } = parsearSignatario(r.briefing.signatarioAntt);
      setRespDestNome(nome);
      setRespDestCargo(cargo);
      setRespDestArea(r.briefing.area && !/não identificad/i.test(r.briefing.area) ? r.briefing.area : "");
      setRespMatchDispensado(false);
      setRespMatch(acharServidorPorNome(nome));

      markCompleted("oficio");
      goTo("dados-resposta");
    } catch (e: any) {
      notificarErro(e.message || "Erro ao processar ofício.");
    } finally {
      setUploadingOficio(false);
    }
  }

  // ── Edição dos pontos a responder ──
  function atualizarPonto(id: number, campo: "ponto" | "resposta", valor: string) {
    setPontos((lista) => lista.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)));
  }

  function excluirPonto(id: number) {
    setPontos((lista) => lista.filter((p) => p.id !== id));
  }

  function adicionarPonto() {
    setPontos((lista) => [...lista, { id: novoPontoId(), ponto: "", resposta: "" }]);
  }

  // ── Documentos complementares (fluxo resposta) ──
  async function handleUploadDocsResposta(files: File[]) {
    if (!files.length) return;
    setEnviandoDocsResposta(true);
    try {
      const r = await uploadComplementar(files);
      const novos = r.documentos || [];
      setDocsResposta((atuais) => [...atuais, ...novos]);

      const semLeitura = novos.filter((d) => !d.extraido);
      if (semLeitura.length) {
        notificar(
          "Documento anexado sem leitura de conteúdo",
          `${semLeitura.map((d) => d.nome).join(", ")} — a IA saberá que o documento acompanha a carta, mas não conseguirá ler seu conteúdo.`
        );
      }
    } catch (e: any) {
      notificarErro(e.message || "Erro ao enviar documentos.");
    } finally {
      setEnviandoDocsResposta(false);
      if (docsRespostaInputRef.current) docsRespostaInputRef.current.value = "";
    }
  }

  async function handleRemoverDocResposta(id: number) {
    setDocsResposta((atuais) => atuais.filter((d) => d.id !== id));
    try {
      await removeComplementar(id);
    } catch {
      // A remoção local já aconteceu; o documento sai do contexto na próxima geração
    }
  }

  async function handleGerarMinutaResposta() {
    if (!briefing) return;
    setGerandoMinuta(true);
    try {
      const pontosRespondidos = pontos
        .filter((p) => p.ponto.trim())
        .map((p) => ({ ponto: p.ponto.trim(), resposta: p.resposta.trim() }));

      // Pontos sem descrição não vão para a IA — avisa em vez de sumir calado
      const ignorados = pontos.filter((p) => !p.ponto.trim() && p.resposta.trim()).length;
      if (ignorados) {
        notificar(
          `${ignorados} ponto(s) sem descrição`,
          "A orientação foi preenchida, mas o ponto ficou em branco — esses itens não foram enviados à IA."
        );
      }
      // Usa o destinatário (possivelmente corrigido) na geração
      const briefingFinal: Briefing = {
        ...briefing,
        signatarioAntt: respDestCargo ? `${respDestNome} - ${respDestCargo}` : respDestNome,
        area: respDestArea || briefing.area,
      };
      const r = await gerarMinuta({ modeloId: selectedTemplate || "objetiva", briefing: briefingFinal, pontosRespondidos });
      setMinutaTexto(r.minuta);
      setMinutaMeta(r.meta);
      setAiFeedback(r.feedback ?? null);
      setFeedbackAberto(true);
      setHistorico([]);
      sugerirNumero();
      markCompleted("dados-resposta");
      goTo("minuta");
    } catch (e: any) {
      notificarErro(e.message || "Erro ao gerar minuta.");
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
      setAiFeedback(r.feedback ?? null);
      setFeedbackAberto(true);
      setHistorico([]);
      sugerirNumero();
      markCompleted("dados-espontanea");
      goTo("minuta");
    } catch (e: any) {
      notificarErro(e.message || "Erro ao gerar carta.");
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
      setAiFeedback(r.feedback ?? null);
      setFeedbackAberto(true);
      setHistorico((h) => [
        ...h,
        { role: "user", content: refinamentoMsg, minutaRef: minutaTexto },
        { role: "assistant", content: r.texto },
      ]);
      setRefinamentoMsg("");
    } catch (e: any) {
      notificarErro(e.message || "Erro ao refinar minuta.");
    } finally {
      setRefinando(false);
    }
  }

  async function handleBaixarDocx() {
    if (!minutaTexto || !minutaMeta) return;
    setExportando(true);
    try {
      // Mitigação de colisão: alguém pode ter usado o número entre a sugestão e o download
      try {
        if (await numeroJaExiste(numeroCarta)) {
          const ok = await confirmar({
            titulo: `Número ${numeroCarta.padStart(4, "0")} já usado`,
            descricao:
              "Este número já consta no histórico deste ano (pode ter sido usado por outro colega ou ser uma reemissão desta carta). Deseja usar este número mesmo assim?",
            rotuloOk: "Usar mesmo assim",
          });
          if (!ok) {
            setExportando(false);
            return;
          }
        }
      } catch {
        /* verificação indisponível — segue o download normalmente */
      }
      const { responsavel, area, email } = getResponsavel();
      // Ofício e Assuntos para o registro: só há ofício no fluxo de resposta.
      // Na espontânea, ambos vão em branco (o usuário escolhe o Assuntos no histórico).
      const isResposta = flowType === "resposta";
      const oficioSp = isResposta ? minutaMeta?.referencia || "" : "";
      const assuntosSp = isResposta ? "Resposta Ofício" : "";
      const nome = await downloadDocx(numeroCarta, minutaTexto, {
        ...minutaMeta,
        responsavel,
        responsavelEmail: email,
        area,
        oficio: oficioSp,
        assuntos: assuntosSp,
      });
      toast({ description: `Carta baixada: ${nome}` });
    } catch (e: any) {
      notificarErro(e.message || "Erro ao gerar DOCX.");
    } finally {
      setExportando(false);
    }
  }

  // Preenche destinatário (nome/cargo/área) a partir de um servidor da base ANTT
  function preencherDestinatarioEspontanea(servidorId: string) {
    const s = anttServidores[Number(servidorId)];
    if (!s) return;
    setDestNome(s.nome);
    setDestCargo(s.cargo);
    setDestArea(areaLabel(s.sigla));
  }

  function preencherDestinatarioResposta(servidorId: string) {
    const s = anttServidores[Number(servidorId)];
    if (!s) return;
    setRespDestNome(s.nome);
    setRespDestCargo(s.cargo);
    setRespDestArea(areaLabel(s.sigla));
  }

  function aplicarMatchResposta(s: AnttServidor) {
    setRespDestNome(s.nome);
    setRespDestCargo(s.cargo);
    setRespDestArea(areaLabel(s.sigla));
    setRespMatch(null);
  }

  // Separa "Nome - Cargo" (ou "Nome, Cargo") extraído do ofício
  function parsearSignatario(sig: string): { nome: string; cargo: string } {
    const raw = (sig || "").trim();
    if (!raw || /não identificad/i.test(raw)) return { nome: "", cargo: "" };
    const m = raw.match(/\s[-–—]\s|,\s/);
    if (m && m.index !== undefined) {
      return { nome: raw.slice(0, m.index).trim(), cargo: raw.slice(m.index + m[0].length).trim() };
    }
    return { nome: raw, cargo: "" };
  }

  // Bônus: casa o nome extraído com a base da ANTT (nome+sobrenome coincidentes)
  function acharServidorPorNome(nomeExtraido: string): AnttServidor | null {
    const norm = (s: string) =>
      (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
    const q = norm(nomeExtraido);
    if (q.length < 4) return null;
    const exato = anttServidores.find((s) => norm(s.nome) === q);
    if (exato) return exato;
    const qtokens = q.split(/\s+/).filter((t) => t.length > 2);
    let melhor: AnttServidor | null = null;
    let melhorScore = 0;
    for (const s of anttServidores) {
      const st = norm(s.nome).split(/\s+/);
      const overlap = qtokens.filter((t) => st.includes(t)).length;
      if (overlap > melhorScore) {
        melhorScore = overlap;
        melhor = s;
      }
    }
    return melhorScore >= 2 ? melhor : null; // exige ao menos 2 tokens (nome + sobrenome)
  }

  function toggleMalha(key: string) {
    setMalhasSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── Histórico: carga paginada, filtros e ações ──
  const carregarHistorico = useCallback(
    async (append = false) => {
      setHistCarregando(true);
      try {
        const offset = append ? histEntradas.length : 0;
        const r = await getHistorico({
          q: histBusca.trim(),
          responsavel: histFiltroResp,
          malha: histFiltroMalha,
          orgao: histFiltroOrgao,
          assuntos: histFiltroAssunto,
          forma_envio: histFiltroForma,
          sp: histFiltroSP,
          ordenar: histOrdenar,
          direcao: histDirecao,
          limit: HIST_PAGINA,
          offset,
        });
        setHistDbOff(!!r.dbDesativado);
        setHistTotal(r.total ?? (r.historico || []).length);
        setHistEntradas((prev) => (append ? [...prev, ...(r.historico || [])] : r.historico || []));
      } catch {
        if (!append) setHistEntradas([]);
      } finally {
        setHistCarregando(false);
      }
    },
    [histBusca, histFiltroResp, histFiltroMalha, histFiltroOrgao, histFiltroAssunto, histFiltroForma, histFiltroSP, histOrdenar, histDirecao, histEntradas.length]
  );

  useEffect(() => {
    if (activeStepKey !== "historico") return;
    carregarHistorico();
    getHistoricoOpcoes()
      .then((r) => setHistOpcoes({ responsaveis: r.responsaveis || [], malhas: r.malhas || [], orgaos: r.orgaos || [] }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStepKey]);

  // Ordenação e filtros de "escolha" recarregam na hora (a busca livre usa o botão)
  useEffect(() => {
    if (activeStepKey !== "historico") return;
    carregarHistorico();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histOrdenar, histDirecao, histFiltroResp, histFiltroMalha, histFiltroOrgao, histFiltroAssunto, histFiltroForma, histFiltroSP]);

  async function abrirDetalheHistorico(id: string) {
    try {
      const r = await getHistoricoDetalhe(id);
      setHistDetalhe(r.entrada);
      setHistMinutaAberta(false);
      setAnexosCarta([]); // anexos são por carta aberta
    } catch {
      notificarErro("Não foi possível carregar os detalhes.");
    }
  }

  // Salva um ou mais campos do histórico de forma otimista (com rollback).
  // Usado por seletores e chips, que mudam de valor num clique só.
  async function salvarCampoHist(patch: Partial<HistoricoEntrada>) {
    if (!histDetalhe) return;
    const id = histDetalhe.id;
    const anterior: Partial<HistoricoEntrada> = {};
    (Object.keys(patch) as (keyof HistoricoEntrada)[]).forEach((k) => {
      (anterior as any)[k] = histDetalhe[k];
    });
    setHistDetalhe((d) => (d ? { ...d, ...patch } : d));
    try {
      await atualizarHistoricoEntrada(id, patch as any);
      setHistEntradas((lista) => lista.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    } catch (e: any) {
      setHistDetalhe((d) => (d ? { ...d, ...anterior } : d));
      notificarErro(e.message || "Erro ao atualizar.");
    }
  }

  // Atualiza um campo de texto só localmente (persiste no onBlur).
  function setCampoLocal(chave: keyof HistoricoEntrada, v: string) {
    setHistDetalhe((d) => (d ? { ...d, [chave]: v } : d));
  }

  // Persiste um campo de texto ao sair do input (onBlur).
  async function persistCampo(chave: keyof HistoricoEntrada) {
    if (!histDetalhe) return;
    const id = histDetalhe.id;
    const valor = String(histDetalhe[chave] ?? "");
    try {
      await atualizarHistoricoEntrada(id, { [chave]: valor } as any);
      setHistEntradas((lista) => lista.map((e) => (e.id === id ? { ...e, [chave]: valor } : e)));
    } catch (e: any) {
      notificarErro(e.message || "Erro ao salvar.");
    }
  }

  // Atalho para o seletor de Assuntos.
  async function atualizarAssuntos(novo: string) {
    await salvarCampoHist({ assuntos: novo });
  }

  async function excluirDoHistorico(id: string) {
    const ok = await confirmar({
      titulo: "Excluir do histórico?",
      descricao: "Esta ação não pode ser desfeita.",
      perigo: true,
      rotuloOk: "Excluir",
    });
    if (!ok) return;
    try {
      await excluirHistoricoEntrada(id);
      setHistDetalhe(null);
      carregarHistorico();
      toast({ description: "Entrada excluída do histórico." });
    } catch {
      notificarErro("Erro ao excluir.");
    }
  }

  /**
   * Abre uma aba já no clique do usuário e só depois a direciona para a URL.
   * Chamar window.open() após um await faz o navegador tratar a aba como popup
   * e bloqueá-la — por isso a aba é reservada antes da chamada à API.
   * (Sem "noopener" porque ele faz o open() devolver null; a referência é
   * limpa em seguida para não expor a janela de origem.)
   */
  function reservarAba(): Window | null {
    const win = window.open("", "_blank");
    if (win) {
      try {
        win.opener = null;
      } catch {
        /* alguns navegadores não permitem — sem impacto */
      }
    }
    return win;
  }

  function usarAba(win: Window | null, url: string, aviso: string) {
    if (win && !win.closed) {
      win.location.href = url;
      return true;
    }
    // Aba bloqueada pelo navegador: oferece o link para abrir manualmente
    setLinkPendente({ url, aviso });
    return false;
  }

  async function abrirFormularioSharePoint(id: string) {
    const win = reservarAba();
    setRegistrandoSP(true);
    try {
      const url = await getFormsUrl(id);
      if (usarAba(win, url, "Formulário de registro")) {
        toast({ description: "Formulário aberto — revise os dados e clique em Enviar." });
      }
    } catch (e: any) {
      win?.close();
      notificarErro(e.message || "Não foi possível abrir o formulário.");
    } finally {
      setRegistrandoSP(false);
    }
  }

  async function criarPastaNoSharePoint(id: string) {
    const win = reservarAba();
    setCriandoPasta(true);
    try {
      const r = await criarPastaSharePoint(id, anexosCarta);
      if (!r.success) {
        win?.close();
        notificarErro(r.message || "Não foi possível criar a pasta.");
        return;
      }
      const qtd = r.arquivos ?? 0;
      if (r.pastaUrl) {
        if (usarAba(win, r.pastaUrl, `Pasta "${r.pastaNome}" no SharePoint`)) {
          toast({ description: `Pasta "${r.pastaNome}" criada com ${qtd} arquivo(s) — abrindo no SharePoint.` });
        }
      } else {
        win?.close();
        toast({ description: `Pasta "${r.pastaNome}" criada com ${qtd} arquivo(s).` });
      }
    } catch (e: any) {
      win?.close();
      notificarErro(e.message || "Erro ao criar a pasta no SharePoint.");
    } finally {
      setCriandoPasta(false);
    }
  }

  async function registrarNoSharePoint(id: string) {
    const win = reservarAba();
    setRegistrandoSP(true);
    try {
      const r = await registrarSharePoint(id, anexosCarta);
      if (!r.success) {
        win?.close();
        notificarErro(r.message || "Não foi possível registrar no SharePoint.");
        return;
      }
      if (r.itemUrl) {
        if (usarAba(win, r.itemUrl, "Item registrado no SharePoint")) {
          toast({ description: "Carta registrada — abrindo o item no SharePoint." });
        }
      } else {
        win?.close();
        toast({
          description:
            "Carta registrada. O fluxo do Power Automate não devolveu o link do item — configure SHAREPOINT_LIST_URL no servidor para abrir a lista automaticamente.",
        });
      }
      const quando = r.registradoEm || new Date().toISOString();
      setHistDetalhe((d) => (d ? { ...d, sharepoint_em: quando } : d));
      carregarHistorico();
    } catch (e: any) {
      notificarErro(e.message || "Erro ao registrar no SharePoint.");
    } finally {
      setRegistrandoSP(false);
    }
  }

  function copiarTexto(chaveUi: string, texto: string) {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(chaveUi);
      setTimeout(() => setCopiado(null), 1200);
    });
  }

  function copiarTudoHistorico(e: HistoricoEntrada) {
    const linhas = CAMPOS_SHAREPOINT.map(
      (c) => `${c.rot}: ${c.chave ? String(e[c.chave] ?? "") : ""}`
    );
    copiarTexto("tudo", linhas.join("\n"));
  }

  // Reabre uma carta do histórico na etapa de minuta para edição/refinamento
  function reabrirDoHistorico(e: HistoricoEntrada) {
    const todas = e.malha === "Todas as malhas";
    const siglas = (e.malha || "").split(",").map((s) => s.trim()).filter(Boolean);
    const keys = todas
      ? ["norte", "paulista", "oeste", "sul", "central"]
      : MALHA_OPTIONS.filter((m) => siglas.includes(m.sigla)).map((m) => m.key);
    // Heurística p/ re-download consistente: com ofício → fluxo resposta
    setFlowType(e.oficio ? "resposta" : "espontanea");
    setMinutaTexto(e.minuta || "");
    setMinutaMeta({
      signatarioAntt: e.signatario_antt || "",
      cargoAntt: e.cargo_antt || "",
      malha: keys.join(","),
      assunto: e.tema || "",
      processo: e.processo || "",
      referencia: e.oficio || "",
      modeloId: e.modelo_id || "objetiva",
    });
    setMalhasSelecionadas(new Set(keys));
    setNumeroCarta((e.titulo || "").split("/")[0] || "0001");
    setNumeroSugerido(false);
    setAiFeedback(null);
    setHistorico([]);
    setHistDetalhe(null);
    markCompleted("modelos");
    goTo("minuta");
  }

  const fmtDataHistorico = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR");
  };

  const nomeArquivoPreview = () => {
    const ano = new Date().getFullYear();
    const OPERANTES = ["norte", "paulista", "oeste", "sul", "central"];
    const todasOperantes = OPERANTES.every((k) => malhasSelecionadas.has(k));
    const siglas = todasOperantes
      ? "Todas as malhas"
      : MALHA_OPTIONS.filter((m) => malhasSelecionadas.has(m.key))
          .map((m) => m.sigla)
          .join(", ");
    const assuntoBase = minutaMeta?.assunto || assunto || "Assunto";
    // O assunto da IA costuma já terminar com a sigla da entidade — não duplica
    const jaTemSigla = !!siglas && assuntoBase.trim().toUpperCase().endsWith(siglas.toUpperCase());
    return `${numeroCarta.padStart(4, "0")} - GREG - ${ano} - ${assuntoBase}${
      siglas && !jaTemSigla ? ` - ${siglas}` : ""
    }`;
  };

  // Enquanto não identificado, mostra apenas a tela de login
  if (!identificado) {
    return <LoginGate onConcluir={() => setIdentificado(true)} />;
  }

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
        <Stepper
          steps={steps}
          activeStepKey={activeStepKey}
          completedKeys={completedKeys}
          onGoTo={goTo}
        />

        <div key={activeStepKey} className="arca-fade">
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
                  aria-pressed={selected}
                  className={`info-card card-clickable w-full text-left flex items-start gap-4 ${
                    selected ? "is-selected" : ""
                  }`}
                  style={{
                    borderColor: selected ? "hsl(var(--primary))" : "hsl(var(--border))",
                    background: selected ? "hsl(var(--primary) / 0.1)" : "hsl(var(--surface-card))",
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
                      {selected && <span className="badge-active">selecionado</span>}
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
                Ofício recebido
              </p>
              <p className="text-white text-sm">{briefing.numero}</p>
              <p style={{ color: "hsl(var(--text-secondary))", fontSize: "13px" }}>
                Prazo: {briefing.prazo} · Processo: {briefing.processo || "—"}
              </p>
            </div>

            {/* ── Destinatário (extraído, editável) ── */}
            <div className="info-card space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase" style={{ color: "hsl(var(--primary))" }}>
                  Destinatário (ANTT)
                </p>
                <span className="text-[11px]" style={{ color: "hsl(var(--text-muted))" }}>
                  extraído do ofício · edite se necessário
                </span>
              </div>

              {/* Bônus: sugestão de correspondência com a base da ANTT (quando normaliza algo) */}
              {respMatch &&
                !respMatchDispensado &&
                (respDestNome !== respMatch.nome ||
                  respDestCargo !== respMatch.cargo ||
                  respDestArea !== areaLabel(respMatch.sigla)) && (
                <div
                  className="rounded-lg flex items-start gap-2"
                  style={{
                    background: "hsl(var(--rumo-green) / 0.08)",
                    border: "1px solid hsl(var(--rumo-green) / 0.4)",
                    padding: "10px 12px",
                  }}
                >
                  <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: "hsl(var(--rumo-green))", marginTop: "2px" }} />
                  <div className="flex-1">
                    <p className="text-sm" style={{ color: "hsl(var(--text-secondary))" }}>
                      Encontramos na base da ANTT:{" "}
                      <strong className="text-white">{respMatch.nome}</strong> — {respMatch.cargo} · {respMatch.sigla}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => aplicarMatchResposta(respMatch)}
                        className="text-xs font-semibold px-3 py-1 rounded-md"
                        style={{ background: "hsl(var(--rumo-green))", color: "white", cursor: "pointer", border: "none" }}
                      >
                        Usar
                      </button>
                      <button
                        onClick={() => setRespMatchDispensado(true)}
                        className="text-xs px-3 py-1 rounded-md"
                        style={{ background: "transparent", color: "hsl(var(--text-muted))", cursor: "pointer", border: "1px solid hsl(var(--border))" }}
                      >
                        Manter o extraído
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "hsl(var(--text-muted))" }}>
                    Nome
                  </label>
                  <Autocomplete
                    value={respDestNome}
                    onChangeText={setRespDestNome}
                    onSelect={preencherDestinatarioResposta}
                    options={servidorOptions}
                    placeholder="Nome do destinatário"
                  />
                </div>
                <TextField
                  label="Cargo"
                  value={respDestCargo}
                  onChange={setRespDestCargo}
                  placeholder="Cargo"
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "hsl(var(--text-muted))" }}>
                  Área / Superintendência
                </label>
                <Autocomplete
                  value={respDestArea}
                  onChangeText={setRespDestArea}
                  onSelect={(sigla) => setRespDestArea(areaLabel(sigla))}
                  options={superintendenciaOptions}
                  placeholder="Área / Superintendência"
                />
              </div>
            </div>

            {/* Documentos complementares — contexto extra para a IA */}
            <div className="info-card">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm text-white font-medium">Documentos complementares (opcional)</p>
                  <p style={{ color: "hsl(var(--text-muted))", fontSize: "12px" }}>
                    Nota técnica, planilhas, anexos — qualquer formato. A IA usa como contexto da resposta.
                  </p>
                </div>
                <input
                  ref={docsRespostaInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length) handleUploadDocsResposta(files);
                  }}
                />
                <SecondaryButton
                  onClick={() => docsRespostaInputRef.current?.click()}
                  disabled={enviandoDocsResposta}
                >
                  {enviandoDocsResposta ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                    </>
                  ) : (
                    <>
                      <Paperclip className="w-4 h-4" /> Anexar documentos
                    </>
                  )}
                </SecondaryButton>
              </div>

              {docsResposta.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {docsResposta.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ background: "hsl(var(--surface-app))", border: "1px solid hsl(var(--border))" }}
                    >
                      <FileText className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--text-muted))" }} />
                      <span className="text-sm text-white truncate flex-1">{d.nome}</span>
                      {!d.extraido && (
                        <span
                          title={d.motivo || "Conteúdo não legível automaticamente"}
                          className="text-[11px] px-2 py-0.5 rounded shrink-0"
                          style={{ background: "hsl(var(--surface-raised))", color: "hsl(var(--text-muted))" }}
                        >
                          sem leitura
                        </span>
                      )}
                      <button
                        onClick={() => handleRemoverDocResposta(d.id)}
                        title="Remover documento"
                        className="p-1 rounded hover:opacity-80 shrink-0"
                        style={{ color: "hsl(var(--text-muted))" }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pontos a responder — editáveis, removíveis e adicionáveis */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-sm text-white font-medium">
                Pontos a responder{pontos.length ? ` (${pontos.length})` : ""}
              </p>
              <span style={{ color: "hsl(var(--text-muted))", fontSize: "12px" }}>
                Revise, ajuste ou remova o que não se aplica
              </span>
            </div>

            {pontos.length === 0 && (
              <div className="info-card text-center">
                <p style={{ color: "hsl(var(--text-muted))", fontSize: "13px" }}>
                  Nenhum ponto na lista. Adicione ao menos um ponto para orientar a resposta.
                </p>
              </div>
            )}

            {pontos.map((p, i) => (
              <div key={p.id} className="info-card">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-xs" style={{ color: "hsl(var(--text-muted))" }}>
                    Ponto {i + 1}
                  </label>
                  <button
                    onClick={() => excluirPonto(p.id)}
                    title="Excluir este ponto"
                    className="p-1 rounded hover:opacity-80"
                    style={{ color: "hsl(var(--text-muted))" }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <textarea
                  value={p.ponto}
                  onChange={(e) => atualizarPonto(p.id, "ponto", e.target.value)}
                  placeholder="O que a ANTT está solicitando neste ponto..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-y mb-3"
                  style={{
                    background: "hsl(var(--surface-app))",
                    border: "1px solid hsl(var(--border))",
                    color: "hsl(var(--text-primary))",
                  }}
                />
                <label className="block text-xs mb-1.5" style={{ color: "hsl(var(--text-muted))" }}>
                  Rascunho da resposta{" "}
                  <span style={{ opacity: 0.75 }}>· sugestão da IA, ajuste como quiser</span>
                </label>
                <textarea
                  value={p.resposta}
                  onChange={(e) => atualizarPonto(p.id, "resposta", e.target.value)}
                  placeholder="Ex.: Informamos que o documento foi revisado e atualizado conforme solicitado, seguindo em anexo..."
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

            <SecondaryButton onClick={adicionarPonto}>
              <PencilLine className="w-4 h-4" /> Adicionar ponto
            </SecondaryButton>

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
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase" style={{ color: "hsl(var(--primary))" }}>
                  Destinatário (ANTT)
                </p>
                {servidorOptions.length > 0 && (
                  <span className="text-[11px]" style={{ color: "hsl(var(--text-muted))" }}>
                    digite o nome para buscar na base da ANTT
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: "hsl(var(--text-muted))" }}>
                    Nome
                  </label>
                  <Autocomplete
                    value={destNome}
                    onChangeText={setDestNome}
                    onSelect={preencherDestinatarioEspontanea}
                    options={servidorOptions}
                    placeholder="Ex.: João da Silva"
                  />
                </div>
                <TextField
                  label="Cargo"
                  value={destCargo}
                  onChange={setDestCargo}
                  placeholder="Ex.: Superintendente de Fiscalização"
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "hsl(var(--text-muted))" }}>
                  Área / Superintendência
                </label>
                <Autocomplete
                  value={destArea}
                  onChangeText={setDestArea}
                  onSelect={(sigla) => setDestArea(areaLabel(sigla))}
                  options={superintendenciaOptions}
                  placeholder="Ex.: SUFER — Superintendência de Transporte Ferroviário"
                />
              </div>
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
                {docsRelacionados.length > 0 && (
                  <p className="text-xs text-white mt-1">{docsRelacionados.join(", ")}</p>
                )}
              </div>
              <input
                ref={docsInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  e.target.value = "";
                  if (!files.length) return;
                  try {
                    await uploadComplementar(files);
                    setDocsRelacionados((d) => [...d, ...files.map((f) => f.name)]);
                  } catch (err: any) {
                    notificarErro(err.message || "Erro ao enviar documentos.");
                  }
                }}
              />
              <SecondaryButton onClick={() => docsInputRef.current?.click()}>
                <Paperclip className="w-4 h-4" /> Anexar documentos
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

            {/* ── Painel de feedback da IA ── */}
            {aiFeedback && (aiFeedback.resumo || aiFeedback.atencao.length > 0 || aiFeedback.dicas.length > 0) && (
              <div
                className="rounded-lg"
                style={{
                  background: "hsl(var(--surface-panel))",
                  border: "1px solid hsl(var(--border) / 0.7)",
                  padding: "10px 14px",
                }}
              >
                <button
                  onClick={() => setFeedbackAberto((v) => !v)}
                  className="w-full flex items-center gap-2"
                  style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
                >
                  <Sparkles className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />
                  <span
                    className="text-[11px] font-semibold uppercase tracking-widest"
                    style={{ color: "hsl(var(--text-muted))" }}
                  >
                    Feedback da IA
                  </span>
                  <ChevronDown
                    className="w-3.5 h-3.5 ml-auto"
                    style={{
                      color: "hsl(var(--text-muted))",
                      transform: feedbackAberto ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s ease",
                    }}
                  />
                </button>
                {feedbackAberto && (
                  <div
                    className="mt-2 space-y-2"
                    style={{ maxHeight: "170px", overflowY: "auto", fontSize: "12.5px", lineHeight: "1.55" }}
                  >
                    {aiFeedback.resumo && (
                      <p style={{ color: "hsl(var(--text-secondary))" }}>{aiFeedback.resumo}</p>
                    )}
                    {aiFeedback.atencao.length > 0 && (
                      <div className="space-y-1">
                        {aiFeedback.atencao.map((item, i) => (
                          <div key={i} className="flex gap-1.5">
                            <AlertTriangle
                              className="w-3 h-3 flex-shrink-0"
                              style={{ color: "hsl(38 85% 60%)", marginTop: "3px" }}
                            />
                            <span style={{ color: "hsl(var(--text-secondary))" }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {aiFeedback.dicas.length > 0 && (
                      <div className="space-y-1">
                        {aiFeedback.dicas.map((item, i) => (
                          <div key={i} className="flex gap-1.5">
                            <Lightbulb
                              className="w-3 h-3 flex-shrink-0"
                              style={{ color: "hsl(204 76% 65%)", marginTop: "3px" }}
                            />
                            <span style={{ color: "hsl(var(--text-muted))" }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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
                {numeroSugerido && (
                  <span
                    className="ml-2 normal-case font-normal"
                    style={{ color: "hsl(var(--rumo-green))", letterSpacing: 0 }}
                  >
                    · sugerido pelo histórico — editável
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2 flex-wrap text-sm" style={{ color: "hsl(var(--text-secondary))" }}>
                <input
                  value={numeroCarta}
                  onChange={(e) => {
                    setNumeroCarta(e.target.value);
                    setNumeroSugerido(false);
                  }}
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
        {activeStepKey === "ajuda" && <AjudaStep onGoTo={goTo} />}

        {/* ═══════ ETAPA 6 — Histórico ═══════ */}
        {activeStepKey === "historico" && (
          <div className="space-y-4">
            <InfoCard title="Histórico de cartas da equipe">
              Registro compartilhado de todas as cartas geradas. Clique numa carta para ver os campos
              prontos para copiar na lista do SharePoint, baixar o .docx novamente ou reabri-la para
              edição.
            </InfoCard>

            {histDbOff && (
              <div
                className="info-card"
                style={{ borderColor: "hsl(38 85% 60% / 0.4)" }}
              >
                <p style={{ color: "hsl(38 85% 70%)", fontSize: "13px" }}>
                  O banco de dados do histórico não está configurado no servidor (variável DATABASE_URL).
                </p>
              </div>
            )}

            {/* Filtros */}
            {(() => {
              const selStyle = {
                background: "hsl(var(--surface-app))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--text-primary))",
              };
              const lblCls = "block text-xs mb-1.5";
              const lblSt = { color: "hsl(var(--text-muted))" };
              const temFiltro =
                histBusca || histFiltroResp || histFiltroMalha || histFiltroOrgao ||
                histFiltroAssunto || histFiltroForma || histFiltroSP;
              const limparFiltros = () => {
                setHistBusca(""); setHistFiltroResp(""); setHistFiltroMalha("");
                setHistFiltroOrgao(""); setHistFiltroAssunto(""); setHistFiltroForma("");
                setHistFiltroSP(""); setHistOrdenar("criado_em"); setHistDirecao("desc");
              };
              return (
                <div className="info-card flex flex-col gap-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1" style={{ minWidth: "200px" }}>
                      <label className={lblCls} style={lblSt}>Buscar</label>
                      <input
                        value={histBusca}
                        onChange={(e) => setHistBusca(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && carregarHistorico()}
                        placeholder="título, tema, ofício, processo, responsável…"
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        style={selStyle}
                      />
                    </div>
                    <PrimaryButton onClick={() => carregarHistorico()} loading={histCarregando}>
                      <Search className="w-4 h-4" /> Buscar
                    </PrimaryButton>
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className={lblCls} style={lblSt}>Responsável</label>
                      <select value={histFiltroResp} onChange={(e) => setHistFiltroResp(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ ...selStyle, minWidth: "150px" }}>
                        <option value="">Todos</option>
                        {histOpcoes.responsaveis.map((r) => (<option key={r}>{r}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className={lblCls} style={lblSt}>Malha</label>
                      <select value={histFiltroMalha} onChange={(e) => setHistFiltroMalha(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ ...selStyle, minWidth: "110px" }}>
                        <option value="">Todas</option>
                        {histOpcoes.malhas.map((m) => (<option key={m}>{m}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className={lblCls} style={lblSt}>Órgão</label>
                      <select value={histFiltroOrgao} onChange={(e) => setHistFiltroOrgao(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ ...selStyle, minWidth: "100px" }}>
                        <option value="">Todos</option>
                        {histOpcoes.orgaos.map((o) => (<option key={o}>{o}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className={lblCls} style={lblSt}>Assunto</label>
                      <select value={histFiltroAssunto} onChange={(e) => setHistFiltroAssunto(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ ...selStyle, minWidth: "140px" }}>
                        <option value="">Todos</option>
                        {ASSUNTOS_OPCOES.map((a) => (<option key={a}>{a}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className={lblCls} style={lblSt}>Forma de envio</label>
                      <select value={histFiltroForma} onChange={(e) => setHistFiltroForma(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ ...selStyle, minWidth: "120px" }}>
                        <option value="">Todas</option>
                        {FORMA_OPCOES.map((f) => (<option key={f}>{f}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className={lblCls} style={lblSt}>SharePoint</label>
                      <select value={histFiltroSP} onChange={(e) => setHistFiltroSP(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ ...selStyle, minWidth: "120px" }}>
                        <option value="">Todos</option>
                        <option value="sim">Registrados</option>
                        <option value="nao">Não registrados</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className={lblCls} style={lblSt}>Ordenar por</label>
                      <select value={histOrdenar} onChange={(e) => setHistOrdenar(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ ...selStyle, minWidth: "150px" }}>
                        <option value="criado_em">Data de criação</option>
                        <option value="titulo">Número da carta</option>
                        <option value="responsavel">Responsável</option>
                        <option value="malha">Malha</option>
                        <option value="assuntos">Assunto</option>
                        <option value="tema">Tema</option>
                      </select>
                    </div>
                    <SecondaryButton onClick={() => setHistDirecao((d) => (d === "asc" ? "desc" : "asc"))}>
                      {histDirecao === "asc" ? "↑ Crescente" : "↓ Decrescente"}
                    </SecondaryButton>
                    {temFiltro && (
                      <SecondaryButton onClick={limparFiltros}>Limpar filtros</SecondaryButton>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Painel de detalhes (quando uma carta está aberta) */}
            {histDetalhe && (
              <div className="info-card" style={{ borderColor: "hsl(var(--primary) / 0.5)" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-white text-sm">{histDetalhe.titulo}</p>
                  <button
                    onClick={() => setHistDetalhe(null)}
                    style={{ background: "none", border: "none", color: "hsl(var(--text-muted))", cursor: "pointer", fontSize: "18px", lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-0">
                  {CAMPOS_SHAREPOINT.map((c) => {
                    const rowStyle = { borderBottom: "1px solid hsl(var(--border) / 0.35)", fontSize: "13px" };
                    const labelStyle = { width: "160px", flexShrink: 0, color: "hsl(var(--text-muted))", fontSize: "12px", fontWeight: 600 } as const;
                    const campoStyle = {
                      background: "hsl(var(--surface-app))",
                      border: "1px solid hsl(var(--border))",
                      color: "hsl(var(--text-primary))",
                    };
                    const val = c.chave ? String(histDetalhe[c.chave] ?? "") : "";

                    // Campos exclusivos do SharePoint (sem chave) — só leitura
                    if (!c.chave) {
                      return (
                        <div key={c.rot} className="flex items-start gap-2 py-1.5" style={rowStyle}>
                          <span style={{ ...labelStyle, paddingTop: "1px" }}>{c.rot}</span>
                          <span className="flex-1" style={{ color: "hsl(var(--text-muted) / 0.6)", fontStyle: "italic" }}>
                            (preencher no SharePoint)
                          </span>
                        </div>
                      );
                    }

                    // Título — identidade da carta, só leitura (com copiar)
                    if (c.chave === "titulo") {
                      return (
                        <div key={c.rot} className="flex items-start gap-2 py-1.5" style={rowStyle}>
                          <span style={{ ...labelStyle, paddingTop: "1px" }}>{c.rot}</span>
                          <span className="flex-1" style={{ color: "hsl(var(--text-secondary))", wordBreak: "break-word" }}>{val}</span>
                          <button
                            onClick={() => copiarTexto(c.rot, val)}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs flex-shrink-0"
                            style={{ background: "none", border: `1px solid ${copiado === c.rot ? "hsl(var(--rumo-green))" : "hsl(var(--border))"}`, color: copiado === c.rot ? "hsl(var(--rumo-green))" : "hsl(var(--text-muted))", cursor: "pointer" }}
                          >
                            {copiado === c.rot ? "✓" : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      );
                    }

                    // Assuntos — seletor
                    if (c.chave === "assuntos") {
                      return (
                        <div key={c.rot} className="flex items-center gap-2 py-1.5" style={rowStyle}>
                          <span style={labelStyle}>{c.rot}</span>
                          <select value={ASSUNTOS_OPCOES.includes(val) ? val : ""} onChange={(e) => atualizarAssuntos(e.target.value)} className="flex-1 px-2 py-1 rounded text-sm" style={campoStyle}>
                            {!ASSUNTOS_OPCOES.includes(val) && <option value="">{val || "(selecionar)"}</option>}
                            {ASSUNTOS_OPCOES.map((o) => (<option key={o} value={o}>{o}</option>))}
                          </select>
                        </div>
                      );
                    }

                    // Área do Responsável — seletor
                    if (c.chave === "area") {
                      return (
                        <div key={c.rot} className="flex items-center gap-2 py-1.5" style={rowStyle}>
                          <span style={labelStyle}>{c.rot}</span>
                          <select value={AREA_OPCOES.includes(val) ? val : ""} onChange={(e) => salvarCampoHist({ area: e.target.value })} className="flex-1 px-2 py-1 rounded text-sm" style={campoStyle}>
                            {!AREA_OPCOES.includes(val) && <option value="">{val || "(selecionar)"}</option>}
                            {AREA_OPCOES.map((o) => (<option key={o} value={o}>{o}</option>))}
                          </select>
                        </div>
                      );
                    }

                    // Forma de Envio — seletor
                    if (c.chave === "forma_envio") {
                      return (
                        <div key={c.rot} className="flex items-center gap-2 py-1.5" style={rowStyle}>
                          <span style={labelStyle}>{c.rot}</span>
                          <select value={FORMA_OPCOES.includes(val) ? val : ""} onChange={(e) => salvarCampoHist({ forma_envio: e.target.value })} className="flex-1 px-2 py-1 rounded text-sm" style={campoStyle}>
                            {!FORMA_OPCOES.includes(val) && <option value="">{val || "(selecionar)"}</option>}
                            {FORMA_OPCOES.map((o) => (<option key={o} value={o}>{o}</option>))}
                          </select>
                        </div>
                      );
                    }

                    // Malha — chips de múltipla seleção (clique alterna)
                    if (c.chave === "malha") {
                      const keys = malhaStrParaKeys(val);
                      return (
                        <div key={c.rot} className="flex items-start gap-2 py-1.5" style={rowStyle}>
                          <span style={{ ...labelStyle, paddingTop: "3px" }}>{c.rot}</span>
                          <div className="flex-1 flex flex-wrap gap-1">
                            {MALHA_OPTIONS.map((m) => {
                              const on = keys.includes(m.key);
                              return (
                                <button
                                  key={m.key}
                                  title={m.nome}
                                  onClick={() => {
                                    const set = new Set(malhaStrParaKeys(String(histDetalhe.malha ?? "")));
                                    if (set.has(m.key)) set.delete(m.key); else set.add(m.key);
                                    salvarCampoHist({ malha: keysParaMalhaStr(Array.from(set)) });
                                  }}
                                  className="px-2 py-0.5 rounded text-xs"
                                  style={{ cursor: "pointer", border: `1px solid ${on ? "hsl(var(--rumo-green))" : "hsl(var(--border))"}`, background: on ? "hsl(var(--rumo-green) / 0.15)" : "transparent", color: on ? "hsl(var(--rumo-green))" : "hsl(var(--text-muted))", fontWeight: on ? 600 : 400 }}
                                >
                                  {m.sigla}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    // Demais campos — texto editável (responsável, tema, órgão, ofício, processo)
                    return (
                      <div key={c.rot} className="flex items-center gap-2 py-1.5" style={rowStyle}>
                        <span style={labelStyle}>{c.rot}</span>
                        <input
                          value={val}
                          onChange={(e) => setCampoLocal(c.chave!, e.target.value)}
                          onBlur={() => persistCampo(c.chave!)}
                          placeholder="(vazio)"
                          className="flex-1 px-2 py-1 rounded text-sm"
                          style={campoStyle}
                        />
                      </div>
                    );
                  })}
                </div>

                {histMinutaAberta && (
                  <div
                    className="mt-3 p-3 rounded-lg text-sm"
                    style={{
                      background: "hsl(var(--surface-app))",
                      border: "1px solid hsl(var(--border))",
                      color: "hsl(var(--text-secondary))",
                      whiteSpace: "pre-wrap",
                      lineHeight: "1.6",
                      maxHeight: "300px",
                      overflowY: "auto",
                    }}
                  >
                    {histDetalhe.minuta || "(minuta não disponível)"}
                  </div>
                )}

                {/* Arquivos relacionados a esta carta — vão junto ao SharePoint */}
                {(spMode === "webhook" || spPastaAtiva) && (
                  <div
                    className="mt-4 p-3 rounded-lg"
                    style={{ background: "hsl(var(--surface-app))", border: "1px solid hsl(var(--border))" }}
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm text-white font-medium">Arquivos desta carta</p>
                        <p style={{ color: "hsl(var(--text-muted))", fontSize: "12px" }}>
                          Anexos, recibo de protocolo, planilhas… vão junto com o .docx para o SharePoint.
                        </p>
                      </div>
                      <input
                        ref={anexosInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const novos = Array.from(e.target.files || []);
                          e.target.value = "";
                          if (novos.length) setAnexosCarta((a) => [...a, ...novos]);
                        }}
                      />
                      <SecondaryButton onClick={() => anexosInputRef.current?.click()}>
                        <Paperclip className="w-4 h-4" /> Adicionar arquivos
                      </SecondaryButton>
                    </div>

                    {anexosCarta.length > 0 ? (
                      <div className="mt-3 space-y-1.5">
                        {anexosCarta.map((f, i) => (
                          <div
                            key={`${f.name}-${i}`}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg"
                            style={{ background: "hsl(var(--surface-card))", border: "1px solid hsl(var(--border))" }}
                          >
                            <FileText className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--text-muted))" }} />
                            <span className="text-sm text-white truncate flex-1">{f.name}</span>
                            <span className="text-[11px] shrink-0" style={{ color: "hsl(var(--text-muted))" }}>
                              {(f.size / 1024 / 1024).toFixed(1)} MB
                            </span>
                            <button
                              onClick={() => setAnexosCarta((a) => a.filter((_, idx) => idx !== i))}
                              title="Remover arquivo"
                              className="p-1 rounded hover:opacity-80 shrink-0"
                              style={{ color: "hsl(var(--text-muted))" }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <p className="text-[11px] pt-1" style={{ color: "hsl(var(--text-muted))" }}>
                          Os arquivos ficam apenas nesta tela até você registrar ou criar a pasta — não são guardados no ARCA.
                        </p>
                      </div>
                    ) : (
                      <p className="text-[12px] mt-2" style={{ color: "hsl(var(--text-muted))" }}>
                        Nenhum arquivo adicionado. O .docx da carta é sempre enviado.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-4">
                  <SecondaryButton onClick={() => setHistMinutaAberta((v) => !v)}>
                    {histMinutaAberta ? "Ocultar minuta" : "Ver minuta"}
                  </SecondaryButton>
                  <SecondaryButton onClick={() => copiarTudoHistorico(histDetalhe)}>
                    <Copy className="w-4 h-4" /> {copiado === "tudo" ? "Copiado ✓" : "Copiar tudo"}
                  </SecondaryButton>
                  <SecondaryButton
                    onClick={async () => {
                      try {
                        const nome = await baixarHistoricoDocx(histDetalhe.id);
                        toast({ description: `Baixado: ${nome}` });
                      } catch (e: any) {
                        notificarErro(e.message || "Erro ao baixar o arquivo.");
                      }
                    }}
                  >
                    <Download className="w-4 h-4" /> Baixar .docx
                  </SecondaryButton>
                  <PrimaryButton onClick={() => reabrirDoHistorico(histDetalhe)}>
                    <PencilLine className="w-4 h-4" /> Reabrir para edição
                  </PrimaryButton>
                  {spPastaAtiva && (
                    <SecondaryButton
                      onClick={() => criarPastaNoSharePoint(histDetalhe.id)}
                      disabled={criandoPasta}
                    >
                      <FolderPlus className="w-4 h-4" />
                      {criandoPasta ? "Criando pasta…" : "Criar pasta no SharePoint"}
                    </SecondaryButton>
                  )}
                  {/* Registro no SharePoint — comportamento conforme o modo configurado */}
                  {spMode === "forms" ? (
                    <SecondaryButton onClick={() => abrirFormularioSharePoint(histDetalhe.id)} disabled={registrandoSP}>
                      <Share2 className="w-4 h-4" /> {registrandoSP ? "Abrindo…" : "Registrar via formulário"}
                    </SecondaryButton>
                  ) : spMode === "webhook" ? (
                    histDetalhe.sharepoint_em ? (
                      <span
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium"
                        style={{ background: "hsl(var(--rumo-green) / 0.12)", color: "hsl(var(--rumo-green))" }}
                      >
                        <Share2 className="w-4 h-4" /> Registrado no SharePoint
                        <button
                          onClick={() => registrarNoSharePoint(histDetalhe.id)}
                          disabled={registrandoSP}
                          className="text-xs underline ml-1"
                          style={{ background: "none", border: "none", color: "hsl(var(--text-muted))", cursor: "pointer" }}
                        >
                          registrar de novo
                        </button>
                      </span>
                    ) : (
                      <SecondaryButton onClick={() => registrarNoSharePoint(histDetalhe.id)} disabled={registrandoSP}>
                        <Share2 className="w-4 h-4" /> {registrandoSP ? "Registrando…" : "Registrar no SharePoint"}
                      </SecondaryButton>
                    )
                  ) : null}
                  <button
                    onClick={() => excluirDoHistorico(histDetalhe.id)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                    style={{
                      background: "transparent",
                      color: "hsl(var(--destructive))",
                      border: "1px solid hsl(var(--destructive) / 0.4)",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 className="w-4 h-4" /> Excluir
                  </button>
                </div>
              </div>
            )}

            {/* Lista */}
            {histCarregando ? (
              <div className="info-card flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "hsl(var(--primary))" }} />
                <span className="text-sm" style={{ color: "hsl(var(--text-secondary))" }}>
                  Carregando histórico…
                </span>
              </div>
            ) : histEntradas.length === 0 && !histDbOff ? (
              <div className="info-card">
                <p className="text-sm" style={{ color: "hsl(var(--text-muted))" }}>
                  Nenhuma carta encontrada.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs px-1" style={{ color: "hsl(var(--text-muted))" }}>
                  {histTotal > histEntradas.length
                    ? `${histEntradas.length} de ${histTotal} cartas`
                    : `${histEntradas.length} carta${histEntradas.length !== 1 ? "s" : ""}`}
                </p>
                {histEntradas.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => abrirDetalheHistorico(e.id)}
                    className={`info-card card-clickable w-full text-left flex items-center gap-3 ${
                      histDetalhe?.id === e.id ? "is-selected" : ""
                    }`}
                    style={{
                      padding: "12px 16px",
                      borderColor:
                        histDetalhe?.id === e.id ? "hsl(var(--primary))" : "hsl(var(--border))",
                      cursor: "pointer",
                    }}
                  >
                    <span className="font-semibold text-white text-sm" style={{ minWidth: "125px" }}>
                      {e.titulo}
                    </span>
                    {e.malha && (
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
                        style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
                      >
                        {e.malha}
                      </span>
                    )}
                    <span
                      className="flex-1 text-sm truncate"
                      style={{ color: "hsl(var(--text-muted))" }}
                    >
                      {e.tema}
                    </span>
                    <span className="text-xs flex-shrink-0" style={{ color: "hsl(var(--text-secondary))" }}>
                      {e.responsavel || "—"}
                    </span>
                    <span className="text-xs flex-shrink-0" style={{ color: "hsl(var(--text-muted))" }}>
                      {fmtDataHistorico(e.criado_em)}
                    </span>
                  </button>
                ))}
                {histEntradas.length < histTotal && (
                  <div className="flex justify-center pt-1">
                    <SecondaryButton onClick={() => carregarHistorico(true)} disabled={histCarregando}>
                      {histCarregando ? "Carregando…" : `Carregar mais (${histTotal - histEntradas.length} restantes)`}
                    </SecondaryButton>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <SecondaryButton onClick={() => goTo("modelos")}>
                <ArrowLeft className="w-4 h-4" /> Voltar ao início
              </SecondaryButton>
              <SecondaryButton onClick={() => carregarHistorico()}>
                <RefreshCw className="w-4 h-4" /> Atualizar
              </SecondaryButton>
            </div>
          </div>
        )}
        </div>
      </main>

      <IdentifyWidget />
      <Toaster />

      {/* ── Link bloqueado pelo navegador: abre manualmente ── */}
      {linkPendente && (
        <div
          onClick={() => setLinkPendente(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "hsl(210 100% 4% / 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="arca-fade"
            style={{
              background: "hsl(var(--surface-card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
              maxWidth: "460px",
              width: "100%",
              padding: "22px",
              boxShadow: "0 20px 50px hsl(210 100% 4% / 0.5)",
            }}
          >
            <p className="font-semibold text-white text-[15px] mb-1">{linkPendente.aviso}</p>
            <p className="text-sm mb-5" style={{ color: "hsl(var(--text-muted))", lineHeight: 1.6 }}>
              O navegador bloqueou a abertura automática da aba. Clique no botão abaixo para abrir.
            </p>
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setLinkPendente(null)}>Fechar</SecondaryButton>
              <a
                href={linkPendente.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setLinkPendente(null)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: "hsl(var(--accent))", color: "hsl(210 100% 6%)" }}
              >
                <Share2 className="w-4 h-4" /> Abrir no SharePoint
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de confirmação (substitui window.confirm) ── */}
      {confirmState.open && (
        <div
          onClick={() => responderConfirm(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "hsl(210 100% 4% / 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="arca-fade"
            style={{
              background: "hsl(var(--surface-card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
              maxWidth: "420px",
              width: "100%",
              padding: "22px",
              boxShadow: "0 20px 50px hsl(210 100% 4% / 0.5)",
            }}
          >
            <p className="font-semibold text-white text-[15px] mb-1">{confirmState.titulo}</p>
            <p className="text-sm mb-5" style={{ color: "hsl(var(--text-muted))", lineHeight: 1.6 }}>
              {confirmState.descricao}
            </p>
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => responderConfirm(false)}>Cancelar</SecondaryButton>
              <button
                onClick={() => responderConfirm(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: confirmState.perigo
                    ? "hsl(var(--destructive))"
                    : "hsl(var(--primary))",
                  color: confirmState.perigo
                    ? "hsl(var(--destructive-foreground))"
                    : "hsl(var(--primary-foreground))",
                  cursor: "pointer",
                }}
              >
                {confirmState.rotuloOk || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
