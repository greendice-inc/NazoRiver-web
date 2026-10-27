"""Build the title logo SVG from traced letter paths."""
import sys

geki = open("path_geki.txt").read()
nazo = open("path_nazo.txt").read()
out = sys.argv[1] if len(sys.argv) > 1 else "title-logo.svg"

# viewBox in stage pixels of the original art (letters keep their original placement)
VB = (20, 10, 1400, 520)


def body(pid, depth, side, line, fill, gloss_y0, gloss_y1, extra=""):
    ext = []
    for i in range(depth, 0, -2):
        ext.append(f'<use href="#{pid}" transform="translate(0 {i})" class="k-out"/>')
    side_layers = []
    for i in range(depth, 0, -2):
        side_layers.append(f'<use href="#{pid}" transform="translate(0 {i})" class="k-side" stroke="{side}" fill="{side}"/>')
    return f"""
    <g class="k-extrude">{''.join(ext)}{''.join(side_layers)}</g>
    <use href="#{pid}" class="k-rim-out"/>
    <use href="#{pid}" class="k-rim"/>
    <use href="#{pid}" class="k-line"/>
    <use href="#{pid}" fill="url(#{fill})"/>
    {extra}
    <g clip-path="url(#{pid}-clip)">
      <rect x="0" y="{gloss_y0}" width="1500" height="{gloss_y1 - gloss_y0}" fill="url(#gloss)"/>
      <g class="k-shine"><rect x="-260" y="0" width="150" height="560" fill="url(#shine)" transform="skewX(-22)"/></g>
    </g>"""


svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB[0]} {VB[1]} {VB[2]} {VB[3]}" class="title-logo-svg">
  <defs>
    <path id="kGeki" d="{geki}"/>
    <path id="kNazo" d="{nazo}"/>
    <clipPath id="kGeki-clip"><use href="#kGeki"/></clipPath>
    <clipPath id="kNazo-clip"><use href="#kNazo"/></clipPath>
    <linearGradient id="gekiFill" gradientUnits="userSpaceOnUse" x1="0" y1="60" x2="0" y2="300">
      <stop offset="0" stop-color="#fff59a"/>
      <stop offset="0.28" stop-color="#ffd23a"/>
      <stop offset="0.62" stop-color="#ff8a1e"/>
      <stop offset="1" stop-color="#e5321a"/>
    </linearGradient>
    <linearGradient id="nazoFill" gradientUnits="userSpaceOnUse" x1="0" y1="196" x2="0" y2="470">
      <stop offset="0" stop-color="#b6fbff"/>
      <stop offset="0.3" stop-color="#4fd2ff"/>
      <stop offset="0.62" stop-color="#2394f2"/>
      <stop offset="1" stop-color="#1a4fd0"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <pattern id="waves" width="96" height="26" patternUnits="userSpaceOnUse">
      <path d="M0 13 Q24 3 48 13 T96 13" fill="none" stroke="#fff" stroke-opacity="0.32" stroke-width="5"/>
      <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="96 0" dur="6s" repeatCount="indefinite"/>
    </pattern>
    <linearGradient id="badgeFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3d6cf0"/>
      <stop offset="1" stop-color="#1a2f8c"/>
    </linearGradient>
    <linearGradient id="badgeText" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.15" stop-color="#ffffff"/>
      <stop offset="0.55" stop-color="#fff38a"/>
      <stop offset="1" stop-color="#ffc21a"/>
    </linearGradient>
  </defs>

  <g class="k-part k-nazo">{body("kNazo", 18, "#1d3d9e", "#2a1204", "nazoFill", 196, 300,
        '<use href="#kNazo" fill="url(#waves)"/>')}
  </g>

  <g class="k-part k-geki">{body("kGeki", 14, "#9a2a0c", "#2a1204", "gekiFill", 50, 150)}
  </g>

  <g class="k-part k-badge"><g transform="translate(800 118) rotate(-2)">
    <rect x="-262" y="-36" width="524" height="88" rx="44" fill="#2a1204"/>
    <rect x="-262" y="-48" width="524" height="88" rx="44" fill="#2a1204"/>
    <rect x="-254" y="-40" width="508" height="72" rx="36" fill="#fff"/>
    <rect x="-246" y="-32" width="492" height="56" rx="28" fill="url(#badgeFill)"/>
    <rect x="-232" y="-28" width="464" height="18" rx="9" fill="#fff" fill-opacity="0.28"/>
    <text x="0" y="13" class="k-badge-text" text-anchor="middle">オンライン版</text>
    <path class="k-star" d="M-300 -30 l9 20 21 3 -16 14 5 21 -19 -11 -19 11 5 -21 -16 -14 21 -3z" fill="#ffe14d" stroke="#2a1204" stroke-width="5" stroke-linejoin="round"/>
    <path class="k-star" d="M300 -30 l9 20 21 3 -16 14 5 21 -19 -11 -19 11 5 -21 -16 -14 21 -3z" fill="#ffe14d" stroke="#2a1204" stroke-width="5" stroke-linejoin="round"/>
  </g></g>
</svg>
"""
open(out, "w").write(svg)
print("wrote", out, len(svg))
