import * as THREE from 'three';
import { distanceToLayer, remainingThicknessToLayer, ANATOMY_LAYERS } from '../src/engine/anatomyLayer';
import { BONE_MATERIALS, BONE_QUALITY_PROFILES, effectiveMaterial } from '../src/engine/boneMaterial';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('PASS: ' + msg);
}

const facial = ANATOMY_LAYERS.find((l) => l.id === 'facial-nerve')!;
assert(facial.geometry.kind === 'polyline', 'facial-nerve is polyline');
if (facial.geometry.kind === 'polyline') {
  assert(facial.geometry.points.length === 3, 'facial-nerve has 3 points');
}

assert(!!ANATOMY_LAYERS.find((l) => l.id === 'sigmoid-sinus'), 'sigmoid-sinus present as point layer');
assert(
  ANATOMY_LAYERS.filter((l) => l.id.startsWith('facial-') && l.id !== 'facial-nerve').length === 0,
  'individual facial-* zones absorbed into facial-nerve'
);
assert(ANATOMY_LAYERS.length === 3, `total 3 layers (got ${ANATOMY_LAYERS.length})`);

if (facial.geometry.kind === 'polyline') {
  const pts = facial.geometry.points;
  const mid = pts[0].clone().add(pts[1]).multiplyScalar(0.5);
  const d = distanceToLayer(mid, facial);
  assert(Math.abs(d) < 1e-9, `midpoint of first segment distance ~0 (got ${d})`);

  const last = pts[pts.length - 1];
  const beyond = last.clone().add(new THREE.Vector3(0, -10, 0));
  const d2 = distanceToLayer(beyond, facial);
  assert(Math.abs(d2 - 10) < 1e-6, `point beyond last segment clamps to endpoint distance (got ${d2})`);
}

const nearFacial =
  facial.geometry.kind === 'polyline' ? facial.geometry.points[0].clone() : new THREE.Vector3();
const result = remainingThicknessToLayer(nearFacial);
assert(!!result, 'remainingThicknessToLayer returns a result');
if (result) {
  assert(result.layer.id === 'facial-nerve', `nearest layer is facial-nerve (got ${result.layer.id})`);
  assert(
    Math.abs(result.dist - (0 - facial.dangerRadius)) < 1e-6,
    `dist = distance(0) - dangerRadius (got ${result.dist})`
  );
}

const base = BONE_MATERIALS.cortex;
const std = effectiveMaterial(base, BONE_QUALITY_PROFILES.standard);
assert(Math.abs(std.density - base.density) < 1e-9, 'standard profile: density unchanged');
assert(Math.abs(std.hardness - base.hardness) < 1e-9, 'standard profile: hardness unchanged');

const scl = effectiveMaterial(base, BONE_QUALITY_PROFILES.sclerotic);
assert(scl.hardness > base.hardness, `sclerotic profile increases cortex hardness (base=${base.hardness}, scl=${scl.hardness})`);

const oticBase = BONE_MATERIALS.oticCapsule;
const oticScl = effectiveMaterial(oticBase, BONE_QUALITY_PROFILES.sclerotic);
const expectedOticHardness = Math.min(
  1.3,
  Math.max(
    0.1,
    oticBase.hardness * BONE_QUALITY_PROFILES.sclerotic.densityFactor * BONE_QUALITY_PROFILES.sclerotic.calcificationFactor
  )
);
assert(
  Math.abs(oticScl.hardness - expectedOticHardness) < 1e-9,
  `oticCapsule hardness ignores pneumatizationFactor (got ${oticScl.hardness}, expected ${expectedOticHardness})`
);

const extreme = { id: 'extreme', nameJa: 'x', densityFactor: 3, pneumatizationFactor: 0.1, calcificationFactor: 3 };
const clamped = effectiveMaterial(base, extreme);
assert(clamped.hardness === 1.3, `extreme profile clamps hardness to 1.3 (got ${clamped.hardness})`);

console.log('ALL TESTS PASSED');
