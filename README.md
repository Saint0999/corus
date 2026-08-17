# Corus

Marketing site for a custom mechanical keyboard company.
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · React Three Fiber + drei.

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # all four routes prerender as static HTML
npm run lint
```

## File structure

```
public/
  models/
    gaming-room-diorama.glb   3D hero asset (2.9 MB, self-lit)

src/
  app/
    layout.tsx                Root layout: fonts, metadata, Header + Footer shell
    globals.css               Tailwind v4 @theme — all design tokens live here
    page.tsx                  / — hero (copy + 3D canvas) and supporting strip
    customise/page.tsx        /customise — wraps the <Configurator> island
    about/page.tsx            /about
    features/page.tsx         /features

  components/
    layout/
      Header.tsx              Fixed nav, active-route highlight, mobile menu
      Footer.tsx
      Logo.tsx                Keycap wordmark (inline SVG)
    three/
      HeroCanvas.tsx          Client boundary: dynamic import with ssr: false
      Scene.tsx               <Canvas>, lights, <Bounds>, OrbitControls
      DioramaModel.tsx        useGLTF loader + graph clean-up
      IdleSway.tsx            useFrame animation (bounded turntable)
      CanvasLoader.tsx        In-canvas Suspense fallback with real progress
    customise/
      Configurator.tsx        Client island: option state + derived price
    ui/
      Container.tsx           The single page-gutter definition

  lib/
    navigation.ts             Nav links (shared by Header and Footer)
    styles.ts                 Shared class recipes (buttons, panels, eyebrow)
    scene-config.ts           Every tunable 3D number, measured from the GLB
    configurator-options.ts   Product option data + pricing
    use-prefers-reduced-motion.ts
```

## Design system

Defined once in `src/app/globals.css` under Tailwind v4's `@theme`, which turns
each token into utilities (`--color-accent` → `bg-accent`, `text-accent`, …).

| Token             | Value     | Use                         |
| ----------------- | --------- | --------------------------- |
| `surface`         | `#1a1a1a` | Page background — always solid, never a gradient |
| `surface-raised`  | `#212121` | Cards, panels               |
| `surface-sunken`  | `#141414` | Footer                      |
| `line`            | `#2e2e2e` | Hairline borders            |
| `ink`             | `#f5f5f4` | Headings and high-contrast text |
| `ink-muted`       | `#a1a1aa` | Body copy                   |
| `accent`          | `#f59e0b` | Amber CTA / hover / active state |
| `accent-strong`   | `#d97706` | Hover and pressed states    |

## Notes on the 3D hero

- **`.glb`, not `.obj`.** The supplied `.obj` is 10 MB and carries no materials
  or lighting; the `.glb` is 2.9 MB with materials, textures and lights in one
  file, and `useGLTF` reads it directly.
- **The model lights itself.** It ships 14 warm `KHR_lights_punctual` point
  lights plus emissive LED strips, which is where the golden-hour look comes
  from. The lights added in `Scene.tsx` are deliberately dim — they only stop
  the *outside* of the diorama going black. Turn them up and the interior blows
  out.
- **`<Bounds fit clip observe>`** frames the model instead of a hand-tuned
  camera distance, so one config works for a tall mobile strip and a wide
  desktop column alike.
- **The room has only two walls.** `CONTROLS.minAzimuthAngle` /
  `maxAzimuthAngle` fence the camera into the arc where the room is open, and
  `IdleSway` sweeps inside that arc rather than doing a full 360° turntable.
- **The 9 × 9 `backdrop_floor` plane is removed** (`DIORAMA.hiddenNodes`) so the
  diorama floats on the charcoal page over drei's `<ContactShadows>`. Empty that
  array to get the artist's original staging back.
- Everything tunable is in `src/lib/scene-config.ts`.
