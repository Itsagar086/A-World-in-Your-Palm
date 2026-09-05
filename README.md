# A World in Your Palm

A small explorer, eight living regions, and one planet you can walk all the way
around. Every model, texture, sound and animation in it is generated in code at
load time: there are no meshes, no image files, no audio files. The whole game
is about 7,300 lines of JavaScript on top of Three.js.

Open **`index.html`** to play, or **`dist/tiny-world.html`** for a single
self-contained file (Three.js inlined) that works offline from a USB stick.

---

## What's in it

**Eight regions**, each with its own terrain shape, palette, wildlife and one
"small wonder" to wake up:

| # | Region | Wonder | What happens |
|---|--------|--------|--------------|
| 01 | **Cubbon Woods** — forest | Light the camp | Lanterns, campfire and fireflies come on across the whole clearing |
| 02 | **Hesaraghatta Fields** — meadow | Start the windmill | The sails turn, the bees come out, the flowerbeds open |
| 03 | **Ramanagara Dunes** — desert | Turn the dial | A hidden spring wells up and an oasis grows out of the sand |
| 04 | **Ulsoor Bay** — coast | Ring the bell | The little sailboat casts off and sails a circuit of the cove |
| 05 | **Sankey Deep** — reef | Wake the reef | Every coral in the region lights up and the fish come to look |
| 06 | **Savandurga Peak** — volcano | Read the instruments | The mountain answers: the lava brightens and the crater stirs |
| 07 | **Nandi Frost** — tundra | Ring the chime | An aurora unrolls across the polar sky |
| 08 | **Lalbagh Hollow** — hollow | Open the jars | Giant fungus and crystal light the bowl in slow green |

Plus **sixteen wisps** scattered across the planet to find, a companion creature
that follows you around, and a field journal that remembers everything.

**A real day and night.** The sun is a directional light on a tilted orbit, so
half the globe is genuinely dark at any moment and you can walk across the
terminator. The explorer's lantern lights itself at dusk and casts a real pool
of light. Press **N** to hold the sky at day, dusk or night — that solves for
the sun position that gives you that sky *where you are standing*, so "night"
means night here, not night somewhere else.

**Photo mode** (**P**) hides the interface and frames the shot; **C** saves a PNG.

---

## Controls

| | |
|---|---|
| Walk | `W A S D` or arrow keys |
| Run / hop | `shift` / `space` |
| Interact | `E` near a golden marker |
| Look around | drag · scroll to zoom |
| Auto-walk | click or tap the ground |
| Globe / follow view | `M` |
| Time of day | `N` |
| Photo mode | `P`, then `C` to save |
| Field journal | `J` |
| Return home | `home` |
| Cancel a route | `esc` |

On a touch screen you get a joystick and a jump button instead.

---

## How it is built

```
index.html          the page, the interface, and all the CSS
REPORT.md           full project report
docs/               the report, typeset as a PDF, + make-pdf.mjs
tools/              headless verification harness
vendor/             three.min.js (r160, UMD build)
src/
  00-core.js        the primitive kit and the geometry baker
  10-nature.js      trees, plants, rocks, water, fire, animals
  20-props.js       shelters, fences, lanterns, boats, bridges, machinery
  30-planet.js      terrain generation, regions, placement, sky
  40-biomes-a.js    Cubbon Woods, Hesaraghatta Fields, Ramanagara Dunes, Ulsoor Bay
  41-biomes-b.js    Sankey Deep, Savandurga Peak, Nandi Frost, Lalbagh Hollow
  50-walker.js      walking on a sphere, collision, A* navigation
  60-explorer.js    the character rig, the companion, the waypoint marker
  70-audio.js       the synthesiser
  80-render.js      lighting, day/night, bloom and tone mapping
  90-app.js         input, cameras, HUD, persistence, the frame loop
build.mjs           inlines everything into dist/tiny-world.html
```

`node build.mjs` regenerates the single-file build. The source files are plain
scripts the browser loads directly, so you can edit one and hit reload.

**Further reading.** [`REPORT.md`](REPORT.md) is the full project report —
planning, architecture, call graphs, every command, testing, performance and a
study guide. The same document is typeset as
[`docs/A-World-in-Your-Palm-Report.pdf`](docs/A-World-in-Your-Palm-Report.pdf).

**Verification.** `tools/` holds a headless test harness:

```
cd tools && npm install && cd ..
node tools/smoke.mjs          # loads and renders?
node tools/metrics.mjs        # measure the world
node tools/playthrough.mjs    # full acceptance run
```

### The four ideas the whole thing rests on

**1. Everything is built from six primitives.** `box`, `rock`, `cone`, `tube`,
`link` (a cylinder between two points) and `poly` (raw triangles). A treehouse,
a windmill and a coral are all compositions of those. There is no art pipeline
because there is no art — a prop is a function.

**2. Props are authored deep and then flattened.** A campsite is a tree of two
hundred little meshes while you are writing it, which is the only sane way to
author. Before it reaches the renderer, `bake()` folds each mesh's transform
into its vertices, folds its flat material colour into a vertex-colour
attribute — so meshes of *different* colours can still merge — and concatenates
everything into one geometry per material. Measured on the current world:
**6,348 authored meshes collapse into 213 merged batches**, another 2,217 empty
placement groups are pruned, and what actually reaches the GPU is 437 meshes and
258,000 triangles — a few hundred draw calls including the shadow pass.

**3. The explorer has no position.** It has a unit normal — the direction from
the planet's centre to its feet — and a forward tangent. Walking is rotating
the normal along a great circle; height comes from the terrain function, so the
character is glued to the ground for free and there is no "fell through the
world" bug to chase. Obstacles are spherical caps, so blocking is a dot product
and sliding is a projection.

**4. Navigation is closed-form.** "Is the straight line between these two points
clear?" reduces to a single `atan2` per obstacle, because along a great circle
the dot product with a cap centre is `R·cos(t − φ)`. That makes A* over a
geodesic graph of the whole planet cheap enough to run inside a click handler,
and a string-pulling pass turns the staircase of graph hops into a few long,
natural-looking legs.

### Rendering

Scene → HDR half-float target → bright pass → four separable blur passes →
one composite doing bloom, Khronos PBR Neutral tone mapping, a night grade,
vignette and sRGB. No Three.js addons are used; the whole chain is about a
hundred lines. It degrades on its own: below 40 fps the renderer drops its pixel
ratio, and below that again it drops bloom and soft shadows.

Props that get between the camera and the explorer dither out of the way using a
fixed 4×4 Bayer pattern — fixed rather than noise, so it never sparkles when you
are standing still.

### Audio

Every sound is synthesised. Footsteps are a band-limited noise burst plus a low
sine "thud", with per-region filter, duration and pitch — sand is long and
bright, volcanic rock is short and hard. Wind is one looping brown-noise source
whose low-pass corner follows the region. Discoveries are pentatonic, so nothing
can ever sound wrong. Sound is off until you press the speaker (browsers require
a gesture) and pauses itself when the tab is hidden.

---

## Notes

- Three.js r160's UMD build prints a deprecation notice to the console on load.
  It is harmless; the file is vendored unmodified rather than edited to silence
  it.
- Progress is saved in `localStorage` under `tiny-world-save-v1`. Append `?qa`
  to the URL for a throwaway save slot.
