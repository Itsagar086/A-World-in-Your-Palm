/* =============================================================================
 * Tiny World — 00-core.js
 * The primitive kit. Everything in this world is built from code: there are no
 * textures, no model files, no atlases. A handful of tiny helpers stamp out
 * boxes, faceted rocks, cones and swept ribbons, and every prop in the game is
 * a composition of those.
 *
 * The one rule that makes it fast: props are authored as deep hierarchies of
 * hundreds of little meshes, then bake() flattens each prop into one or two
 * merged draw calls before it ever reaches the renderer.
 * ============================================================================= */
(function (global) {
  'use strict';

  var T = global.THREE;
  var TW = (global.TW = global.TW || {});

  /* --- math ---------------------------------------------------------------- */

  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;
  var clamp = T.MathUtils.clamp;
  var lerp = T.MathUtils.lerp;
  var smoothstep = T.MathUtils.smoothstep;
  var damp = T.MathUtils.damp;

  /* A tiny deterministic LCG. The world must look identical on every machine,
   * so nothing anywhere is allowed to call Math.random() during generation. */
  var _seed = 20260904 >>> 0;
  function rand(a, b) {
    if (a === undefined) a = 0;
    if (b === undefined) b = 1;
    _seed = (_seed * 1664525 + 1013904223) >>> 0;
    return a + (b - a) * (_seed / 4294967296);
  }
  function reseed(v) {
    _seed = v >>> 0;
  }
  /* An independent stream, for callers that need their own repeatable sequence. */
  function makeRandom(seed) {
    var s = seed >>> 0;
    return function (a, b) {
      if (a === undefined) a = 0;
      if (b === undefined) b = 1;
      s = (s * 1664525 + 1013904223) >>> 0;
      return a + (b - a) * (s / 4294967296);
    };
  }

  /* --- materials ----------------------------------------------------------- */

  /* Materials are deduplicated by (colour + options). A world of tens of
   * thousands of meshes ends up sharing a few dozen materials, which is what
   * lets bake() collapse everything so aggressively. */
  var _matCache = new Map();
  function mat(color, opts) {
    if (color && color.isMaterial) return color;
    var key =
      (color && color.isColor ? color.getHexString() : String(color)) +
      (opts ? JSON.stringify(opts) : '');
    var m = _matCache.get(key);
    if (!m) {
      m = new T.MeshStandardMaterial(
        Object.assign({ color: color, flatShading: true, roughness: 0.88, metalness: 0 }, opts)
      );
      _matCache.set(key, m);
    }
    return m;
  }

  /* --- dynamic registry ---------------------------------------------------- */

  /* Anything that moves registers a per-frame callback here and marks its
   * subtree dynamic so bake() leaves it alone. */
  var tickers = [];
  function dyn(object, fn) {
    object.userData.dynamic = true;
    if (fn) tickers.push(fn);
    return object;
  }
  function tickAll(t) {
    for (var i = 0; i < tickers.length; i++) tickers[i](t);
  }

  /* --- primitives ---------------------------------------------------------- */

  /* An empty transform node. The workhorse: props are built as trees of these. */
  function group(parent, x, y, z, scale, rotY) {
    var g = new T.Group();
    g.position.set(x || 0, y || 0, z || 0);
    g.scale.setScalar(scale === undefined ? 1 : scale);
    g.rotation.y = rotY || 0;
    if (parent) parent.add(g);
    return g;
  }

  /* A moving group — excluded from baking. */
  function pivot(parent, x, y, z) {
    var g = group(parent, x, y, z);
    g.userData.dynamic = true;
    return g;
  }

  function mesh(parent, geometry, color, x, y, z) {
    var m = new T.Mesh(geometry, mat(color));
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = !m.material.transparent;
    m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }

  var UNIT_BOX = new T.BoxGeometry(1, 1, 1);
  var UNIT_ICO1 = new T.IcosahedronGeometry(1, 1);
  var UNIT_ICO0 = new T.IcosahedronGeometry(1, 0);

  /** Axis-aligned box of explicit size. */
  function box(parent, x, y, z, w, h, d, color, rotY) {
    var m = mesh(parent, UNIT_BOX, color, x, y, z);
    m.scale.set(w, h, d);
    m.rotation.y = rotY || 0;
    return m;
  }

  /** Faceted blob — the universal rock / boulder / bush core. Randomly tumbled
   *  so no two ever read as copies. `coarse` drops to a 20-face icosahedron. */
  function rock(parent, x, y, z, w, h, d, color, coarse) {
    var m = mesh(parent, coarse ? UNIT_ICO0 : UNIT_ICO1, color, x, y, z);
    m.scale.set(w, h, d);
    m.rotation.set(rand(-0.15, 0.15), rand(0, TAU), rand(-0.12, 0.12));
    return m;
  }

  /** Tapered cylinder: `rBottom` at the base, `rTop` at the top (0 = cone). */
  function cone(parent, x, y, z, rBottom, height, color, segments, rTop) {
    return mesh(
      parent,
      new T.CylinderGeometry(rTop || 0, rBottom, height, segments || 6, 1),
      color, x, y, z
    );
  }

  /** Straight cylinder. */
  function tube(parent, x, y, z, radius, height, color, segments) {
    return cone(parent, x, y, z, radius, height, color, segments || 8, radius);
  }

  function torus(parent, x, y, z, radius, thickness, color, segments, flat) {
    var m = mesh(
      parent,
      new T.TorusGeometry(radius, thickness, 4, segments || 12),
      color, x, y, z
    );
    if (flat) m.rotation.x = Math.PI / 2;
    return m;
  }

  function sphere(parent, x, y, z, radius, color, detail) {
    return mesh(parent, new T.IcosahedronGeometry(radius, detail === undefined ? 2 : detail), color, x, y, z);
  }

  /** A cylinder stretched between two points — rope, branch, strut, rail. */
  function link(parent, a, b, radius, color, segments, radius2) {
    var from = new T.Vector3().fromArray(a);
    var to = new T.Vector3().fromArray(b);
    var axis = to.clone().sub(from);
    var m = mesh(
      parent,
      new T.CylinderGeometry(radius2 === undefined ? radius : radius2, radius, axis.length(), segments || 5),
      color
    );
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), axis.normalize());
    return m;
  }

  /** A box stretched between two points — plank, beam, fence rail. */
  function beam(parent, a, b, width, color, depth) {
    var from = new T.Vector3().fromArray(a);
    var to = new T.Vector3().fromArray(b);
    var axis = to.clone().sub(from);
    var m = box(parent, 0, 0, 0, width, axis.length(), depth === undefined ? width : depth, color);
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), axis.normalize());
    return m;
  }

  /** Raw triangle soup. `verts` is an array of [x,y,z]; `faces` an array of
   *  index triples (omit for an implicit triangle list). */
  function poly(verts, faces, colors) {
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(verts.flat(Infinity), 3));
    if (faces) g.setIndex(faces.flat(Infinity));
    var out = g.index ? g.toNonIndexed() : g;
    if (out !== g) g.dispose();
    out.computeVertexNormals();
    if (colors) out.setAttribute('color', new T.Float32BufferAttribute(colors.flat(Infinity), 3));
    return out;
  }

  /** A closed 2D outline in the XZ plane, optionally extruded upward.
   *  Points are [x, z] pairs; the shape is laid flat and lifted to `y`. */
  function slab(parent, points, y, color, extrude) {
    extrude = extrude || 0;
    var s = new T.Shape();
    points.forEach(function (p, i) {
      if (i) s.lineTo(p[0], -p[1]);
      else s.moveTo(p[0], -p[1]);
    });
    s.closePath();
    var g = extrude
      ? new T.ExtrudeGeometry(s, { depth: extrude, bevelEnabled: false, steps: 1 })
      : new T.ShapeGeometry(s);
    g.rotateX(-Math.PI / 2);
    return mesh(parent, g, color, 0, y - extrude, 0);
  }

  /** Sweep a variable-width ribbon along a 3D polyline — used for streams,
   *  banners, sand ripples and lava flows. */
  function ribbon(parent, points, widths, color) {
    var verts = [];
    var faces = [];
    for (var i = 0; i < points.length; i++) {
      var prev = points[Math.max(0, i - 1)];
      var next = points[Math.min(points.length - 1, i + 1)];
      var dx = next[0] - prev[0];
      var dz = next[2] - prev[2];
      var len = Math.hypot(dx, dz) || 1;
      var nx = -dz / len;
      var nz = dx / len;
      var w = (Array.isArray(widths) ? widths[i] : widths) * 0.5;
      verts.push([points[i][0] - nx * w, points[i][1], points[i][2] - nz * w]);
      verts.push([points[i][0] + nx * w, points[i][1], points[i][2] + nz * w]);
      if (i) faces.push([i * 2 - 2, i * 2 - 1, i * 2], [i * 2 - 1, i * 2 + 1, i * 2]);
    }
    var m = new T.Mesh(poly(verts, faces), mat(color, { side: T.DoubleSide }));
    m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }

  /* --- geometry merging ---------------------------------------------------- */

  /* A compact stand-in for BufferGeometryUtils.mergeGeometries: every input is
   * already non-indexed with matching attributes, so this is a straight concat. */
  function mergeGeometries(geometries) {
    if (!geometries.length) return null;
    var names = Object.keys(geometries[0].attributes);
    var total = 0;
    for (var i = 0; i < geometries.length; i++) {
      var g = geometries[i];
      if (g.index) return null;
      for (var n = 0; n < names.length; n++) if (!g.attributes[names[n]]) return null;
      total += g.attributes.position.count;
    }
    var out = new T.BufferGeometry();
    for (var k = 0; k < names.length; k++) {
      var name = names[k];
      var size = geometries[0].attributes[name].itemSize;
      var data = new Float32Array(total * size);
      var offset = 0;
      for (var j = 0; j < geometries.length; j++) {
        data.set(geometries[j].attributes[name].array, offset);
        offset += geometries[j].attributes[name].count * size;
      }
      out.setAttribute(name, new T.BufferAttribute(data, size));
    }
    return out;
  }

  /* --- bake ---------------------------------------------------------------- */

  /**
   * Flatten a prop (or the whole world) into as few draw calls as possible.
   *
   * Every static, opaque, single-material mesh under `root` has its world
   * transform folded into its vertices; its flat material colour is folded into
   * a vertex-colour attribute so that meshes of *different* colours can still
   * merge; and the survivors are concatenated into one geometry per
   * (material, shadow-flags) bucket.
   *
   * Anything marked userData.dynamic — and its whole subtree — is skipped, so
   * animated parts keep their own transforms.
   *
   * @param {THREE.Object3D} root
   * @param {boolean} keepRootLive  treat `root` itself as static even if it is
   *                                flagged dynamic (used when a prop's root is
   *                                the thing being animated).
   */
  function bake(root, keepRootLive) {
    root.updateMatrixWorld(true);
    var toLocal = new T.Matrix4().copy(root.matrixWorld).invert();
    var buckets = new Map();
    var consumed = [];

    function walk(node, inheritedDynamic) {
      var isDynamic =
        inheritedDynamic || (node.userData.dynamic && !(keepRootLive && node === root));

      if (
        node.isMesh &&
        !isDynamic &&
        !node.isInstancedMesh &&
        !Array.isArray(node.material) &&
        !node.material.transparent
      ) {
        var geo = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
        geo.applyMatrix4(new T.Matrix4().multiplyMatrices(toLocal, node.matrixWorld));
        geo.deleteAttribute('uv');
        if (!geo.attributes.normal) geo.computeVertexNormals();

        var material = node.material;
        /* Plain untextured standard materials can be colour-folded, which is
         * what lets a hundred differently-coloured meshes become one mesh. */
        if (
          material.isMeshStandardMaterial &&
          !material.map && !material.normalMap && !material.roughnessMap &&
          !material.metalnessMap && !material.alphaMap && !material.emissiveMap &&
          material.emissive.getHex() === 0 && material.alphaTest === 0 && !material.wireframe
        ) {
          var count = geo.getAttribute('position').count;
          var src = material.vertexColors ? geo.getAttribute('color') : null;
          var colors = new Float32Array(count * 3);
          for (var i = 0; i < count; i++) {
            colors[i * 3] = (src ? src.getX(i) : 1) * material.color.r;
            colors[i * 3 + 1] = (src ? src.getY(i) : 1) * material.color.g;
            colors[i * 3 + 2] = (src ? src.getZ(i) : 1) * material.color.b;
          }
          geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
          material = mat('#ffffff', {
            vertexColors: true,
            roughness: material.roughness,
            metalness: material.metalness,
            side: material.side,
            flatShading: material.flatShading,
          });
        }

        var key = material.uuid + '|' + node.castShadow + '|' + node.receiveShadow;
        if (!buckets.has(key)) {
          buckets.set(key, {
            material: material,
            cast: node.castShadow,
            receive: node.receiveShadow,
            geometries: [],
          });
        }
        buckets.get(key).geometries.push(geo);
        consumed.push(node);
      }

      var kids = node.children.slice();
      for (var c = 0; c < kids.length; c++) walk(kids[c], isDynamic);
    }

    walk(root, false);
    for (var n = 0; n < consumed.length; n++) consumed[n].removeFromParent();

    buckets.forEach(function (bucket) {
      var merged = mergeGeometries(bucket.geometries);
      if (!merged) return;
      var m = new T.Mesh(merged, bucket.material);
      m.castShadow = bucket.cast;
      m.receiveShadow = bucket.receive;
      root.add(m);
      for (var g = 0; g < bucket.geometries.length; g++) bucket.geometries[g].dispose();
    });

    root.userData.baked = consumed.length;
    bake.totalMerged += consumed.length;
    bake.totalBatches += buckets.size;
    return root;
  }
  /* Running totals across the whole build — the only sensible way to answer
   * "how many meshes did we actually author?" once they have all been merged. */
  bake.totalMerged = 0;
  bake.totalBatches = 0;

  function countTriangles(root) {
    var n = 0;
    root.traverse(function (o) {
      if (o.isMesh) {
        var g = o.geometry;
        n += ((g.index ? g.index.count : g.attributes.position.count) / 3) * (o.count || 1);
      }
    });
    return Math.round(n);
  }

  TW.core = {
    TAU: TAU, DEG: DEG, clamp: clamp, lerp: lerp, smoothstep: smoothstep, damp: damp,
    rand: rand, reseed: reseed, makeRandom: makeRandom,
    mat: mat, dyn: dyn, tickAll: tickAll, tickers: tickers,
    group: group, pivot: pivot, mesh: mesh, box: box, rock: rock, cone: cone,
    tube: tube, torus: torus, sphere: sphere, link: link, beam: beam,
    poly: poly, slab: slab, ribbon: ribbon,
    mergeGeometries: mergeGeometries, bake: bake, countTriangles: countTriangles,
    UNIT_BOX: UNIT_BOX, UNIT_ICO0: UNIT_ICO0, UNIT_ICO1: UNIT_ICO1,
  };
})(typeof window !== 'undefined' ? window : this);
