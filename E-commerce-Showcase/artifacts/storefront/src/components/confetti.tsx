import { useMemo } from "react";

const COLORS = ["#22c55e", "#fb7185", "#f97316", "#38bdf8", "#facc15", "#a855f7"];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function Confetti({ active }: { active: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 80 }, (_, index) => ({
        id: `confetti-${index}`,
        left: `${randomBetween(5, 92)}%`,
        size: `${randomBetween(6, 16)}px`,
        delay: `${randomBetween(0, 1.2)}s`,
        duration: `${randomBetween(3.2, 5.4)}s`,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        opacity: randomBetween(0.75, 1).toFixed(2),
      })),
    [],
  );

  if (!active) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-[1000] overflow-hidden">
        {pieces.map((piece) => (
          <span
            key={piece.id}
            className="absolute rounded-full"
            style={{
              left: piece.left,
              top: "-10%",
              width: piece.size,
              height: piece.size,
              opacity: piece.opacity,
              backgroundColor: piece.color,
              animation: `confetti-fall ${piece.duration} cubic-bezier(0.25, 0.46, 0.45, 0.94) ${piece.delay} both`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translate3d(0, 0, 0) rotate(0deg);
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: translate3d(20px, 110vh, 0) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}
