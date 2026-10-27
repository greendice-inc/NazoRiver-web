# Title art pipeline

Regenerates the title key visual without baked-in text and the vector logo.
Needs Python with `opencv-python`, `numpy`, `pillow`, `potracer` (`pip install opencv-python pillow potracer`).
Run inside this folder; intermediate files stay here (gitignored).

1. `python compose.py`: joins `public/art/on_*.webp` into `on_full.png`.
2. `python make_art.py`: builds masks for the old logo, pill, ribbons and company logo (`m_*.npy`).
3. `python inpaint.py`: removes them by patch-based inpainting (about 9 minutes), writing `clean_full.png`.
4. `python finish_bg.py`: smooths the filled areas and writes `public/art/title/bg.webp`.
5. `python trace_logo.py && python gen_logo.py ../../src/title-logo.svg`: traces the 激流！/ナゾリバー letter
   shapes and rebuilds the logo SVG (3D extrusion, rims, gradient, animated waves, オンライン版 badge).
   Colours and stroke widths live in `gen_logo.py` (shapes) and `src/title.css` (strokes).

6. `python water_mask.py`: builds the water mask for the live water (R river, G foam boost near banks/boat,
   B waterfall). Save `water_mask.png` as lossless WebP to `public/art/title/water_mask.webp`.
   The water itself is drawn by the shader in `src/titleWater.ts`.

7. `python parrot_parts.py` (needs `parrot_lab.npy` from labelling the parrot by its outlines): cuts the
   parrot's wing / upper beak / lower jaw into `public/art/title/parrot_*.webp`, patches the background
   under them and rewrites `bg.webp`. Paste the printed positions into `src/titleParrot.ts`.

Note: `make_art.py` picks logo parts by connected-component ids (10/11 = ナゾリバー, 1 = 激流！, 2 = pill),
which were read off the current art. If the source art changes, re-check them.
