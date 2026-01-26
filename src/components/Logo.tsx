interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-6xl",
  xl: "text-8xl",
};

export function Logo({ className = "", size = "md" }: LogoProps) {
  return (
    <span
      className={`font-serif font-bold select-none ${sizeMap[size]} ${className}`}
      style={{ fontFamily: "Times New Roman, Times, serif" }}
    >
      {/* Primera A: negro (#000) → gris 70% (#4d4d4d) */}
      <span
        style={{
          background: "linear-gradient(to bottom, #000000, #4d4d4d)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        A
      </span>
      {/* Segunda A: gris 70% (#4d4d4d) → gris 40% (#999999) */}
      <span
        style={{
          background: "linear-gradient(to bottom, #4d4d4d, #999999)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        A
      </span>
      {/* Tercera A: gris 40% (#999999) → gris 20% (#cccccc) */}
      <span
        style={{
          background: "linear-gradient(to bottom, #999999, #cccccc)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        A
      </span>
    </span>
  );
}
