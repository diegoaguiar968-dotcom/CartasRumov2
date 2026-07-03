const API_BASE = (window as any).API_URL || "";
const SESSION_ID_KEY = "arca-session-id";

export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

async function req(path: string, opts: RequestInit = {}) {
  const isForm = opts.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      "X-Session-ID": getSessionId(),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erro na requisição" }));
    throw new Error(err.message || "Erro na requisição");
  }
  return res;
}

// ── Templates ──
export interface Template {
  id: string;
  nome: string;
  descricao: string;
  uso: string;
}

export async function getTemplates(): Promise<{ success: boolean; templates: Template[] }> {
  const res = await req("/api/models/templates");
  return res.json();
}

// ── Modelos (PDFs de referência) ──
export async function uploadModelos(files: File[]) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await req("/api/models/upload", { method: "POST", body: form });
  return res.json();
}

// ── Ofício ──
export interface Briefing {
  numero: string;
  processo: string;
  data: string;
  signatarioAntt: string;
  area: string;
  prazo: string;
  natureza: string;
  fundamentoLegal: string;
  malha: string;
  assunto: string;
  pontos: string[];
  documentosRequisitados: string[];
}

export async function uploadOficio(file: File): Promise<{ success: boolean; briefing: Briefing }> {
  const form = new FormData();
  form.append("file", file);
  const res = await req("/api/oficio/upload", { method: "POST", body: form });
  return res.json();
}

export async function uploadComplementar(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await req("/api/oficio/complementar", { method: "POST", body: form });
  return res.json();
}

// ── Minuta ──
export interface MinutaMeta {
  signatarioAntt: string;
  cargoAntt: string;
  malha: string;
  assunto: string;
  processo: string;
  referencia: string;
  modeloId: string;
}

export interface AiFeedback {
  resumo: string;
  atencao: string[];
  dicas: string[];
}

export interface MinutaResponse {
  success: boolean;
  minuta: string;
  texto: string;
  feedback?: AiFeedback | null;
  meta: MinutaMeta;
}

export async function gerarMinuta(params: {
  modeloId: string;
  briefing: Briefing;
  pontosRespondidos: { ponto: string; resposta: string }[];
}): Promise<MinutaResponse> {
  const res = await req("/api/minuta/generate", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function gerarCartaEspontanea(params: {
  modeloId: string;
  destinatario: string;
  cargoDestinatario: string;
  area: string;
  malha: string;
  referencia?: string;
  processo?: string;
  assunto: string;
}): Promise<MinutaResponse> {
  const res = await req("/api/minuta/generate-espontanea", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function refinarMinuta(params: {
  textoAtual: string;
  mensagem: string;
  historico: { role: string; content: string; minutaRef?: string }[];
}): Promise<{ success: boolean; texto: string; minuta: string; feedback?: AiFeedback | null }> {
  const res = await req("/api/minuta/refinar", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return res.json();
}

// ── Histórico ──
export interface HistoricoEntrada {
  id: string;
  criado_em: string;
  titulo: string;
  nome_arquivo: string;
  responsavel: string;
  area: string;
  assuntos: string;
  tema: string;
  orgao: string;
  malha: string;
  oficio: string;
  processo: string;
  forma_envio: string;
  modelo_id: string;
  signatario_antt: string;
  cargo_antt: string;
  minuta?: string;
}

export async function getHistorico(
  filtros: Record<string, string> = {}
): Promise<{ success: boolean; historico: HistoricoEntrada[]; dbDesativado?: boolean }> {
  const params = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => v)
  );
  const res = await req(`/api/historico?${params}`);
  return res.json();
}

export async function getHistoricoOpcoes(): Promise<{
  success: boolean;
  responsaveis: string[];
  malhas: string[];
  orgaos: string[];
}> {
  const res = await req("/api/historico/opcoes");
  return res.json();
}

export async function getHistoricoDetalhe(
  id: string
): Promise<{ success: boolean; entrada: HistoricoEntrada }> {
  const res = await req(`/api/historico/${id}`);
  return res.json();
}

export async function excluirHistoricoEntrada(id: string): Promise<{ success: boolean }> {
  const res = await req(`/api/historico/${id}`, { method: "DELETE" });
  return res.json();
}

export function urlHistoricoDocx(id: string): string {
  return `${API_BASE}/api/historico/${id}/docx`;
}

// ── Export ──
export async function downloadDocx(
  numeroOficio: string,
  conteudo: string,
  meta: Partial<MinutaMeta> & { responsavel?: string; area?: string; orgao?: string }
): Promise<string> {
  const res = await req("/api/export/docx", {
    method: "POST",
    body: JSON.stringify({ numero_oficio: numeroOficio, conteudo, meta }),
  });
  const blob = await res.blob();
  const nomeArquivo =
    res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] || "resposta.docx";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return nomeArquivo;
}
