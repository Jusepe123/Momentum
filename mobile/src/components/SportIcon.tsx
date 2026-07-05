import Svg, { Circle, Path } from 'react-native-svg'

/**
 * Sport pictograms ported from the web src/components/sportIcons.tsx to
 * react-native-svg. RN svg has no `currentColor`, so identity color arrives as
 * an explicit `color` prop and is threaded to each shape's stroke/fill.
 */

type Sport = 'strength' | 'run' | 'bike'

/** Overhead squat: barbell locked out, hips low. */
function StrengthBody({ color }: { color: string }) {
  return (
    <>
      <Path d="M7 13 H41" {...stroke(color)} />
      <Path d="M11 7 V19" {...stroke(color)} />
      <Path d="M37 7 V19" {...stroke(color)} />
      <Circle cx={24} cy={20} r={3.2} fill={color} />
      <Path d="M15 13 L21 25" {...stroke(color)} />
      <Path d="M33 13 L27 25" {...stroke(color)} />
      <Path d="M24 25 V31" {...stroke(color)} />
      <Path d="M24 31 L17 35 L19 42" {...stroke(color)} />
      <Path d="M24 31 L31 35 L29 42" {...stroke(color)} />
    </>
  )
}

/** Mid-stride runner, arms driving. */
function RunBody({ color }: { color: string }) {
  return (
    <>
      <Circle cx={30} cy={8.5} r={3.2} fill={color} />
      <Path d="M28 14 L22 27" {...stroke(color)} />
      <Path d="M27 16 L34 19 L40 14" {...stroke(color)} />
      <Path d="M27 16 L20 20 L14 17" {...stroke(color)} />
      <Path d="M22 27 L30 32 L29 41" {...stroke(color)} />
      <Path d="M22 27 L16 33 L9 30" {...stroke(color)} />
    </>
  )
}

/** Road bike: two wheels, diamond frame, handlebars. */
function BikeBody({ color }: { color: string }) {
  return (
    <>
      <Circle cx={11} cy={33} r={8} {...stroke(color)} />
      <Circle cx={37} cy={33} r={8} {...stroke(color)} />
      <Path d="M11 33 L21 15 L34 15" {...stroke(color)} />
      <Path d="M21 15 L27 33 L37 33" {...stroke(color)} />
      <Path d="M11 33 L27 33" {...stroke(color)} />
      <Path d="M31 12 H38" {...stroke(color)} />
    </>
  )
}

function stroke(color: string) {
  return {
    fill: 'none',
    stroke: color,
    strokeWidth: 4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const
}

const bodies: Record<Sport, (props: { color: string }) => React.ReactElement> = {
  strength: StrengthBody,
  run: RunBody,
  bike: BikeBody,
}

export function SportIcon({
  sport,
  color,
  size = 28,
}: {
  sport: Sport
  color: string
  size?: number
}) {
  const Body = bodies[sport]
  return (
    <Svg viewBox="0 0 48 48" width={size} height={size}>
      <Body color={color} />
    </Svg>
  )
}
