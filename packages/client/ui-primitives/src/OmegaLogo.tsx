import type { IconProps } from './icons/props.ts'

/** Native viewBox of {@link OMEGA_LOGO_PATH} (width and height in user units). */
export const OMEGA_LOGO_VIEWBOX = { width: 24, height: 24 }

/** The Greek omega mark path data, exported for consumers that compose their own svg (entrance effects, masks) around the same geometry. */
export const OMEGA_LOGO_PATH = 'M2.787 21.5V18.352H6.406Q3.08 14.861 3.08 10.834Q3.08 7.317 5.463 4.908Q7.846 2.5 12 2.5Q16.116 2.5 18.512 4.896Q20.907 7.291 20.907 10.834Q20.907 14.861 17.581 18.352H21.213V21.5H12.663V18.493Q14.816 17.69 15.919 15.893Q17.021 14.096 17.021 11.752Q17.021 9.343 15.753 7.534Q14.485 5.724 12 5.724Q9.528 5.724 8.254 7.521Q6.979 9.318 6.979 11.752Q6.979 14.109 8.081 15.899Q9.184 17.69 11.337 18.493V21.5Z'

/**
 * Render the omega logo.
 * @param props.size - width in px (default 24; height keeps the square ratio).
 * @param props.className - extra class for layout placement.
 * @returns the logo svg (aria-hidden; pair with the wordmark for accessibility).
 */
export function OmegaLogo({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={(size * OMEGA_LOGO_VIEWBOX.height) / OMEGA_LOGO_VIEWBOX.width}
      className={className}
      viewBox={`0 0 ${OMEGA_LOGO_VIEWBOX.width} ${OMEGA_LOGO_VIEWBOX.height}`}
      fill="none"
      aria-hidden="true"
    >
      <path d={OMEGA_LOGO_PATH} fill="currentColor" />
    </svg>
  )
}
