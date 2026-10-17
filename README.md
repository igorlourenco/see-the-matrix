# See the Matrix

What does `A @ x` actually *do*? Build vectors and a 2×2 matrix visually, and watch the picture, the math and the NumPy code update together.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # linear algebra + parser unit tests
npm run build    # static site in dist/, deploy anywhere
```

## How it fits together

```
src/
  lib/                 pure TypeScript, no React: start reading here
    linalg.ts          Vec2, Mat2 (stored as columns!), apply, det, inverse, eigen, classify
    codegen.ts         state → NumPy source
    parser.ts          NumPy source → state (tiny tokenizer + recursive-descent evaluator)
    python.ts          Pyodide loader for the Run button (lazy, ~10 MB on first run)
    tex.ts             KaTeX string helpers
    presets.ts         rotation, shear, projection, ...
  state/
    store.ts           THE single source of truth (zustand): A, vectors, t, toggles
    useAnimation.ts    drives t: 0 → 1; the canvas draws lerp(I, A, t)
  components/
    Canvas.tsx         SVG plane: warped grid, arrows, det area, eigen lines, drag handles
    Sidebar.tsx        column-vector inputs
    MathPanel.tsx      live KaTeX derivations
    CodePanel.tsx      CodeMirror + live parse + Run
```

**Three-way sync.** No view talks to another. Each view reads the store and writes through store actions. The only loop risk is the code panel: your edit updates the store, which would regenerate the code and overwrite your typing. The store records `lastSource`, and the code panel skips regeneration when the change came from code.

**Two code paths, on purpose.** Live sync uses the small parser (instant, on every keystroke, with line-numbered errors). Run uses real NumPy in Pyodide, which serves as a check that the JS math matches NumPy.

The parser understands `np.array`, `np.column_stack`, scalar arithmetic, `np.pi`, `np.sqrt/sin/cos/tan/radians` and scalar variables (`theta = np.pi / 6`). It skips other lines (`print`, `A @ v`, ...).

## Known v1 limits

- An edit from the inputs, canvas or a preset regenerates the code, so hand-written extras in the code panel (like a `theta` variable) are replaced.
- Vector names come from code or are auto-assigned (`v1`, `v2`, ...). The sidebar can't rename yet.
- Pyodide runs on the main thread. An infinite loop in the code panel freezes the tab.
