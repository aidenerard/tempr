import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

type LogoProps = {
  size?: number;
};

export function Logo({ size = 240 }: LogoProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
    >
      <Defs>
        <LinearGradient
          id="temprLogoGrad"
          x1={76}
          y1={52}
          x2={164}
          y2={188}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor="#CC6213" />
          <Stop offset="1" stopColor="#FF2D55" />
        </LinearGradient>
      </Defs>
      {/* Background */}
      <Rect
        width={240}
        height={240}
        x={0}
        y={0}
        rx={48}
        fill="#0F0F14"
      />
      {/* Flame / Wave Icon */}
      <Path
        d="M120 52 C140 78, 164 98, 164 132 C164 168, 140 188, 120 188 C100 188, 76 168, 76 132 C76 104, 94 86, 108 70 C114 64, 118 58, 120 52Z"
        fill="url(#temprLogoGrad)"
      />
      {/* Inner sound wave */}
      <Path
        d="M120 92 C130 104, 136 114, 136 132 C136 150, 128 162, 120 162 C112 162, 104 150, 104 132 C104 118, 110 108, 120 92Z"
        fill="#0F0F14"
        opacity={0.9}
      />
    </Svg>
  );
}
