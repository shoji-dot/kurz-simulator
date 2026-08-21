# M-2 Mobile-First UX Implementation v1.0

**Status:** CLOSED — see §27 for the Closure record and Final Validation results. Four implementation passes preceded closure: Part 1 (§1–§9) initial implementation, Part 2 (§11–§16) first real-device-validation follow-up, Part 3 (§17 onward) second screenshot-driven follow-up, Part 4 (§22–§26) third screenshot-driven follow-up plus four addenda. Each part superseded specifics from the one before it (toolbar location, `ControlPad` internal layout, step-progress tokens) — §27's Final Validation table reflects the final, as-closed state; read it alongside §22 onward for the "why", not §1–§21 in isolation.
**Baseline:** D-4 / R4 Geometry Migration CLOSED (commit `39d88e6`). Not reopened; not modified in any pass (confirmed again at closure, §27.3).
**Investigation basis:** [M1_Mobile_First_UX_Investigation_v1.0.md](M1_Mobile_First_UX_Investigation_v1.0.md) — not rewritten, referenced only.
**Git:** Implementation commit `088dd9b0133b92b2f6a81044ae9fc63c5fd5b054`, pushed to `origin/main` — this is the M-2 Implementation Baseline (§27). This §27 Closure section is recorded in a separate, documentation-only commit on top of that baseline. Only the twelve files listed in the commit's diff were touched; no untracked pre-existing files were modified or staged at any point across the whole M-2 effort.

---

## 1. Summary

All five issues investigated in M-1 were implemented as the smallest coherent change on top of the accordion/collapse patterns already present in the codebase (`ControlPad`'s expand chip, 詳細調整, 3D表示切替, `ViewPresetPanel`'s unused `collapsible` prop). No new interaction paradigm was introduced. `resolveCanonicalPose()`, `evaluateDragCandidate()`/`evaluateRotationCandidate()`, the MeshBVH collision path, and `camera.getWorldDirection()` are byte-for-byte unchanged in their mathematical/collision semantics — the Depth logic was relocated into a named callback, not rewritten (see §5 diff excerpt).

| Issue | Change | Scope |
|---|---|---|
| ① Mobile UI occupation | `.layout-split` mobile rule switched from two independent fixed `dvh` rows to a content-aware flex column | `index.css` |
| ② Control Panel can't close | `ControlPad`'s expanded panel now caps its own height and scrolls internally, with the close button pinned above the scroll area; host wrapper now gives it a definite height to cap against | `ControlPad.tsx`, `SimulationMode.tsx`, `StepFlowMode.tsx` |
| ③ No touch Depth | `PlacementControls` gained `depthStep`/`endDepth`; `SimScene.tsx`'s inline Depth logic extracted into `performDepthStep()`, called identically by keyboard and touch; new Depth section in `ControlPad` | `canonicalPose.ts`, `SimScene.tsx`, `ControlPad.tsx` |
| ④ Long-press text selection | `-webkit-touch-callout: none` + `-webkit-user-select: none` added to `HoldButton` only | `HoldButton.tsx` |
| ⑤ Lower info panel too tall | `PlacementFeedback` detail rows now collapse behind its status badge; `ViewPresetPanel`'s existing `collapsible`/`defaultOpen` props wired up | `SimulationMode.tsx` |
| §9 Top toolbar compactness | New `--toolbar-*` CSS custom properties, redefined smaller under the mobile media query, consumed by `PillToggleGroup`/`IconButton`/`ToolbarContainer` | `index.css`, `PillToggleGroup.tsx`, `IconButton.tsx`, `ToolbarContainer.tsx`, `SimulationMode.tsx` |

---

## 2. Files Changed

```
src/components/SimulationMode.tsx      55 changed
src/components/StepFlowMode.tsx        10 changed
src/components/ui/ControlPad.tsx       63 changed
src/components/ui/HoldButton.tsx       32 changed
src/components/ui/IconButton.tsx        4 changed
src/components/ui/PillToggleGroup.tsx   8 changed
src/components/ui/ToolbarContainer.tsx  4 changed
src/index.css                          74 changed
src/scenes/SimScene.tsx               152 changed (net: extraction, not new logic)
src/scenes/canonicalPose.ts            13 changed (interface addition only)
```

`StepFlowMode.tsx` was touched for one reason only: it shares `ControlPad` with `SimulationMode.tsx` and would otherwise inherit the same overflow-clipping bug (issue ②) the moment its own `ControlPad` panel is expanded on a narrow mobile viewport. The same two-line host-wrapper fix (top+bottom instead of bottom-only) was applied there; nothing else in `StepFlowMode.tsx` was touched, and its `ControlPad` usage still passes no `placementControls`, so the new Depth section stays hidden there by design (§4).

---

## 3. Issue ① — Mobile Portrait UI Occupation

**Root cause (from M-1):** `.layout-split`'s mobile media query hard-coded `grid-template-rows: 48dvh 1fr` — the Canvas got a fixed 48dvh regardless of how much the sidebar actually needed, and the sidebar was independently capped at 42dvh.

**Change (`src/index.css`):** the mobile rule (`@media (max-width: 768px)`) now uses `display: flex; flex-direction: column` instead of CSS Grid. `.canvas-wrapper` is `flex: 1 1 auto; min-height: 320px` (grows to fill whatever the sidebar doesn't use); `.sidebar` is `flex: 0 0 auto; max-height: 32dvh; overflow-y: auto` (sized to its own content, capped, scrollable). `.layout-split`'s own `height`/`min-height` CSS declarations were removed because they were already dead code — `SimulationMode.tsx`'s `<div className="layout-split" style={{ height: '100%' }}>` inline style always won over them; the actual bounding height comes from the parent `flex:1; minHeight:0` step-content wrapper (`SimulationMode.tsx`'s outer `calc(100dvh - 56px)` container), which was not touched.

**Verified (DOM measurement, 375×812 simulated viewport, real dev server):**
- Before this change (measured against the *old* fixed values, for comparison): Canvas fixed at 48dvh ≈ 390px in every state.
- After, in the heaviest sidebar-content state (Transport-stage instruction card visible, before the user commits placement): Canvas = 436px, sidebar = 260px (at its 32dvh cap, scrollable) — **canvas gained ~46px (+12%) even in the worst case**, because the sidebar cap (32dvh) is tighter than the old fixed leftover in that state.
- After committing placement (Transport card disappears): sidebar's own `scrollHeight` drops from 703px to 587px; canvas stays at 436px (the cap was already binding, so no further change was visible in this pass, but the mechanism is confirmed content-aware — see §3⑤ for a case where it does grow further).

**Regression found and fixed during verification (mobile landscape):** the initial `min-height: 320px` on `.canvas-wrapper` was tuned for portrait phones and, on short-height landscape phones (e.g. 667×375), forced the Canvas taller than the entire available `.layout-split` budget, overflowing the container (which is `overflow: hidden` for the placement step). Added a second, narrower media query, `@media (max-width: 768px) and (max-height: 500px)`, that lowers `.canvas-wrapper`'s floor to 80px and `.sidebar`'s cap to 16dvh **only** in that short-height case. Re-verified at 667×375 and 568×320 (iPhone SE-class landscape): `layout-split.scrollHeight === layout-split.offsetHeight` (no overflow) at both. Portrait phones (max-height query doesn't match) and desktop/iPad (width query doesn't match) are unaffected — reconfirmed with a follow-up measurement after the fix.

---

## 4. Issue ② — Control Panel Cannot Close

**Root cause (from M-1):** `ControlPad`'s expanded panel is `position: absolute; bottom: 16; left: 12` inside `.canvas-wrapper` (`overflow: hidden`). Its content height (~320–340px) can exceed the mobile `.canvas-wrapper`'s height, and because the panel grows *upward* from a bottom anchor, its top edge — where the close button lives — is what gets clipped first. This was a toggle-state-adjacent sizing/overflow bug, not a broken `useState`.

**Change, in two parts:**

1. **`ControlPad.tsx`** — the expanded panel is now `display: flex; flex-direction: column; maxHeight: '100%'`. The close button is the panel's first child, outside a new inner scroll wrapper (`overflowY: 'auto'; minHeight: 0`) that holds all the 位置/回転/シャフト回転/Depth sections. If the content is taller than the available space, it scrolls *inside* the panel; the close button, being outside the scroll area, is never pushed out of view. `pointerEvents: 'auto'` was added explicitly to both the collapsed chip and the expanded panel root (see next point for why).

2. **`SimulationMode.tsx` / `StepFlowMode.tsx`** — the host `<div>` that positions `ControlPad` now sets **both** `top: 12` and `bottom: 16` (previously `bottom` only), which gives it a *definite* height inside the `position: relative` `.canvas-wrapper`. `ControlPad`'s `maxHeight: '100%'` resolves against that definite height, so the panel is guaranteed to fit within `.canvas-wrapper`'s bounds — mathematically, not by a guessed pixel constant. Because this host div now spans nearly the full canvas height, it is set to `pointerEvents: 'none'` (mirroring the existing `.canvas-overlay` pattern in `index.css`) so the empty space around the actual panel doesn't block Canvas drag/orbit interaction; `ControlPad`'s own rendered elements opt back in with `pointerEvents: 'auto'`.

**Verified (DOM measurement, real dev server, multiple viewport heights):**
| Viewport | canvas-wrapper height | Panel height | Close button within bounds? | Internal scroll engaged? |
|---|---|---|---|---|
| 375×812 (portrait) | 436px | 406px | Yes | No (content fit) |
| 375×667 (small portrait) | 338px | 308px | Yes | **Yes** (`scrollHeight` 370 vs `clientHeight` 269) |

The small-viewport case is the direct reproduction of the original bug: content genuinely doesn't fit, and the fix's scroll mechanism visibly engages while the close button stays reachable at a fixed position. `getBoundingClientRect()` on the close button confirmed `rect.top >= canvasWrapperRect.top && rect.bottom <= canvasWrapperRect.bottom` (`true`) in both cases — it is never clipped.

**Toggle state itself:** unchanged — `useState(false)` / `setExpanded` — confirming the M-1 root-cause finding that the toggle logic was never the problem.

---

## 5. Issue ③ — Smartphone Depth Control

**Root cause (from M-1):** the PageUp/PageDown handler's entire body (camera-relative direction → `evaluateDragCandidate()` → Depth Session bookkeeping) lived inline inside `SimScene.tsx`'s `onKeyDown` closure, and `PlacementControls` (the interface `ControlPad` already uses for Translate/Rotate/Shaft Roll) had no Depth field.

**Change:**
1. **`canonicalPose.ts`** — `PlacementControls` gained two methods: `depthStep(sign: 1 | -1, fine: boolean)` and `endDepth()`.
2. **`SimScene.tsx`** — the exact body of the `PageUp`/`PageDown` branch was moved, unmodified line-for-line (see the diff excerpt below), into a new `useCallback` named `performDepthStep(sign, fine)`, placed next to `evaluateDragCandidate`/`placementTranslate`/etc. The `onKeyDown` handler's `PageUp`/`PageDown` branch now reads:
   ```ts
   if (e.key === 'PageUp' || e.key === 'PageDown') {
     e.preventDefault();
     const sign = e.key === 'PageDown' ? 1 : -1;
     performDepthStep(sign, e.ctrlKey);
     return;
   }
   ```
   `endDepth()` is a one-line wrapper around the existing `endDepthSession(true)` (same call the `keyup` handler already made). Both are added to the `controls` object built in the existing `onPlacementControlsReady` effect, alongside `translate`/`rotate`/`rotateShaftRoll`.
3. **`ControlPad.tsx`** — a new "Depth（視点方向）" section with two `HoldButton`s (手前 / 奥), rendered **only** when `manipulationCommitted && placementControls` are both true (i.e., only in the D-4-wired Placement stage of `SimulationMode`, and only once `SimScene` has actually handed the controls up — never as dead, non-functional buttons). Depth has no Transport-stage equivalent — the pre-existing keyboard Depth feature never had one either (`DraggableProsthesis`, and the keydown listener inside it, only mounts once `manipulation.committed === true`) — so, unlike translate/rotate/rotateShaftRoll, there is deliberately no legacy `useSimStore.getState()` fallback branch for Depth; when `placementControls` is unavailable the buttons simply aren't shown, and if they were tapped before the wiring completes they no-op rather than write anything.
4. **`HoldButton.tsx`** — gained an optional `onRelease?: () => void` prop, called from `stop()` (pointerup/leave/cancel) but not from the internal `clearTimer()` used at the start of every press. This lets the Depth buttons call `placementControls.endDepth()` on release, mirroring the keyboard path's `keyup → endDepthSession(true)`. Existing callers (translate/rotate/rotateShaftRoll) don't pass `onRelease` and are unaffected.

**Diff excerpt confirming the math is untouched** (full diff reviewed in-session):
```diff
-        const camDir = new THREE.Vector3();
-        camera.getWorldDirection(camDir);
-        const parentInverseRotation = new THREE.Matrix3().setFromMatrix4(
-          new THREE.Matrix4().copy(group.parent.matrixWorld).invert(),
-        );
-        const localDir = camDir.clone().applyMatrix3(parentInverseRotation).normalize();
-        const depthStep = e.ctrlKey ? KEYBOARD_STEP_CTRL_MM : KEYBOARD_STEP_MM;
-        const sign = e.key === 'PageDown' ? 1 : -1;
-        const depthDelta = localDir.multiplyScalar(sign * depthStep);
-        if (!COLLISION_CONSTRAINT_ENABLED || evaluateDragCandidate(depthDelta)) {
+        const sign = e.key === 'PageDown' ? 1 : -1;
+        performDepthStep(sign, e.ctrlKey);
```
(the right-hand side of `performDepthStep`'s own body is the identical code, just living in a named function now — see `canonicalPose.ts`/`SimScene.tsx` diff for the full move.)

**Confirmed:** the touch Depth control reuses `camera.getWorldDirection()` → `evaluateDragCandidate()` → the same Collision Candidate gate → the same Depth Session snapshot/interpolation bookkeeping. No second Depth implementation and no bypass of Collision Candidate evaluation were introduced. `resolveCanonicalPose()` was not touched.

**Verification status — see §9.** The gating logic (`manipulationCommitted && placementControls`) was confirmed correctly implemented and, in this sandbox, correctly kept the Depth buttons hidden until `placementControls` was actually populated (rather than showing dead buttons). Full end-to-end confirmation that tapping 手前/奥 moves the prosthesis through the collision gate could **not** be completed in this sandbox — see §9 for why, and what was verified instead (code-level review + the fact that the wiring is structurally identical to the already-shipped, D-4-verified `translate`/`rotate`/`rotateShaftRoll` path).

---

## 6. Issue ④ — Long-Press Text Selection

**Root cause (from M-1):** `HoldButton` already set `user-select: none` and `touch-action: none`, but never `-webkit-touch-callout: none` — the property that actually suppresses iOS Safari's long-press magnifier/selection callout. Neither `index.css` nor any other file set it globally.

**Change (`HoldButton.tsx` only — narrowest applicable scope, per Task Order §7):**
```ts
userSelect: 'none',
WebkitUserSelect: 'none',
WebkitTouchCallout: 'none',
touchAction: 'none',
```
No global `user-select`/`-webkit-touch-callout` rule was added anywhere; the fix is scoped to the one component that implements long-press continuous operation, as instructed.

**Verification status — see §9.** `-webkit-touch-callout` is a Safari/WebKit-exclusive property that Chrome/Blink has never implemented (confirmed directly in this sandbox: `getPropertyValue('-webkit-touch-callout')` returns an empty string even on a bare test element, while `-webkit-user-select` is correctly recognized as an alias of the standard `user-select`). This sandbox's Browser pane runs Chrome (`Chrome/148 ... Mobile Safari/537.36` — a Chrome-on-Android UA, not real Safari), so this specific fix's runtime effect cannot be observed here even though its markup is confirmed correctly authored. `userSelect`/`WebkitUserSelect` were confirmed present in the rendered element's computed style and `touchAction: none` was confirmed present as well.

---

## 7. Issue ⑤ — Lower Information Panel

**Root cause (from M-1):** `PlacementFeedback` ("配置状況") and `ViewPresetPanel` ("視点プリセット") were both always fully rendered in `SimulationMode.tsx`'s Placement-step sidebar. `ViewPresetPanel` already had a working `collapsible`/`defaultOpen` prop pair that was simply never passed at this call site.

**Change:**
1. **`ViewPresetPanel` usage (`SimulationMode.tsx`)** — now called with `collapsible defaultOpen={false}`, matching the existing collapsed-by-default convention already used for 詳細調整/3D表示切替. The redundant `<div className="section-title">視点プリセット</div>` label above it was removed since `ViewPresetPanel`'s own collapsed-header button already renders that same text.
2. **`PlacementFeedback` (`SimulationMode.tsx`)** — restructured so the header row (総合ステータスバッジ: 配置良好/要調整/要修正) is **always visible** and now doubles as a `role="button"` toggle (`detailOpen`, default `false`) for the three detail rows (シャフト長/設置位置/設置角度), which were previously always rendered. This follows the Task Order's explicit "always-visible essentials + collapsed secondary information" principle rather than hiding the whole card.

**Verified (DOM text dump, real dev server):** after navigating to the Placement step, the rendered sidebar text showed `配置状況 ▾ 配置良好` (badge visible, detail rows collapsed) and `視点プリセット ▸ 開く` (collapsed, matching `ViewPresetPanel`'s own collapsed-state label) — both confirmed live and matching the intended default-collapsed state without any information being removed (both remain one tap away, per instruction "do not remove information").

---

## 8. §9 (Task Order) — Top Toolbar Compactness

**Change:** rather than hard-coding smaller mobile paddings/font-sizes into `PillToggleGroup`/`IconButton`/`ToolbarContainer` (which would also affect desktop, since these are shared components used elsewhere — e.g. the difficulty filter on the case-select screen), seven new CSS custom properties were introduced in `index.css`'s `:root` (`--toolbar-container-gap`, `--toolbar-container-padding`, `--toolbar-pill-gap`, `--toolbar-pill-py`, `--toolbar-pill-px`, `--toolbar-pill-fs`, `--toolbar-icon-size`), defaulting to the existing desktop values, and redefined to smaller values **only** inside the existing `@media (max-width: 768px)` block. `PillToggleGroup.tsx`, `IconButton.tsx`, and `ToolbarContainer.tsx` now reference `var(--toolbar-pill-py, var(--space-1))` etc. instead of the raw `--space-*` tokens for the properties that control size.

This works because a CSS custom property's *value* is still resolved through the normal cascade (including media queries) even when it's referenced from an inline `style` attribute via `var()` — only the CSS *property itself* (e.g. `padding`) is locked by inline-style precedence, not the custom property it points to. Desktop is untouched because the media query condition doesn't match there; every other consumer of `PillToggleGroup`/`IconButton` (e.g. the case-select difficulty filter) gets the same compacting on mobile as a side effect, which was judged to be a coherent, low-risk improvement rather than scope creep, since it uses the same tokens/values, not a new mechanism.

`SimulationMode.tsx`'s five inline `IconButton` call sites (理想位置/軟骨/顕微鏡モード toggles), which each hard-coded `padding: 'var(--space-1) var(--space-3)'` / `fontSize: 11` directly rather than relying on `IconButton`'s own (also-overridden) defaults, were updated to the same `var(--toolbar-pill-*, ...)` tokens so the compacting actually reaches them (the very first attempt — changing only `IconButton`'s own default styles — was verified to have no effect, since every call site already overrides those properties; this is documented here so a future change to `IconButton`'s defaults doesn't get silently ignored again).

**Verified (DOM computed style, mobile viewport):** `getComputedStyle` on a `PillToggleGroup` button and an `IconButton` at 375px width returned the mobile token values (`padding: 3px 8px`, `font-size: 10px`); the same query at 1280px width returned the desktop values (`padding: var(--space-1) var(--space-3)` → 4px 12px, `font-size: 11px`), confirming the breakpoint-only scoping works as intended.

---

## 9. Real-Device / Browser Verification — What Was and Wasn't Possible

This session's Browser pane could not be visually displayed/composited (`computer{action:"screenshot"}` failed with *"the Browser pane is not displayed, so the page is not compositing frames"* on every attempt, before and after multiple resize/navigation attempts). This has two concrete, confirmed consequences documented honestly here rather than glossed over:

1. **The R3F `<canvas>` never received a real size or render loop.** Direct inspection (`canvas.width`/`canvas.height`) showed it stuck at Three.js's un-sized default of `300×150` throughout the session, regardless of its CSS container's actual measured size (which *did* resize correctly, per all the `.canvas-wrapper`/`.sidebar` measurements in §3/§4 — those are plain DOM/CSS and unaffected). Because R3F's reconciler and `requestAnimationFrame` loop are tied to the canvas actually being composited, `DraggableProsthesis`'s own `onPlacementControlsReady` effect — and, before this task, the pre-existing `translate`/`rotate`/`rotateShaftRoll` wiring it already used — could not be observed firing in this sandbox. This was confirmed methodically: neither a pre-existing, unmodified `ControlPad` "up" button (via `placementControls.translate`) nor the pre-existing keyboard `PageDown` Depth shortcut moved the prosthesis in this sandbox, ruling out a regression specific to this task's changes (both old and new code paths are equally unobservable here, for the same environmental reason). Everything reachable *without* the 3D canvas rendering — layout sizing, the ControlPad overflow/scroll fix, the accordion/collapse states, the CSS token cascade — was fully verified with real, measured DOM values (§3–§7).
2. **`-webkit-touch-callout` cannot be exercised in this sandbox at all**, because its Browser pane runs Chrome, which has never implemented that property (confirmed directly, §6) — this is a Safari-only mechanism by definition, not a limitation of this particular session.

**What this means concretely:** the Depth control's end-to-end movement-through-collision-gate behavior (issue ③'s core acceptance criterion) and the iOS-Safari-specific callout suppression (issue ④'s core acceptance criterion) are verified at the **code level** (faithful, reviewed, line-for-line extraction for ③; correctly-authored, narrowly-scoped CSS property for ④) but **not** at the runtime/visual level in this session. Everything else in this document's tables was verified with live, measured values from a real running dev server. Per the Task Order's closing instruction, this is being reported as an explicit finding rather than resolved by further speculative changes — an actual phone or a properly-composited desktop browser is needed to close this last gap.

---

## 10. Known Limitations

- Mobile landscape's 16dvh/80px floor values (§3) are workable but tight by design (landscape phones are the lowest-priority target per the Task Order's `1. Smartphone (portrait) → 2. PC → 3. iPad` ordering); they were tuned against 667×375 and 568×320 only.
- The `≤768px`-width-only breakpoint (unchanged from before this task, not part of the five issues) still means a landscape phone wider than 768px (e.g. 812×375) receives the desktop 2-column grid rather than either mobile treatment — confirmed not to cause obvious clipping (verified: canvas 469×287, sidebar 280×287, both fully laid out with no overflow) but noted here as the same pre-existing asymmetry M-1 flagged, still out of this task's five-issue scope.
- §9's verification gap (3D interaction, `-webkit-touch-callout`) is the primary open item before this can be called fully done; see §9 for exactly what's outstanding and why.
- Real-device (physical phone) verification per Task Order §14 was not performed — no physical device was available in this environment; this document reports sandbox-level DOM/CSS verification plus code review in its place.

---

## 10. Final Report

```text
M-2 Mobile-first UX Implementation

Implementation:
COMPLETE

Mobile Portrait:
PASS (layout measured: canvas +12% even in worst-case content state; content-aware sizing confirmed; no overflow)

Control Panel open/close:
PASS (close button confirmed within canvas-wrapper bounds at multiple viewport heights; internal scroll engages correctly when content exceeds available space)

Mobile Depth:
PASS with a documented gap — code-level verification complete (faithful extraction, same collision gate, correct PlacementControls wiring, correct UI gating); end-to-end movement-through-collision-gate could not be exercised in this sandbox because the R3F canvas never composited/rendered (see §9). Not a regression: the pre-existing keyboard Depth path was equally unobservable here for the same reason.

Long-press:
PASS with a documented gap — fix correctly authored and scoped to HoldButton only; -webkit-touch-callout is a Safari-only property this sandbox's Chrome-based Browser pane cannot exercise (see §9).

Lower information panel:
PASS (both PlacementFeedback and ViewPresetPanel confirmed collapsed-by-default in rendered DOM text; no information removed)

Desktop regression:
PASS (1280px width confirmed unchanged: display:grid, 1fr 280px columns)

iPad regression:
PASS (820px portrait width confirmed on desktop grid layout, not forced into mobile treatment)

Mobile landscape:
PASS (regression found and fixed during verification: initial min-height caused overflow at 667x375 and 568x320; corrected with a dedicated max-height:500px media query; re-verified no overflow at both sizes)

TypeCheck:
PASS

Build:
PASS

Lint:
PASS (0 issues in any file this task touched; 161 pre-existing baseline issues remain in untouched files — RealAnatomyModels.tsx, TympanoCavityModel.tsx, ManipulationLayer.tsx, useSimStore.ts — confirmed by name-matching the lint output against this task's changed-file list)

D-4 safety boundary:
UNCHANGED (resolveCanonicalPose, evaluateDragCandidate, evaluateRotationCandidate, camera.getWorldDirection, and the MeshBVH collision path are untouched in substance; Depth logic was relocated via a reviewed, line-for-line diff, not rewritten)

Documentation:
docs/M2_Mobile_First_UX_Implementation_v1.0.md

Git:
NOT COMMITTED
NOT PUSHED
```

**Correction to the Part 1 Lint line above:** a rigorous `git stash` A/B comparison performed during Part 2 (§13) found that the "0 issues in any file this task touched" claim above was based on an incomplete grep against a truncated lint run. `SimulationMode.tsx` and `SimScene.tsx` do carry a handful of pre-existing lint findings (all at lines Part 1 never touched — a `ResultBadge` component defined inline in `JudgmentStep`, a `setState` call inside `ScoreStep`'s effect, and two `camera`/`gl` mutations inside effects elsewhere in `SimScene.tsx`). The stash comparison confirms these are 100% pre-existing in the D-4 baseline, not introduced by either M-2 pass — see §13 for the exact comparison.

---

# Part 2 — Post-Real-Device UX Corrections

**Trigger:** actual iPhone Safari validation of the Part 1 implementation above. Depth (③) and Long Press (④) came back **REAL DEVICE PASS** and were left untouched in this pass, per the task order. Control Panel sizing, the Lower Information Panel, the Toolbar, and mobile-portrait Canvas area came back **PARTIAL PASS / FAIL / UX FAIL** and are the entire scope of this section.

## 11. Real-Device Validation Results (as reported)

| Area | Result |
|---|---|
| ③ Touch Depth (forward/reverse tap, long-press, collision gating, camera-relative direction after rotation) | **REAL DEVICE PASS** — not touched this pass |
| ④ Long press (continuous operation, no text selection, no iOS callout) | **REAL DEVICE PASS** — not touched this pass |
| ② Control Panel open/close mechanism | **PASS** — the overflow-clipping fix holds; toggle opens/closes/reopens/recloses reliably |
| A. Control Panel mobile sizing | **PARTIAL PASS** — no longer clips, but "still too large... occupies too much of the portrait screen" when open |
| B. Lower Information Panel (PlacementFeedback/ViewPresetPanel collapse) | **FAIL** — "cannot be opened/closed as expected" |
| C. Top Toolbar | **UX FAIL** — "usable, but overlaps/competes with other panels and occupies too much vertical space" |
| D. Mobile Portrait Canvas | **UX FAIL** — "usable Canvas area is still too narrow... core remaining mobile UX issue" |

## 12. Investigation — Why B (Lower Information Panel) Actually Failed

Per the task order's explicit instruction ("do not assume `collapsible` prop wiring is sufficient — investigate the actual rendered mobile DOM"), the Part 1 fix (wiring `ViewPresetPanel`'s `collapsible` prop, adding a `detailOpen` toggle to `PlacementFeedback`) was re-examined against the real rendered mobile layout rather than assumed correct.

**Method:** with a real dev server and the Browser pane driven via `document.elementFromPoint()` at each toggle's actual on-screen coordinates (not `element.dispatchEvent()`, which bypasses real hit-testing and would have reported false positives — this is exactly the gap between Part 1's synthetic-event testing and real-device tapping).

**Finding 1 — the toggles themselves were never broken.** `elementFromPoint()` at each toggle's coordinates returned the toggle itself (`hitIsSelf: true`) once the toggle was actually scrolled into view, and clicking it correctly flipped `aria-expanded`/rendered the detail rows. Z-index, `pointer-events`, and stacking were all fine — ruling out four of the six hypotheses the task order asked to check (occlusion by another panel, z-index/pointer-events blocking, a parent wrapper forcing it open, incorrect stacking).

**Finding 2 — the real root cause was reachability.** `.sidebar`'s visible clipped box is only ~260px tall on a 375×812 viewport (per Part 1's own content-aware sizing — this is intentional and correct). Measuring `sidebar.children[0]`'s rendered height found **442.5px** — nearly 1.7× the entire visible sidebar — for a single card containing the product name, reconstruction route, the Transport-stage instruction text, and **two developer-only `[TEST-ONLY]` verification buttons** (`🧪 [TEST] 理想位置で配置を強制確定`, `🧪 [TEST] Collision境界直前へワープ`, both explicitly commented as Phase C-2 real-device verification aids, never intended for end-user Placement operation). `PlacementFeedback` and `ViewPresetPanel` were positioned *after* this card, requiring **~378–440px of scroll inside a 260px box** — over 1.5× the box's own height — before their (perfectly functional) toggles ever entered the viewport. A real user tapping near the top of a short, non-obviously-scrollable panel would reasonably conclude the feature "cannot be opened," exactly matching the reported failure.

**A related discovery while mapping the DOM:** what Part 1 had assumed were several separate `.sidebar > .card` siblings (product info, instructions, 詳細調整) turned out to mostly be **one single large enclosing `<div className="card">`** opened near the top of `PlacementStep`'s sidebar JSX and not closed until after the 詳細調整 accordion — `理想位置に配置`/`↺ すべてリセット` buttons and a second developer tool (`🧪 [TEST] Rotation Boundary Warp`, shown post-commit) were nested inside it too, all contributing to the same unreachable block.

## 13. Fixes Applied

### A. Control Panel (`ControlPad.tsx`) — 2-column reflow

The overflow/scroll fix from Part 1 (§4) is unchanged — the close button is still guaranteed to stay inside `.canvas-wrapper`'s bounds. What changed is the panel's own internal layout: the four sections (位置/回転/シャフト回転/Depth) were each wrapped in a small bordered `sectionBoxStyle` box, and the scroll-area container became a CSS Grid: `grid-template-columns: repeat(auto-fit, minmax(148px, 1fr))`. A new `--control-pad-width` custom property (168px default, unchanged on desktop/iPad) is redefined to `min(336px, calc(100vw - 40px))` only inside the existing mobile media query.

This is a pure CSS reflow technique, not a new layout engine or breakpoint system: at the desktop width (168px), only one 148px column fits, so nothing changes there (confirmed: panel width measured at exactly 168px on a 1280px-wide viewport, single-column, identical to Part 1). At the wider mobile width, two columns fit side by side automatically. Button sizes (44pt `HoldButton` minimums), the Depth section's gating (`manipulationCommitted && placementControls`), and all `onClick`/`onTick` logic are untouched — this is layout-only.

**Measured (375×812, real dev server):** panel width 335px, height dropped from an estimated ~380–420px (single column, four stacked sections including the Depth row Part 1 added) to **294.7px** — roughly 68% of the 436px-tall canvas when open, down from what would have been close to full coverage. `位置` and `回転` sections confirmed side-by-side at the same `top` (261px), different `left` (33px vs 196px) — the 2-column reflow is confirmed active, not just narrower text.

### B. Lower Information Panel — reachability fix (the actual root cause fix)

Two changes, both to `SimulationMode.tsx`'s `PlacementStep` sidebar JSX, no changes to `ViewPresetPanel.tsx` or `PlacementFeedback`'s own toggle logic (which were already correct per §12):

1. **Reordered the sidebar.** `<PlacementFeedback>` and `<ViewPresetPanel>` (plus the camera save/reset buttons, which belong with the preset panel) now render immediately after the product name/reconstruction-route info — before the large instruction card, developer tools, and 詳細調整 accordion, which all moved *after* them. Information was not removed, only reordered; this is the same "move it earlier in `.sidebar`'s DOM order" fix, applied because horizontal-scroll-avoidance (the only alternative that doesn't touch layout order) isn't available here — `.sidebar` scrolls vertically only, by design, and that design is correct.
2. **Collapsed the developer-only tooling.** The two `[TEST-ONLY]` buttons in the instruction card, and the `🧪 Rotation Boundary Warp` card that appears post-commit, are now both gated behind a single new `testToolsOpen` accordion (`useState(false)`, same pattern as every other accordion in this file) with a header ("🧪 開発者検証ツール") placed once, outside the `!manipulationCommitted` conditional, so it's reachable in both Transport and Placement stages. The buttons themselves, their `onClick` handlers, and the code comments marking them as Phase C-2/C-3 verification aids to be preserved (not deleted) are completely unchanged — only their default visibility changed.

**Measured (375×812, real dev server, before → after):**
| Metric | Before this fix | After |
|---|---|---|
| `sidebar.children[0]` height (the dominant card) | 442.5px | 72px (info-only; devtools+instructions moved later & collapsed) |
| Scroll needed to reach `ViewPresetPanel` toggle | 440px+ | **0px — reachable without scrolling** |
| Scroll needed to reach `PlacementFeedback` toggle | 440px+ | **0px — reachable without scrolling** |
| `elementFromPoint()` at toggle coordinates | returns the toggle (once scrolled into view) | returns the toggle **immediately, no scroll** |

Both toggles were also exercised end-to-end after the fix (`aria-expanded` flips `false→true`, detail content renders, e.g. `PlacementFeedback`'s three detail rows and `ViewPresetPanel`'s preset button grid both appeared correctly), and re-verified against a second case with more/longer tags to rule out a one-case fluke.

### C. Top Toolbar — overlap fix + touch-target correction

**Overlap root cause:** `ToolbarContainer anchor="top-right"`'s `maxWidth: 'calc(100% - 20px)'` was appropriate for desktop but, on a 359px-wide mobile canvas, let the toolbar's wrapped rows span up to 338px — a `document.elementFromPoint()`-based bounding-box check (not just a visual glance) confirmed this literally overlapped `.canvas-overlay.top-left` (the procedure/lesion tag chips), which independently caps at `max-width: 55%` (Part 1/pre-existing, unchanged). A new `--toolbar-container-maxwidth` token (`calc(100% - 20px)` default, unchanged desktop/iPad) was added and set to a mobile-only value tuned empirically against the actual rendered tag-bar width — **not** a guessed percentage. The tag bar's width turned out to be **constant at 196.9px regardless of tag count** (extra tags wrap to more *lines*, not more width, because of its own pre-existing `flexWrap`/`max-width:55%`), which was confirmed by testing two different cases (one with 4 tags, one with 6) and observing identical tag-bar width in both — this made the toolbar's cap robust rather than a fragile per-case guess. Final value: **36%**, verified to leave a small but real gap (`toolbar.left: 219px > tagBar.right: 213.56px`) in both tested cases, with `overlaps()` (a proper rectangle-intersection check, not just an eyeball) returning `false`.

**Touch-target regression caught and fixed within this same pass:** narrowing the toolbar to 36% width forced its pill/icon buttons to wrap into more rows, and the *first* attempt at fixing this used Part 1's already-compact `--toolbar-pill-py: 3px` / `--toolbar-pill-fs: 10px` tokens unchanged — measured button height came out to **19–20px**, well under any reasonable touch-target minimum and a direct violation of the task order's "preserve touch target usability" requirement. This was caught by measurement (not assumed), and `--toolbar-pill-py` was raised to 6px / `--toolbar-pill-fs` to 11px (both mobile-only; desktop keeps its original `--space-1`/`11px` values, confirmed unchanged via a 1280px-width check: `padding: 4px 12px`, `height: 22.67px`, matching Part 1 exactly). Final measured mobile button height: **27px** — a deliberate, documented compromise (below the ideal 44pt but roughly 40% taller than the broken 19px state) chosen because the toolbar's four content groups (drag-mode pills, view-mode pills, and two icon buttons) cannot structurally share rows within the width budget that avoids overlapping the tag bar (the narrowest pairing of any two groups needs ~200px+; the safe width budget here tops out around 130–165px) — see §14 for this as a known, investigated limitation rather than an oversight.

**Measured (375×812, final values, two different cases):** toolbar width 136px, height 168px (39% of the 436px-tall canvas, down from an unconstrained/overlapping 52% mid-pass and from the original overlapping 94.67px-tall-but-338px-wide state), zero overlap with the tag bar in both a 4-tag and a 6-tag case, button height 27px.

### D. Mobile Portrait Canvas — indirect, cumulative improvement

No new lever was added specifically for D — the task order's own framing ("investigate the actual computed layout... prefer content-aware sizing... avoid rigid `48dvh`/`42dvh`") describes exactly what Part 1's `§3` fix already put in place, and B+C above (freeing the sidebar from a 440px-deep dead scroll, and cutting the toolbar overlay from 52%→39% of canvas height when both panels are involved) are what actually make that existing headroom *usable* rather than technically-present-but-buried. Canvas's own box height is unchanged by this pass (still `flex: 1 1 auto; min-height: 320px` inside `.layout-split`, confirmed via the same 436px measurement as Part 1) — what changed is that the overlays sitting on top of it (ControlPad, Toolbar) now cover meaningfully less of it, and the sidebar underneath it no longer needs 440px of blind scrolling to reach basic controls. This is reported as the honest characterization: Canvas's *box* was already correctly sized in Part 1; what real-device testing exposed was that the *overlaid chrome* was still eating too much of the visual result, which is what B and C above address.

### E. Mobile Landscape — regression check

Re-run after all of the above, at two sizes matching Part 1's own regression tests (667×375, 568×320):
- `layout-split.scrollHeight === layout-split.offsetHeight` at both sizes — **no overflow reintroduced** (Part 1's `min-height: 320px` landscape bug, fixed via the `@media (max-width: 768px) and (max-height: 500px)` block, is untouched by this pass and still holds).
- Toolbar: **no overlap** with the tag bar at 667×375 either (`overlapping: false`).
- Toolbar height at 667×375 measured 168px against a 199px-tall canvas in that cramped mode — **84% of the (small) landscape canvas**. This is *not* a new overflow/clipping bug (nothing is cut off, everything renders and scrolls correctly) but is noted honestly as a real, unresolved proportion issue specific to landscape, where the canvas itself is short enough that even a reasonably-sized toolbar dominates it visually. Per the task order's explicit prioritization ("Portrait remains the primary priority... quick regression check"), this was not pursued further this pass — see §14.

## 14. Known Limitations (Part 2)

- **Toolbar touch targets are 27px, not the 44pt ideal.** This is a structural consequence of four independent control groups needing to coexist in a width budget constrained by not overlapping the tag bar (§13C). Reaching 44px targets would require either widening the toolbar (reintroducing overlap risk on tag-heavy cases) or restructuring/relabeling the controls themselves (out of this pass's scope, which was explicitly "do not introduce a new UI paradigm unless investigation proves the existing structure cannot satisfy the requirement" — the existing structure *can* satisfy no-overlap and *can* satisfy reasonable-if-imperfect touch targets, just not both at the Part-1-established 44px bar simultaneously).
- **Toolbar covers ~84% of the canvas height in mobile landscape**, specifically because landscape's own canvas is short (199px at 667×375). Not a regression (nothing overflows or clips) and not addressed this pass per the stated portrait-first priority.
- **`ControlPad`'s 2-column reflow (§13A) still leaves the panel at ~68% of canvas height when open.** This is a real reduction from Part 1's likely ~90%+ (four sections stacked, including the newly-added Depth row), not a full resolution — five real controls (position ×6 buttons, rotation ×4, shaft roll ×2, Depth ×2, all at the 44pt minimum Task Order §4 "preserve touch target usability" requires) genuinely need this much room at 44pt button sizes even in a 2-column layout. This is reported as a partial improvement, not a claim that the Control Panel is now small.
- Real physical iPhone verification of *this pass's* fixes was not performed in this environment — the same sandbox limitation documented in Part 1 §9 (Browser pane does not composite, R3F canvas never received a real render loop) applied here too. Every measurement in §12–§13 above is real DOM/CSS geometry from an actual running dev server (not fabricated), including real `document.elementFromPoint()` hit-testing rather than event-dispatch shortcuts — but it is still simulator-based geometry, not a physical-device tap. The user's own iPhone Safari re-test of this pass's specific fixes is the recommended next step before treating B/C as fully closed.

## 15. Documentation and Diff Scope (Part 2)

Same ten files as Part 1 (no additional files touched): `SimulationMode.tsx`, `StepFlowMode.tsx`, `ControlPad.tsx`, `HoldButton.tsx`, `IconButton.tsx`, `PillToggleGroup.tsx`, `ToolbarContainer.tsx`, `index.css`, `SimScene.tsx`, `canonicalPose.ts`. `SimScene.tsx`/`canonicalPose.ts` (the Depth-critical files) were **not modified in this pass** — confirmed via `git diff` line-count comparison against the state already reviewed and reported in Part 1, which the user's real-device test validated as `REAL DEVICE PASS`. All Part 2 changes are in `SimulationMode.tsx` (JSX reorder + devtools accordion + toolbar maxWidth token usage), `ControlPad.tsx` (2-column grid reflow), and `index.css` (new/adjusted custom properties: `--control-pad-width`, `--toolbar-container-maxwidth`, revised `--toolbar-pill-py`/`--toolbar-pill-fs`).

## 16. Final Report (Part 2)

```text
Mobile Depth:
REAL DEVICE PASS (not touched this pass)

Long Press:
REAL DEVICE PASS (not touched this pass)

Control Panel open/close:
REAL DEVICE PASS (mechanism untouched this pass; still works per user's own re-confirmation before filing this pass's remaining findings)

Control Panel mobile sizing:
PASS (2-column reflow: panel height reduced from an estimated ~380-420px single-column stack to 294.7px measured, ~68% of open canvas height, down from near-full coverage; touch targets and Depth gating unchanged; desktop/iPad confirmed unchanged at 168px single-column)

Lower Information Panel:
PASS (root cause was reachability, not the collapse logic itself — both toggles confirmed functional via elementFromPoint hit-testing both before, i.e. unreachable, and after, i.e. immediately reachable with 0px scroll; verified across two different cases)

Toolbar:
PASS (overlap with top-left tag bar eliminated — verified via rectangle-intersection check, not visual estimate — across two cases with different tag counts; touch-target regression caught mid-fix and corrected to 27px; height reduced to 39% of canvas, down from 52% mid-fix and from an overlapping 94.67px-tall/338px-wide state; known remaining limitation: 27px targets are below the 44pt ideal, documented in §14 as a structural width/no-overlap trade-off)

Mobile Portrait Canvas:
PASS (Canvas's own box was already correctly sized by Part 1 and is unchanged this pass; B+C above free up the overlay space actually visible around it — sidebar no longer requires 440px of blind scroll, toolbar overlay shrank from 52%→39% of canvas height — reported as the mechanism of improvement rather than a new Canvas-sizing change)

Mobile Landscape:
PASS (no overflow regression at 667x375 or 568x320, matching Part 1's fix; no toolbar/tag-bar overlap at 667x375 either; noted limitation: toolbar covers ~84% of the short landscape canvas height — not a clipping/overflow bug, not pursued further per stated portrait-first priority)

Desktop regression:
PASS (1280px width: grid layout unchanged, 952px+280px columns confirmed with this session's case; ControlPad confirmed 168px single-column; toolbar pill button padding confirmed 4px 12px / height 22.67px, matching Part 1 exactly)

iPad regression:
PASS (820px width confirmed on desktop grid layout: 492px+280px columns, not forced into mobile treatment)

TypeCheck:
PASS

Build:
PASS

Lint:
PASS (this pass's changes introduce zero new lint findings; a git-stash A/B comparison confirmed every lint finding touching SimulationMode.tsx/SimScene.tsx — the two files this session's changes and Part 1's changes both live in — is present identically in the pristine D-4 baseline, at code neither pass touched. This corrects Part 1's own less rigorous "0 issues" claim, which was based on a filename-only grep against a run that turned out to already contain these same pre-existing findings — see the correction note above §11.)

D-4 Safety Boundary:
UNCHANGED (SimScene.tsx and canonicalPose.ts were not touched in this pass at all; Depth mathematics, evaluateDragCandidate(), camera.getWorldDirection(), and the collision-gated path remain exactly as validated by the user's own REAL DEVICE PASS)

Documentation:
UPDATED (docs/M2_Mobile_First_UX_Implementation_v1.0.md — this Part 2 section; docs/M1_Mobile_First_UX_Investigation_v1.0.md NOT modified)

Commit:
NOT EXECUTED

Push:
NOT EXECUTED
```

---

# Part 3 — Screenshot-Driven Follow-Up

**Trigger:** the user tested Part 2's result on an actual iPhone Safari and supplied a real screenshot (Placement step, portrait, `TTP-VARIAC PORP` case). The screenshot showed four concrete, specific problems that Part 2's DOM measurements alone hadn't caught (Part 2 was correct on what it measured — no overlap, functioning toggles — but the screenshot revealed additional structural issues Part 2 hadn't addressed).

## 17. Issues From the Screenshot

1. **① Toolbar still multi-row.** The 移動/視点, 通常/内視鏡, 理想位置/軟骨, and 回転 controls rendered as roughly five stacked rows inside the glass panel, visibly covering close to half the Canvas height. User asked for all of them in **one row**, top-right.
2. **② Lower info panel still too tall.** The `TTP-VARIAC PORP` card + 配置状況 + 視点プリセット stack was clearly visible taking up a large fraction of the screen below the Canvas. User asked for roughly half the footprint, with the freed space going to the Canvas.
3. **③ Step-progress header clipped.** "製品選択," "サイズ," "配置調整," "評価" were cut off at the right edge of the screen, with only "症例選択"/"適応判断" (as checkmarks) fully visible. User suggested relocating the "判断クイズ: OFF（設定）" badge into the lower panel to free up room.
4. **④ Control Panel dominates the Canvas when open.** "操作パネルを開いたらほぼプロステーシスの操作画面が見えなくなりました" (opening the panel leaves almost no Canvas visible). User asked to shrink the panel's buttons.

## 18. Root Causes and Fixes

### ① Toolbar — genuinely merged into one row

**Root cause:** the toolbar's outer container used `flexWrap: 'wrap'` with several atomic groups (`PillToggleGroup` × 2, an icon-button pair, a conditional pan/rotate button) — Part 2's width-capping (§13C) reduced *overlap* but never addressed *row count*, since none of those atomic groups fit side-by-side within the overlap-safe width budget.

**Fix (`SimulationMode.tsx`):** the toolbar's five control groups were flattened into a single `display:flex; flexWrap:'nowrap'` row with `overflowX:'auto'` and `width:'100%'` — a horizontally-scrollable strip, the same well-understood mobile pattern as an iOS control-center row, rather than a wrapping stack. This required two follow-up fixes once measured, not assumed:

- **A stretch bug:** the first attempt produced a 71–73px-tall single row instead of the expected ~30–40px. Measuring each child individually found `PillToggleGroup`'s own root div being flex-shrunk by the new `nowrap` ancestor down to ~52px — narrower than its two pill buttons need — which activated *its own* `flexWrap: 'wrap'` internally, stacking "移動"/"視点" vertically; the default `align-items: stretch` on the row then stretched every sibling (icon buttons included) to match that inflated height. Fixed by adding `flexShrink: 0` to `PillToggleGroup.tsx`'s own root style (a safe default for a component meant to render as one visual unit) and `alignItems: 'center'` on the row.
- **Verified after the fix:** row height 42px (down from ~168–225px across Part 2's iterations, and from the ~5-row stack in the screenshot), all groups render at their natural unwrapped width (e.g. the "移動/視点" pill group measured 92×40px, not 52×71px), `scrollWidth` (434px) exceeds `clientWidth` (119px) confirming the scroll fallback is live, and scrolling the row to its end correctly revealed and hit-tested the 回転 button that starts out of view. No overlap with the top-left tag bar (Part 2's §13C fix, re-verified unchanged: `overlapsTagBar: false`).

### ② Lower info panel — padding, gaps, and cap reduced together

**Fix (`index.css`):** three independent reductions, chosen together rather than any single aggressive one, so no single lever had to do all the work: `.sidebar`'s mobile `max-height` cut from 32dvh to **22dvh**; `.sidebar`'s gap (previously inheriting the base 12px, never overridden for mobile) set to **6px**; `.card`'s mobile padding cut from 12px to **8px 10px**. Re-verified that Part 2's reachability fix (§13B — `PlacementFeedback`/`ViewPresetPanel` moved to the top of the sidebar) still holds at the smaller cap: both toggles remained reachable with zero scroll after the change.

**Measured (375×812, real dev server):** sidebar height dropped from 260px (Part 2's 32dvh) to **178.6px** (22dvh, exact match) — and because `.canvas-wrapper` is `flex: 1 1 auto` (Part 1 §3, unchanged), that freed height went straight to the Canvas: **436px → 517px, a +19% gain**, achieved together with ①'s toolbar-row-height reduction (which independently frees *visual* Canvas space even though it doesn't change `.canvas-wrapper`'s own box height).

### ③ Step-progress header — badge relocated, not just hidden

**Root cause:** the header row (`StepProgress` + the skip-quiz badge) used `justifyContent: 'space-between'` with no width constraint or scroll fallback; once the 6-step `StepProgress` content plus the ~140px badge exceeded the ~343px available, the row simply overflowed the viewport horizontally with no way to reach the hidden steps — confirmed by a direct real-device screenshot showing "サイズ" and everything after it cut off at the screen edge.

**Fix (`SimulationMode.tsx` + `index.css`):**
1. The badge was pulled out of the header's `justify-content` calculation entirely on mobile and duplicated as a compact ("クイズOFF") badge inside the sidebar's product-info card (next to the product name), using a `display:none`/`display:flex` CSS-class pair (`.step-quiz-badge-desktop` / `.step-quiz-badge-mobile`) toggled purely by the existing `@media (max-width: 768px)` breakpoint — not a JS viewport check, consistent with the codebase's CSS-only responsive convention. `PlacementStep` doesn't receive `skipQuiz` as a prop (only `CaseSelect` does), so the sidebar copy reads it via the same `loadSkipQuiz()` localStorage helper `SimulationMode`'s own `useState` already initializes from, rather than threading a new prop through.
2. The header row itself also gained `overflowX: 'auto'` as a safety net, in case a future longer step label set doesn't fit even without the badge.

**A real bug caught mid-fix:** the first attempt set `display: 'flex'` directly in the desktop badge's inline `style` prop *and* relied on `.step-quiz-badge-desktop { display: none }` in the mobile media query to hide it — but inline styles always beat external CSS rules for the same property, so the badge stayed visible on mobile regardless of the CSS. Caught by explicitly checking `getComputedStyle(...).display` at both viewport widths (not assumed from the CSS alone) — fixed by moving `display` out of the inline style entirely and into a `.step-quiz-badge-desktop { display: flex; align-items: center; }` base rule that the mobile media query can actually override.

**Measured (375×812, real dev server, after the fix):** `StepProgress`'s own `[role="listitem"]` children confirmed all 6 steps present in the DOM (`✓症例選択`, `✓適応判断`, `✓製品選択`, `✓サイズ`, `5配置調整`, `6評価`) and the header's `scrollWidth === clientWidth` (no scroll needed — everything fits once the badge moved out) at 375px width. At 1280px width, `.step-quiz-badge-desktop` computed `display: flex` and `.step-quiz-badge-mobile` computed `display: none` — confirmed the reverse of the mobile case, i.e. no duplicate badge and no regression on desktop.

### ④ Control Panel buttons — shrunk with an explicit, documented trade-off

**Context worth stating plainly:** `HoldButton`'s 44px minimum size is not an arbitrary default — a comment already in the code records that it was deliberately *raised* from 36px after a prior real-device review (by the same user) found 36px caused mis-taps. This pass's request to shrink it again is a second, later, more specific real-device finding (the panel dominating the Canvas) from the same reviewer, so it was treated as an intentional, current instruction — not a reason to silently reopen the old 36px-was-too-small debate. The fix keeps that history legible in-code rather than erasing it.

**Fix (`HoldButton.tsx` + `index.css`):** `minWidth`/`minHeight` changed from the literal `44` to `var(--control-pad-button-size, 44px)` — default unchanged at 44px (desktop, iPad, and any other hypothetical `HoldButton` consumer are unaffected), overridden to **38px** only inside the mobile media query. 38 was chosen as a middle point: larger than the previously-rejected 36px, smaller than 44px.

**Measured (375×812, real dev server):** `HoldButton` height confirmed at 38px (matching the token). `ControlPad`'s expanded panel height dropped from 294.7px (Part 2) to **270.7px**, and — combined with ②'s Canvas-height gain — the panel's fraction of the (now-taller) Canvas dropped from **0.68 → 0.52**, meaningfully more Canvas remains visible around it when open, even though the panel's own width (335px, Part 2's 2-column reflow) is unchanged.

## 19. Regression Checks (Part 3)

Re-run after all four fixes above, using the same method as Parts 1–2 (measured DOM/CSS values from a real running dev server, not visual inspection alone — this sandbox's Browser pane still does not composite frames, so an actual screenshot still could not be captured, per Part 1 §9 and Part 2 §14's documented limitation):

- **Desktop (1280px):** `.layout-split` confirmed `display: grid`, `952px 280px` columns, unchanged. Toolbar row's pill-button `padding` confirmed `4px 12px` (the original `--space-1 --space-3` desktop value, not the mobile-compacted one). `.step-quiz-badge-desktop` confirmed `display: flex`, `.step-quiz-badge-mobile` confirmed `display: none`.
- **iPad (820px):** `.layout-split` confirmed on the desktop grid (`492px 280px` columns), not forced into mobile treatment.
- **Mobile landscape (667×375):** `layout-split.scrollHeight === layout-split.offsetHeight` (no overflow regression from Part 1's landscape fix, still intact). Toolbar row confirmed `overlapsTagBar: false` at this size too.
- **Lint / TypeCheck / Build:** all three re-run clean. Lint was verified with a rigorous `git stash` A/B comparison (not a filename grep, which Part 2's own §13 correction already flagged as insufficient once): total problem count is **identical — 161 problems (147 errors, 14 warnings) — in both the pristine D-4 baseline and the current working tree**, and a filtered diff of every lint line touching this task's ten changed files between the two runs is **empty**. One additional pre-existing finding surfaced in this pass's raw lint output that hadn't been visible in Part 2's narrower check (`SimulationMode.tsx:43` — unused `SURGICAL_VIEWS` import) — confirmed via `git show HEAD:src/components/SimulationMode.tsx` to already exist, unused, in the untouched D-4 baseline, i.e. not introduced by any pass of this task.

## 20. Known Limitations (Part 3)

- The toolbar's single row (§18①) requires horizontal scrolling to reach every control on the narrowest phones — by design, as the more robust alternative to either overlapping the tag bar or re-wrapping into multiple rows. The `回転`/pan toggle in particular sits at the scrolled-away end of the strip. This trades discoverability for the explicitly-requested single-row, non-overlapping, non-multi-row layout; a future increment could consider a small scroll-affordance indicator (e.g. a fade/chevron hint) if real-device feedback shows users don't discover the scroll.
- `ControlPad`'s 38px buttons (§18④) are a deliberate, explicit exception to the 44pt HIG guideline that this same codebase's own history says was chosen for a reason (mis-tap avoidance at 36px). 38px was chosen as a documented middle point, not re-validated against actual mis-tap rates on a physical device in this pass.
- As in Parts 1 and 2, this sandbox's Browser pane does not composite frames, so every measurement in §18–§19 is real DOM/CSS geometry from an actual running dev server (including real `getComputedStyle()`/`getBoundingClientRect()`/scroll-position checks, not visual estimation), but not a physical-device screenshot. The user's own iPhone Safari is what surfaced all four issues this pass fixes; a follow-up real-device check of this pass's specific changes is the natural next step before treating §17's four items as fully closed.

## 21. Final Report (Part 3)

```text
Mobile Depth:
REAL DEVICE PASS (not touched this pass)

Long Press:
REAL DEVICE PASS (not touched this pass)

Control Panel open/close:
REAL DEVICE PASS (mechanism untouched this pass)

Toolbar single-row (new, user-requested):
PASS (all 5 control groups confirmed in one non-wrapping row, 42px tall, down from ~168-225px; horizontal scroll confirmed functional end-to-end via elementFromPoint hit-testing at the scrolled position; no tag-bar overlap; a stretch/height bug caused by flex-shrink was caught and fixed via PillToggleGroup.tsx during this same pass)

Lower info panel size (②):
PASS (sidebar height 260px→178.6px via reduced padding/gap/cap; Canvas gained +19% height as a direct result; Part 2's reachability fix for PlacementFeedback/ViewPresetPanel re-confirmed intact at the smaller cap)

Step-progress header clipping (③):
PASS (all 6 steps confirmed present and reachable with zero horizontal scroll after relocating the quiz badge; a real inline-style-vs-CSS-class bug was caught via getComputedStyle checks at both breakpoints and fixed, not just assumed correct from the CSS alone)

Control Panel button size (④):
PASS (documented, explicit trade-off: 38px mobile-only via a new CSS token, 44px unchanged everywhere else; panel height 294.7px→270.7px; panel's fraction of the canvas 0.68→0.52)

Desktop regression:
PASS

iPad regression:
PASS

Mobile landscape:
PASS (no overflow, no toolbar/tag-bar overlap)

TypeCheck:
PASS

Build:
PASS

Lint:
PASS (rigorous git-stash A/B comparison: 161 problems in both baseline and current, identical file-level diff; one additional pre-existing finding confirmed via git show HEAD, not introduced by this task)

D-4 Safety Boundary:
UNCHANGED (SimScene.tsx and canonicalPose.ts were not touched in this pass; same as Part 2)

Documentation:
UPDATED (docs/M2_Mobile_First_UX_Implementation_v1.0.md — this Part 3 section; docs/M1_Mobile_First_UX_Investigation_v1.0.md NOT modified)

Commit:
NOT EXECUTED

Push:
NOT EXECUTED
```

---

## 22. Part 4 — Second Screenshot-Driven Follow-Up

**Trigger:** Second iPhone Safari screenshot of the Placement step (Part 3's result), with four Japanese instructions: ① move the top-right toolbar down to the top of the "TTP-VARIAC PORP" product-info card (one-handed reach was the complaint, not the single-row/scroll mechanics); ② approved as-is; ③ the step-progress header was still visibly clipped/overlapping; ④ `ControlPad` still dominated the canvas when open — requested every button become a perfect square like the existing 上/下/内/外 D-pad buttons, arranged in a single vertical column docked to the screen's left edge, keeping the existing collapse/expand toggle.

### 22.1 Root causes

- **① Toolbar location.** Not a bug — a placement request. The toolbar's JSX was extracted into a single local `toolbarRow` variable inside `PlacementStep` (`SimulationMode.tsx`) so the desktop (`ToolbarContainer`, Canvas top-right) and mobile (top of the sidebar product card) renders share one source of truth. `.toolbar-desktop-only` / `.toolbar-mobile-only` classes (same pattern as `.step-quiz-badge-*`) pick which one is visible per breakpoint — display is owned entirely by the CSS class, never by inline `style`.
- **③ Step-progress clipping.** Same bug class as Part 3's toolbar-wrap issue, just not caught there: `StepProgress.tsx`'s root `<div role="list">` has `flexWrap: 'wrap'` on itself but no `flexShrink: 0`. Nested inside the mobile header's `nowrap` flex row, the ancestor squeezed it below its natural width, and the inner `flexWrap: 'wrap'` fired, wrapping the six steps onto two overlapping lines. Fixed identically to the Part 3 `PillToggleGroup` fix: `flexShrink: 0` on the root, plus tokenized (`--step-progress-*`) mobile sizing to reduce reliance on horizontal scroll.
- **④ ControlPad squares/single-column/left-edge.** A mobile-only layout redesign. Every internal grid in `ControlPad.tsx` had `display`/`flexDirection`/`alignItems` converted from hardcoded values to `var(--cp-*, <original value>)`, so one mobile `:root` override flips every grid from `grid` to `flex; flex-direction: column`. `HoldButton` gained an optional `className` prop; every `ControlPad` button carries `className="cp-btn"`, and a mobile-only rule gives `.cp-btn` a fixed `width`/`height` = `--control-pad-button-size` (38px, additive to the existing `minWidth`/`minHeight`, not conflicting). `--control-pad-width` (mobile) dropped from 336px to 60px. Section backgrounds/padding/labels collapse to nothing on mobile so the result reads as one continuous column; each button's own short label still carries the meaning. The close button's text label is hidden on mobile — the button and its `aria-label` are untouched.

### 22.2 Verification (real dev server, DOM measurement)

Walked the full flow (Home → プロステーシス選択 → 症例12 → 適応判断 quiz → TTP-VARIAC PORP / 2mm → 配置調整) at 375×812:

- **①** `.toolbar-desktop-only` computed `display: none`, `.toolbar-mobile-only` computed `display: block` at `y≈634` (inside the product card, thumb-reachable). At 1280px correctly reverts.
- **③** `StepProgress` root height went from a broken 2-line wrap to a single 16px line; all 6 step items fit inside 375px with zero clipping (last item's right edge at 370px).
- **④** All 12 visible buttons measured 38×38px exactly, same `x` (single column, left edge). Panel width 60px, occupies 17% of Canvas width (was ~94%). Panel does not overflow `.canvas-wrapper` (internal scroll engages correctly). Collapse/expand toggle re-verified working.
- **Desktop (1280px) regression:** `.cp-btn` D-pad buttons 44×44px, 前傾 button 144×44px (unchanged, not forced square), `--control-pad-width` back to 168px. No `.cp-btn`/`--cp-*` rule exists outside the mobile media query.
- **Mobile landscape (667×375) regression:** no `.layout-split` overflow.

TypeCheck: PASS. Build: PASS. Lint: PASS (`git stash -u` A/B, 155 problems identical before/after). D-4 Safety Boundary: UNCHANGED (`SimScene.tsx`/`canonicalPose.ts` not touched).

### 22.3 Bugs found and fixed mid-pass

- **`font` shorthand vs. `fontSize`.** `StepProgress.tsx` originally used the shorthand `font: 'var(--text-small)'` (`--text-small` = `400 12px/18px var(--font-family)`). A tokenization pass mistakenly renamed this to `fontSize: 'var(...)'`, which is invalid for the single-value `font-size` property and would have silently reset the font size on both desktop and mobile. Caught before running the dev server. Fixed by keeping `font` and renaming the token to `--step-progress-font`.
- **`flexDirection` TypeScript strictness.** `React.CSSProperties['flexDirection']` has no arbitrary-string escape hatch (unlike `display`/`gridTemplateColumns`/`maxWidth`). `flexDirection: 'var(...)'` failed `npx tsc -b` in four places. Fixed by casting each occurrence `as CSSProperties['flexDirection']`.

### 22.4 Known limitations

Screenshot-based visual verification remains impossible in this sandbox. All verification is DOM/CSS geometry from a real running Vite dev server; UI interaction was driven via `javascript_tool` `.click()` calls on real DOM elements. Real-device re-verification is still recommended.

### 22.5 Final report

```
Issue ①（ツールバー位置）: FIXED — Canvas右上 → 製品情報カード最上部（サイドバー、親指到達範囲）
Issue ②: 変更なし（承認済みのため）
Issue ③（ステップ進行バー見切れ）: FIXED — flexShrink:0 + トークン圧縮、375px幅で6ステップ全てclipping無し
Issue ④（ControlPad正方形・縦一列・左端）: FIXED — 全ボタン38x38正方形、単一列、パネル幅60px（Canvas幅の17%、旧94%から大幅減）

TypeCheck: PASS / Build: PASS / Lint: PASS（git stash A/B比較、155件完全一致）
D-4 Safety Boundary: UNCHANGED
Desktop/iPad/Mobile Landscape regression: PASS
Commit: NOT EXECUTED / Push: NOT EXECUTED
```

---

## 23. Part 4 addendum — ControlPad 2-column correction

**Trigger:** After §22 shipped, shoji approved ①③ as-is but reported that in ④'s single vertical column, 左傾/右傾 and the シャフト回転 buttons were not visible on the real device — the panel scrolled internally but the scroll wasn't discovered. Requested a 2-column layout instead, and buttons "one size smaller".

**Bug found while implementing this:** `gridSwitchStyle` (the shared style object introduced in §22.1 for the four 2-button groups — 前/後, 回転, シャフト回転, Depth) was missing `gridTemplateColumns` and `gap` entirely. On mobile this was masked by the flex-column override, but on **desktop** it silently broke the original 2×2 grid for 回転/シャフト回転/Depth into a single stacked column (4 rows instead of 2×2) — a real, previously-unverified regression from §22, caught only now while re-touching this code. Confirmed via DOM measurement before/after: 前傾/後傾/左傾/右傾 now sit at two distinct `y` values (2×2), where before the fix they would have stacked at four different `y` values.

**Fix, mobile-only layout:**
- The four `gridSwitchStyle` groups are now a **fixed** `display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px` — no longer CSS-variable/breakpoint-dependent at all, since the desired behavior (2 columns) turned out to be identical on both desktop and mobile. This also fixes the desktop regression above.
- The 位置 D-pad (上/内/下/外 cross) is reverted to its original **fixed** grid — no mobile override — since shoji specifically praised this exact layout as the reference example; the follow-up 3 flex-column override was never appropriate for it and is now removed, along with the now-dead `.cp-dpad-spacer` CSS rule.
- `--control-pad-button-size` (mobile): 38px → **34px** ("一回り小さく").
- `--control-pad-width` (mobile): 60px → **132px** (sized to the D-pad's 3-column cross width, the widest section, plus panel padding).
- Removed the now-unused `--cp-dpad-*` / `--cp-grid2-*` custom properties (both the `:root` defaults and the mobile overrides) — the outer section-stacking (`--cp-outer-*`) and section/label visibility (`--cp-section-*`, `--cp-label-display`) tokens are unchanged and still mobile-only.

**Verification (375×812, real dev server, DOM measurement):** all 12 buttons measured 34×34px exactly; 前傾/後傾 at `y=476`, 左傾/右傾 at `y=516` (2×2 confirmed); シャフト回転's ↺/↻ at `y=558`, both within the visible panel. Scroll area `scrollHeight === offsetHeight` (**244px === 244px**) — the panel no longer needs to scroll at all; every button is visible without any interaction beyond opening the panel. Panel width 132px, 37% of Canvas width (up from 17%, but every button is now reachable without a hidden scroll — the tradeoff shoji asked for). Panel still does not overflow `.canvas-wrapper` (bottom 600px vs. wrapper bottom 617px). Desktop (1280px) regression re-checked: 回転 group now correctly renders as 2×2 (前傾/後傾 same `y`, 左傾/右傾 same `y`, confirming the regression fix). Mobile landscape (667×375): no `.layout-split` overflow.

TypeCheck: PASS. Build: PASS. Lint: PASS (`git stash -u` A/B, 155 problems identical before/after, byte-identical after stripping line numbers). D-4 Safety Boundary: UNCHANGED.

```
Issue ④ 追加修正: FIXED — 全ボタン2列配置に変更（左傾/右傾/シャフト回転の非表示問題を解消）、34x34へ再縮小、スクロール不要（内部scrollHeight===visible height）
副次的に発見: real-device follow-up 3で導入したgridSwitchStyleにgridTemplateColumns/gapが欠落し、デスクトップの回転/シャフト回転/Depthグリッドが意図せず1列4行に壊れていた — 同時に修正

TypeCheck: PASS / Build: PASS / Lint: PASS（git stash A/B比較、155件完全一致）
D-4 Safety Boundary: UNCHANGED
Desktop/Mobile Landscape regression: PASS
Commit: NOT EXECUTED / Push: NOT EXECUTED
```

---

## 24. Part 4 addendum 2 — 位置 D-pad → paired-row order, alignment fix

**Trigger:** shoji approved the §23 2-column fix, but reported "前" was misaligned, and specified the exact desired top-to-bottom order: 上下 → 内外 → 前後 → 前傾後傾 → 左傾右傾 → 左回転右回転.

**Root cause:** The 位置 section still used its original 3-column×2-row cross grid (上/内/下/外) from before §22, while 前/後 directly below it used the (now-fixed) 2-column `gridSwitchStyle`. Different column counts between the two grids meant their left edges didn't line up — "前" sat under the cross's middle column, not under "内"/"上".

**Fix:** Replaced the cross entirely with three stacked pairs using the exact same `gridSwitchStyle` as every other section: (上,下), (内,外), (前,後). `DirLabel` (icon + anatomical term) is kept for 上/内/下/外 for clarity; only the grid placement changed. This is a universal change (not mobile-only) since the misalignment bug existed on both breakpoints and the simpler pattern is easier to keep correct going forward — no complaints had been raised about the desktop cross specifically, and desktop D-pad buttons remain functionally identical (44px tall, just no longer forced square via the old 3-col cross math).

**Verification (375×812):** all 12 buttons now measured at exactly two `x` positions (50, 90) across all six rows — 上/下 (y=355), 内/外 (y=395), 前/後 (y=435), 前傾/後傾 (y=477), 左傾/右傾 (y=517), ↺/↻ (y=559) — confirming both the requested order and column alignment. No scroll needed (`scrollHeight === visible height`, 242px). Desktop (1280px) re-verified: same order, consistent `x` positions (41, 116) across all six rows. Mobile landscape: no `.layout-split` overflow.

TypeCheck: PASS. Build: PASS. Lint: 155 problems (same count as the already-verified baseline in §22/§23; only `ControlPad.tsx` changed, a pure JSX/layout edit with no new/removed imports).

```
追加修正: FIXED — 位置セクションの十字配置を廃止し、他セクションと同じ2列ペア方式に統一。指定順（上下/内外/前後/前傾後傾/左傾右傾/左回転右回転）で全列が同じx位置に揃うことを実測確認
TypeCheck: PASS / Build: PASS / Lint: PASS（155件、既存ベースラインと同数）
Desktop/Mobile Landscape regression: PASS
Commit: NOT EXECUTED / Push: NOT EXECUTED
```

---

## 25. Part 4 addendum 3 — ControlPad bezel thinning

shoji approved §24's ordering/alignment fix but noted the panel's bezel (the empty margin between the glass panel's edge and the button grid) was still too thick. Tokenized `--cp-panel-padding` (panel outer padding) and added a new `--cp-close-btn-pad` token (close-button row's own padding, previously a hardcoded `2px 2px 6px` shared by both breakpoints) so mobile can shrink independently of desktop. Mobile values: panel padding 6px → 2px, close-button padding → `1px 1px 3px`. Desktop unchanged (8px / `2px 2px 6px`). Verified via `getComputedStyle` at 375px: panel `padding: 2px` confirmed. TypeCheck/Build: PASS.

Note: a separate, unrelated fix (TORP/`FLAT` foot-type shaft geometry — head plate/shaft disconnection and shaft piercing through the foot) was made in the same working session at shoji's request but is **out of scope for this document** (it is 3D prosthesis-model geometry, not mobile UX) — see the inline code comment at `src/scenes/models/ProsthesisModels.tsx` (`isFlat` branch of the shaft-position formula, `ProsthesisModel()`) and the chat response for full detail.

---

## 26. Part 4 addendum 4 — ControlPad width tightened, tag bar 2-row grouping

Two more mobile items from shoji's follow-up:

**① ControlPad left/right margin still too thick.** §24's switch away from the position D-pad's 3-column cross made `--control-pad-width: 132px` (sized for the old cross) stale — the panel's actual content is now only 2 columns wide (74px), leaving ~54px of unused side margin. Tightened to `78px` (2×34px buttons + 6px gap + the §25 2px×2 panel padding — content-width exact, no slack). Verified at 375px: panel spans x=[21,99] (78px), both buttons in each row sit flush against the padding on both sides, no overflow.

**③ procedure/lesion tag bar wrapping into 3+ lines.** `ContextTagBar` (shared with `StepFlowMode.tsx`) renders procedure tags (blue) and lesion tags (orange) in one `flex-wrap` row; on a narrow viewport with several tags this could wrap unpredictably across lines with tags of different colors mixed together. Restructured the `SimulationMode.tsx` top-left overlay (mobile-only, via the same `.xxx-desktop-only`/`.xxx-mobile-only` class-toggle pattern as §22) into two grouped rows — procedure tags on row 1, lesion tags on row 2 — using `ContextTagBar`'s existing `wrap={false}` escape hatch twice rather than modifying the shared component itself (`StepFlowMode.tsx` and desktop are untouched).

While verifying, found that `.canvas-overlay.top-left`'s mobile `max-width: 55%` (added in an earlier follow-up specifically so the tag bar wouldn't overlap the top-right toolbar) was now solving a problem that no longer exists — that toolbar was relocated off the canvas entirely in §22, issue①. The stale 55% cap was causing the new 2-row grouping to still wrap a third time inside the lesion-tags row. Relaxed it to `90%` (mobile-only). Verified at 375px: both rows now render at a single line each (21px height, was 47px for row 2 before the relaxation) — exactly the two-row layout shoji asked for, no further wrapping.

Verified no regression: desktop (1280px) — `.tagbar-desktop-only` visible/`.tagbar-mobile-only` hidden, `max-width: none` (untouched, media-query-scoped change). Mobile landscape (667×375) — no `.layout-split` overflow. TypeCheck/Build: PASS. Lint on touched files (`SimulationMode.tsx`, `ProsthesisModels.tsx`, `index.css`): only pre-existing findings (unused legacy exports, hook-dependency warnings elsewhere in `ProsthesisModels.tsx`; `index.css` itself isn't a lintable target under the project's ESLint config), none on the changed lines.

---

## 27. M-2 Closure

**M-2 Status: CLOSED**

**Implementation Baseline (commit):** `088dd9b0133b92b2f6a81044ae9fc63c5fd5b054` — pushed to `origin/main`, `HEAD == origin/main` confirmed at time of closure. This commit bundles all of Parts 1–4 (§1–§26 above) plus an unrelated 3D-geometry fix (TORP/PORP shaft-headplate connection, out of this document's scope — see `src/scenes/models/ProsthesisModels.tsx` inline comments, `isBell`/`isFlat` branch of the shaft-position formula in `ProsthesisModel()`).

### 27.1 Final Validation Summary

Re-verified against the committed baseline (not the pre-commit working tree) via a dedicated Final Validation pass — no source changes were made during that pass.

| Item | Result |
|---|---|
| Mobile Portrait | PASS |
| Control Panel | PASS — 4-cycle open/close/reopen/reclose confirmed; 78×264px, 22% of Canvas width, no overflow, all 12 buttons uniform 34×34px squares, no overlap with any other panel |
| Lower Information Panel | PASS — PlacementFeedback (配置状況) and ViewPresetPanel (視点プリセット) 4-cycle open/close confirmed; no pointer-events/z-index/stacking conflicts at any breakpoint |
| Toolbar | PASS — all 7 controls (移動/視点/内視鏡/通常/理想位置/軟骨/回転↔平行移動) present, active-state correct, toggle functional, no overlap with the tag overlay |
| Canvas | PASS — no `.layout-split` overflow at any tested breakpoint (375×812, 667×375, 1280×800, 820×1180) |
| Touch Depth | **REAL DEVICE PASS** — see §27.2, Evidence basis |
| Long Press | **REAL DEVICE PASS** — see §27.2, Evidence basis |
| Mobile Landscape (667×375) | PASS — no overflow; Control Panel (170px) fits inside a 199px Canvas; landscape-specific media query (`max-width:768px and max-height:500px`) unchanged |
| Desktop Regression (1280px) | PASS — grid layout unchanged (952px+280px), desktop-only toolbar/tag-bar variants visible, mobile variants hidden by construction, ControlPad back to 168px/69×44px buttons, `前傾` correctly in a 2×2 grid |
| iPad Regression (820px) | PASS — above the 768px mobile breakpoint, correctly renders the desktop layout, unaffected |
| 3D Geometry | PASS — TORP/PORP shaft-headplate fixes; diff scoped exclusively to the `shaftLen`/`shaftY` formulas and one refactored constant, zero console errors on live smoke test |
| TypeCheck | PASS (`npx tsc -b` against the committed baseline) |
| Build | PASS (`npm run build` against the committed baseline) |
| Lint | PASS — 155 problems, identical between the committed baseline and its parent commit (`39d88e6`); new lint findings = 0 |
| D-4 Safety Boundary | **UNCHANGED** — see §27.3 |
| Documentation | ADEQUATE |
| Closure Blockers | NONE |

### 27.2 Evidence basis for Touch Depth / Long Press

Neither item was re-tested on physical iPhone hardware during Final Validation — this sandbox has no access to physical devices, the same constraint noted throughout M-2. "REAL DEVICE PASS" for these two items is the combination of:
1. Shoji's prior real-device confirmation, from the initial M-2 real-device validation round (§11 above) — Depth and Long-Press were reported PASS there and never regressed in any later round.
2. Static regression verification against the final committed diff, done this closure pass: `git diff HEAD~1 HEAD` shows the PageUp/PageDown Depth logic was relocated into a named `performDepthStep()` function with a byte-identical body (same single `camera.getWorldDirection(camDir)` call, same `evaluateDragCandidate(depthDelta)` guard, same Depth Session snapshot logic) — a pure extraction, not a rewrite. `HoldButton.tsx`'s long-press protections (`onPointerCancel`, `userSelect:none`, `WebkitUserSelect:none`, `WebkitTouchCallout:none`, `touchAction:none`) are all present and unmodified in the current file.

This is a code-level regression check standing in for a device re-test, not a claim that either was tapped on a physical phone again this pass.

### 27.3 D-4 Safety Boundary confirmation

UNCHANGED. Confirmed via full-diff review (`git diff HEAD~1 HEAD`) and targeted search for: `resolveCanonicalPose()`, `evaluateDragCandidate()`, `evaluateRotationCandidate()`, Collision Engine / `MeshBVH`, R4 Geometry, Candidate B, `FOOT_CONTACT_TOLERANCE_MM`, Camera-relative Depth mathematics, Scoring semantics, Placement collision semantics.

- `resolveCanonicalPose()` does not appear anywhere in the commit diff.
- `MeshBVH`/`BVH`/`FOOT_CONTACT_TOLERANCE_MM`/"Candidate B": zero matches anywhere in the diff — the collision-engine file is not part of this commit at all.
- `evaluateDragCandidate()` appears only as an unmodified call inside the relocated `performDepthStep()` (one removed call site, one added, identical) and as an unchanged dependency-array entry; the function itself is not redefined, and no new collision/movement path bypassing it was introduced.
- `enforcePlacementCollisionGate` on `<ControlPad>` in `SimulationMode.tsx`: unchanged (only its host wrapper `<div>` moved).
- Scoring (`computeScore()`) and Placement collision semantics: not present in the diff.

No changes were made to the D-4 boundary to reach this closure — none were needed.

### 27.4 Post-M2 Enhancements (not Closure Blockers)

These were identified during Final Validation and are explicitly **not** defects in the M-2 baseline — both were requested and approved by shoji across multiple real-device rounds during M-2 itself. They are candidates for future, separate work only:

- **ControlPad touch target: 34px.** Below the Apple HIG 44pt guideline, but the result of shoji's own explicit, repeated sizing requests during Part 4 (38px → 34px, "一回り小さく"). Current M-2 defect: NO. Closure blocker: NO.
- **Top toolbar horizontal scroll.** The 7 mobile toolbar controls (332px visible vs. 434px content) require horizontal scroll to reach the last item on narrow viewports. This is the accepted "iOS control-strip" pattern from an earlier round, confirmed working (§19/§22), not a new gap. Current M-2 defect: NO. Closure blocker: NO.

Per shoji's instruction, M-2 is not to be reopened on the basis of either item.
