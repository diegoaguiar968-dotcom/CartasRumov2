import { Zap, Paperclip, Scale, Lightbulb, ArrowLeft } from "lucide-react";
import { SecondaryButton } from "../ui-kit";

/** Etapa "Como usar" — conteúdo estático de ajuda. */
export default function AjudaStep({ onGoTo }: { onGoTo: (key: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="info-card">
        <h2 className="font-semibold text-white text-[15px] mb-1">Como usar o ARCA</h2>
        <p style={{ color: "hsl(var(--text-muted))", fontSize: "13.5px", lineHeight: "1.6" }}>
          A ferramenta opera em dois modos:{" "}
          <strong className="text-white">Carta Resposta</strong> (quando a ANTT envia um ofício
          solicitando informações) e <strong className="text-white">Carta Espontânea</strong>{" "}
          (quando a Rumo toma a iniciativa de comunicação). Nos dois casos, a IA redige a minuta
          completa no padrão institucional Rumo e exporta o arquivo Word pronto para revisão.
        </p>
      </div>

      {/* ── Modo Carta Resposta ── */}
      <div className="info-card" style={{ borderColor: "hsl(var(--rumo-green) / 0.3)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "hsl(var(--rumo-green))" }}>
          Modo Carta Resposta (resposta a ofício)
        </p>
        <div className="space-y-3">
          {[
            { num: "1", title: "Escolha o modelo de carta", desc: "Selecione o tipo de carta adequado ao teor do ofício. O modelo define a estrutura, o tom e a formatação do documento final." },
            { num: "2", title: "Faça upload do ofício recebido", desc: "Envie o PDF do ofício da ANTT. A IA extrai automaticamente número, processo SEI, prazo, signatário, malha(s) envolvida(s) e todos os pontos que precisam de resposta." },
            { num: "2+", title: "Adicione documentos complementares (opcional)", desc: "Se o ofício vier acompanhado de nota técnica, resolução ou outro documento de referência, faça upload aqui. Esses arquivos enriquecem o contexto da IA mas não são listados individualmente na carta." },
            { num: "3", title: "Forneça as respostas de mérito", desc: "Preencha a resposta para cada ponto levantado no ofício. Seja preciso — apenas você detém as informações técnicas reais. A IA usa o que você escreveu para redigir a minuta." },
            { num: "4", title: "Revise, refine e exporte", desc: "Leia a minuta. Use o chat para solicitar ajustes pontuais sem regerar do zero. Informe o número interno da carta (ex: 0001) e exporte em .docx." },
          ].map((s) => (
            <div key={s.num} className="flex gap-3">
              <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5" style={{ background: "hsl(var(--rumo-green) / 0.12)", color: "hsl(var(--rumo-green))" }}>
                {s.num}
              </div>
              <div>
                <p className="font-semibold text-white text-sm mb-0.5">{s.title}</p>
                <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--text-muted))" }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modo Carta Espontânea ── */}
      <div className="info-card" style={{ borderColor: "hsl(var(--primary) / 0.3)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "hsl(var(--primary))" }}>
          Modo Carta Espontânea (comunicação proativa)
        </p>
        <div className="space-y-3">
          {[
            { num: "1", title: "Escolha o modelo de carta", desc: "Selecione o tipo de carta. Para comunicações proativas use preferencialmente o modelo Documentação ou Objetiva." },
            { num: "2", title: "Preencha os dados da carta", desc: "Informe destinatário, cargo e área na ANTT; marque a(s) malha(s) Rumo remetente(s) — pode ser mais de uma; descreva o assunto com os dados e argumentos relevantes; e, se houver, informe processo SEI e referência. Adicione documentos complementares para enriquecer o contexto da IA." },
            { num: "3", title: "Revise, refine e exporte", desc: "Revise a minuta gerada, use o chat para ajustes e exporte. Informe o número interno da carta antes de baixar o arquivo." },
          ].map((s) => (
            <div key={s.num} className="flex gap-3">
              <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5" style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
                {s.num}
              </div>
              <div>
                <p className="font-semibold text-white text-sm mb-0.5">{s.title}</p>
                <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--text-muted))" }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modelos de carta ── */}
      <div className="info-card">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "hsl(var(--text-secondary))" }}>
          Os três modelos de carta
        </p>
        <div className="space-y-3">
          {[
            { icon: Zap, nome: "Resposta Objetiva", desc: "Para respostas curtas com 1 a 2 pontos. Tom direto, sem subdivisões — ideal para dilações de prazo, confirmações e comunicados simples." },
            { icon: Paperclip, nome: "Resposta com Documentação", desc: "Quando a carta encaminha documentos como anexos ou faz referência a arquivos. Inclui seção de documentos encaminhados ao final do corpo." },
            { icon: Scale, nome: "Resposta Jurídico-Regulatória", desc: "Para respostas com fundamentação legal, citação de normas, resoluções ANTT ou cláusulas contratuais. Estrutura com numeração romana e linguagem jurídica formal." },
          ].map((m) => (
            <div key={m.nome} className="flex gap-3">
              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "hsl(var(--surface-hover))" }}>
                <m.icon className="w-3.5 h-3.5" style={{ color: "hsl(var(--text-secondary))" }} />
              </div>
              <div>
                <p className="font-semibold text-white text-sm mb-0.5">{m.nome}</p>
                <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--text-muted))" }}>{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Identificação e histórico ── */}
      <div className="info-card" style={{ borderColor: "hsl(var(--rumo-green) / 0.3)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "hsl(var(--rumo-green))" }}>
          Identificação e histórico compartilhado
        </p>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5" style={{ background: "hsl(var(--rumo-green) / 0.12)", color: "hsl(var(--rumo-green))" }}>
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
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5" style={{ background: "hsl(var(--rumo-green) / 0.12)", color: "hsl(var(--rumo-green))" }}>
              🗂
            </div>
            <div>
              <p className="font-semibold text-white text-sm mb-0.5">Histórico de cartas da equipe</p>
              <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--text-muted))" }}>
                Toda carta exportada fica registrada no vagão{" "}
                <button
                  onClick={() => onGoTo("historico")}
                  style={{ background: "none", border: "none", padding: 0, color: "hsl(var(--primary))", textDecoration: "underline", cursor: "pointer", font: "inherit" }}
                >
                  Histórico
                </button>
                , com filtros por responsável, malha e busca livre. Nos detalhes, os campos aparecem
                na mesma ordem da lista do SharePoint, prontos para copiar — e é possível baixar
                novamente o .docx ou reabrir qualquer carta para edição.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Boas práticas ── */}
      <div className="info-card">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "hsl(204 76% 65%)" }}>
          Boas práticas
        </p>
        <div className="space-y-2">
          {[
            { tip: "Respostas de mérito detalhadas geram minutas melhores.", detail: "Quanto mais contexto técnico você fornecer nos campos de resposta, menor a necessidade de refinamento posterior." },
            { tip: "Use o chat de refinamento para ajustes pontuais.", detail: 'Exemplos: "Torne o 3º parágrafo mais objetivo", "Adicione menção ao prazo de 30 dias", "Remova a menção à resolução X".' },
            { tip: "O texto da minuta também pode ser editado diretamente.", detail: "Além do chat, você pode clicar no texto e ajustar palavras ou frases manualmente antes de exportar." },
            { tip: "O número da carta é obrigatório antes de exportar.", detail: "Digite apenas os 4 dígitos do número sequencial. O arquivo será nomeado automaticamente como: 0001 - GREG - 2026 - Assunto - RMC.docx" },
            { tip: "Documentos complementares são contexto, não conteúdo.", detail: "Notas técnicas e resoluções anexadas enriquecem a minuta indiretamente. A IA não os lista na carta — use-os para fundamentar argumentos." },
            { tip: "O arquivo exportado já está no padrão visual Rumo.", detail: "Revise o conteúdo no Word, salve como PDF quando precisar da versão final para envio." },
          ].map((s, n) => (
            <div key={n} className="flex gap-2">
              <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-1" style={{ color: "hsl(204 76% 65%)" }} />
              <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--text-muted))" }}>
                <strong className="text-white">{s.tip}</strong> {s.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      <SecondaryButton onClick={() => onGoTo("modelos")}>
        <ArrowLeft className="w-4 h-4" /> Voltar ao início
      </SecondaryButton>
    </div>
  );
}
