import { CheckCircle2 } from "lucide-react";

export interface Step {
  number: number;
  key: string;
  label: string;
}

/** Trilho ferroviário: vagões com rodas sobre trilhos com dormentes. */
export default function Stepper({
  steps,
  activeStepKey,
  completedKeys,
  onGoTo,
}: {
  steps: Step[];
  activeStepKey: string;
  completedKeys: Set<string>;
  onGoTo: (key: string) => void;
}) {
  return (
    <div className="mb-10 rail-scroll" style={{ paddingBottom: "4px" }}>
      <div className="relative rail-wagons" style={{ minHeight: "105px" }}>
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
                onClick={() => onGoTo(step.key)}
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
    </div>
  );
}
