import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/bloqueado")({
  component: BloqueadoPage,
});

function BloqueadoPage() {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a0f1e 0%, #0d1b2a 50%, #0a0f1e 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        color: "#e2e8f0",
        padding: "2rem",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Grid de fundo animado */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }}
      />

      {/* Glow central */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(220,38,38,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Shield animado */}
      <div
        style={{
          position: "relative",
          marginBottom: "2rem",
          animation: "pulse 2s ease-in-out infinite",
        }}
      >
        <svg
          width="96"
          height="96"
          viewBox="0 0 24 24"
          fill="none"
          style={{ filter: "drop-shadow(0 0 24px rgba(220,38,38,0.6))" }}
        >
          <path
            d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z"
            fill="rgba(220,38,38,0.15)"
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 12l2 2 4-4"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: "none" }}
          />
          <path
            d="M12 8v4M12 16h.01"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Título */}
      <h1
        style={{
          fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          marginBottom: "0.75rem",
          background: "linear-gradient(135deg, #f87171, #ef4444)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          lineHeight: 1.2,
        }}
      >
        Acesso Restrito
      </h1>

      {/* Subtítulo */}
      <p
        style={{
          fontSize: "clamp(0.9rem, 2vw, 1.1rem)",
          color: "#94a3b8",
          maxWidth: "480px",
          lineHeight: 1.7,
          marginBottom: "2.5rem",
        }}
      >
        Esta página detectou o uso de ferramentas de desenvolvedor.
        Por motivos de segurança, o acesso foi bloqueado.
      </p>

      {/* Card de aviso */}
      <div
        style={{
          background: "rgba(220,38,38,0.08)",
          border: "1px solid rgba(220,38,38,0.25)",
          borderRadius: "16px",
          padding: "1.5rem 2rem",
          maxWidth: "480px",
          width: "100%",
          marginBottom: "2rem",
          backdropFilter: "blur(8px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
            textAlign: "left",
          }}
        >
          <span style={{ fontSize: "1.25rem", marginTop: "2px" }}>⚠️</span>
          <p style={{ fontSize: "0.875rem", color: "#fca5a5", lineHeight: 1.6, margin: 0 }}>
            Esta tentativa foi registrada. O uso indevido de ferramentas de
            inspeção neste sistema é monitorado e pode ser reportado às
            autoridades competentes.
          </p>
        </div>
      </div>

      {/* Badge de monitoramento */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "rgba(15,23,42,0.8)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "9999px",
          padding: "0.5rem 1.25rem",
          fontSize: "0.8rem",
          color: "#64748b",
          marginBottom: "3rem",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#ef4444",
            animation: "blink 1s ease-in-out infinite",
          }}
        />
        Monitorando{dots}
      </div>

      {/* Logo / Identificação */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
          opacity: 0.5,
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.1rem",
          }}
        >
          🏛️
        </div>
        <p style={{ fontSize: "0.75rem", color: "#475569", margin: 0 }}>
          Conselho Regional de Medicina de São Paulo
        </p>
        <p style={{ fontSize: "0.7rem", color: "#334155", margin: 0 }}>
          Sistema protegido — acesso monitorado
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.85; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
