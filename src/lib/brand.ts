// benchtop brand constants, taken from design_system/ (tokens/colors.css, assets/logo-mark.svg).

export const BRAND = {
  lcd: '#D6F55A', // LCD backlight lime: the hero colour
  ink: '#16200E', // green-black of a lit segment
  paper: '#FBF8EC', // warm page cream
} as const

// The mark: a lowercase "b" built from five LCD trapezoid segments, viewBox 100x170
export const LOGO_VIEWBOX = { width: 100, height: 170 }
export const LOGO_SEGMENTS = [
  '0,0 18,18 18,80 0,80',
  '0,90 18,90 18,152 0,170',
  '21,94 39,76 61,76 79,94',
  '82,90 100,90 100,170 82,152',
  '21,170 39,152 61,152 79,170',
]

// Square app icon as an SVG data URI, for ImageResponse routes. The mark sits at the same
// proportions as design_system/assets/app-icon.svg, minus its stray scale(.58) that left the
// mark small and off-centre. `radius` is a fraction of the size;
// leave it 0 for Apple/PWA icons, where the OS applies its own mask.
export function appIconDataUri({
  size,
  radius = 0,
  bg = BRAND.lcd,
  fg = BRAND.ink,
}: {
  size: number
  radius?: number
  bg?: string
  fg?: string
}) {
  const polys = LOGO_SEGMENTS.map((p) => `<polygon points="${p}" fill="${fg}"/>`).join('')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}">` +
    `<rect width="256" height="256" rx="${256 * radius}" fill="${bg}"/>` +
    `<g transform="translate(78 43)">${polys}</g></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}
