import { Loader2 } from "lucide-react";

/** Card padrão com título e corpo (usado em todas as etapas). */
export function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="info-card">
      <h2 className="font-semibold text-white text-[15px] mb-1">{title}</h2>
      <div style={{ color: "hsl(var(--text-muted))", fontSize: "13.5px", lineHeight: "1.6" }}>{children}</div>
    </div>
  );
}

export function PrimaryButton({
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

export function SecondaryButton({
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

export function TextField({
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
