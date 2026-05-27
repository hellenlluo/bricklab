"use client";

export interface BrickPreviewProps {
  studsX: number;
  studsY: number;
  className?: string;
  stroke?: string;
  strokeWidth?: number;
}

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;
const STUD_RADIUS = 0.24;
const STUD_HEIGHT = 0.18;
const BODY_HEIGHT = 0.96;

function project(x: number, y: number, z: number): [number, number] {
  return [(x - y) * COS30, (x + y) * SIN30 - z];
}

const STUD_RX_UNIT = STUD_RADIUS * COS30 * Math.SQRT2;
const STUD_RY_UNIT = STUD_RADIUS * SIN30 * Math.SQRT2;

/** Isometric face fills derived from accent (#908095) and accent-dark (#7d6f82). */
const ACCENT_BRICK_FILLS = {
  faceLeft: "#7d6f82",
  faceRight: "#908095",
  faceTop: "#b5a8b9",
  studWall: "#857789",
  studTop: "#c9c0ca",
  stroke: "#6a5d6f",
} as const;

export default function BrickPreview({
  studsX,
  studsY,
  className,
  stroke = ACCENT_BRICK_FILLS.stroke,
  strokeWidth = 0.6,
}: BrickPreviewProps) {
  const W = studsX;
  const D = studsY;
  const H = BODY_HEIGHT;
  const SH = STUD_HEIGHT;

  const isoW = (W + D) * COS30;
  const isoH = (W + D) * SIN30 + H;
  const scale = 80 / Math.max(isoW, isoH);

  const ox = 50 - ((W - D) * COS30 * scale) / 2;
  const oy = 50 - (((W + D) * SIN30 - H) * scale) / 2;

  function svgPt(x: number, y: number, z: number): [number, number] {
    const [px, py] = project(x, y, z);
    return [ox + px * scale, oy + py * scale];
  }

  function polyPts(...coords: [number, number, number][]): string {
    return coords.map(([x, y, z]) => svgPt(x, y, z).join(",")).join(" ");
  }

  const rx = STUD_RX_UNIT * scale;
  const ry = STUD_RY_UNIT * scale;

  const shared = {
    stroke,
    strokeWidth,
    strokeLinejoin: "round" as const,
  };

  const studs = Array.from({ length: studsX * studsY }, (_, i) => ({
    ix: Math.floor(i / studsY),
    iy: i % studsY,
  })).sort((a, b) => a.ix + a.iy - (b.ix + b.iy));

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left face */}
      <polygon
        points={polyPts([0, D, 0], [W, D, 0], [W, D, H], [0, D, H])}
        fill={ACCENT_BRICK_FILLS.faceLeft}
        {...shared}
      />

      {/* Right face */}
      <polygon
        points={polyPts([W, 0, 0], [W, D, 0], [W, D, H], [W, 0, H])}
        fill={ACCENT_BRICK_FILLS.faceRight}
        {...shared}
      />

      {/* Top face */}
      <polygon
        points={polyPts([0, 0, H], [W, 0, H], [W, D, H], [0, D, H])}
        fill={ACCENT_BRICK_FILLS.faceTop}
        {...shared}
      />

      {/* Studs */}
      {studs.map(({ ix, iy }) => {
        const [bcx, bcy] = svgPt(ix + 0.5, iy + 0.5, H);
        const [tcx, tcy] = svgPt(ix + 0.5, iy + 0.5, H + SH);

        const wall = [
          `M ${bcx - rx},${bcy}`,
          `A ${rx} ${ry} 0 0 0 ${bcx + rx},${bcy}`,
          `L ${tcx + rx},${tcy}`,
          `A ${rx} ${ry} 0 0 0 ${tcx - rx},${tcy}`,
          `Z`,
        ].join(" ");

        return (
          <g key={`${ix}-${iy}`}>
            <path d={wall} fill={ACCENT_BRICK_FILLS.studWall} {...shared} />
            <ellipse
              cx={tcx}
              cy={tcy}
              rx={rx}
              ry={ry}
              fill={ACCENT_BRICK_FILLS.studTop}
              {...shared}
            />
          </g>
        );
      })}
    </svg>
  );
}
