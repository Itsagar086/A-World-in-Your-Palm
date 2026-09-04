/* =============================================================================
 * Tiny World — 50-walker.js
 * Walking on a sphere.
 *
 * The explorer has no (x, y, z) position. It has a unit normal — the direction
 * from the planet's centre to its feet — and a forward tangent. Moving is
 * rotating the normal along a great circle; turning is rotating the forward
 * vector about the normal. Height above the surface is looked up from the
 * terrain function, so the explorer is glued to the ground for free and there
 * is never a "fell through the world" bug to chase.
 *
 * Obstacles are spherical caps. Blocking is a dot product, sliding is a
 * projection, and "is the straight line between these two points clear?" is a
 * closed-form test — which is what makes A* over the whole planet cheap enough
 * to run inside a click handler.
 * ============================================================================= */
(function (global) {
  'use strict';

  var T = global.THREE;
  var TW = global.TW;
  var clamp = T.MathUtils.clamp;
  var damp = T.MathUtils.damp;

  /** How far the explorer's body is kept clear of an obstacle. */
  var BODY_CLEARANCE = 0.26;
  /** The wider margin used when planning a route, so paths are not razor thin. */
  var PLAN_CLEARANCE = 0.39;

  /* --- spherical helpers ---------------------------------------------------- */

  /** Great-circle distance in metres between two unit directions. */
  function arcLength(a, b, radius) {
    return Math.acos(clamp(a.dot(b), -1, 1)) * radius;
  }

  /** Project `v` into the tangent plane at `normal` and normalise it. */
  function tangent(v, normal) {
    return v.clone().addScaledVector(normal, -v.dot(normal)).normalize();
  }

  /** Advance `from` by `distance` metres along the great circle in `dir`. */
  function advance(from, dir, distance, radius) {
    if (distance === 0 || dir.lengthSq() < 1e-12) return from.clone();
    var t = tangent(dir, from);
    var a = distance / radius;
    return from.clone().multiplyScalar(Math.cos(a)).addScaledVector(t, Math.sin(a)).normalize();
  }

  /** Precompute cos/sin of each collider's angular radius at a given padding. */
  function buildCaps(colliders, radius, padding) {
    var caps = [];
    for (var i = 0; i < colliders.length; i++) {
      var a = (colliders[i].radius + padding) / radius;
      caps.push({ normal: colliders[i].normal, cos: Math.cos(a), sin: Math.sin(a) });
    }
    return caps;
  }

  /**
   * Is the shorter great-circle arc from `a` to `b` free of every cap?
   *
   * Along the arc, the dot product with a cap centre is
   *     f(t) = h·cos t + d·sin t  =  hypot(h, d) · cos(t - phi)
   * so the closest approach is a single atan2, with no marching.
   */
  function arcIsClear(a, b, caps) {
    var n = clamp(a.dot(b), -1, 1);
    if (n > 1 - 1e-12) {
      for (var z = 0; z < caps.length; z++) if (a.dot(caps[z].normal) > caps[z].cos + 1e-10) return false;
      return true;
    }
    if (n < -1 + 1e-10) return false; /* antipodal: the arc is undefined */

    var span = Math.acos(n);
    var sinSpan = Math.sqrt(Math.max(0, 1 - n * n));
    var halfCos = Math.sqrt((1 + n) / 2);
    var halfSin = Math.sqrt((1 - n) / 2);
    var midScale = 2 * halfCos;

    for (var i = 0; i < caps.length; i++) {
      var cap = caps[i];
      var h = a.dot(cap.normal);
      var u = b.dot(cap.normal);
      if (h > cap.cos + 1e-10 || u > cap.cos + 1e-10) return false; /* an endpoint is inside */
      /* Cheap reject: if the arc's midpoint is further than (capAngle + half
       * the arc) from the cap centre, nothing on the arc can reach it. */
      if ((h + u) / midScale < cap.cos * halfCos - cap.sin * halfSin) continue;
      var d = (u - h * n) / sinSpan;
      var phi = Math.atan2(d, h);
      if (phi > 0 && phi < span && Math.hypot(h, d) > cap.cos + 1e-10) return false;
    }
    return true;
  }

  /** Push a point out of any cap it has ended up inside. */
  function resolve(point, colliders, radius, padding) {
    if (padding === undefined) padding = BODY_CLEARANCE;
    var p = point.clone();
    for (var pass = 0; pass < 3; pass++) {
      for (var i = 0; i < colliders.length; i++) {
        var c = colliders[i];
        var angle = (c.radius + padding) / radius;
        var dot = clamp(p.dot(c.normal), -1, 1);
        if (dot < Math.cos(angle)) continue;
        /* Slide out along the tangent that points away from the centre. */
        var away = p.clone().addScaledVector(c.normal, -dot);
        if (away.lengthSq() < 1e-10) {
          away.crossVectors(c.normal, Math.abs(c.normal.y) < 0.9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0));
        }
        away.normalize();
        p.copy(c.normal).multiplyScalar(Math.cos(angle + 1e-5))
          .addScaledVector(away, Math.sin(angle + 1e-5)).normalize();
      }
    }
    return p;
  }

  /* --- priority queue -------------------------------------------------------- */

  function MinHeap() { this.items = []; }
  MinHeap.prototype.push = function (item) {
    var a = this.items;
    a.push(item);
    var i = a.length - 1;
    while (i > 0) {
      var parent = (i - 1) >> 1;
      if (a[parent].score <= item.score) break;
      a[i] = a[parent];
      i = parent;
    }
    a[i] = item;
  };
  MinHeap.prototype.pop = function () {
    var a = this.items;
    if (!a.length) return null;
    var top = a[0];
    var last = a.pop();
    if (a.length) {
      var i = 0;
      for (;;) {
        var child = i * 2 + 1;
        if (child >= a.length) break;
        if (child + 1 < a.length && a[child + 1].score < a[child].score) child++;
        if (a[child].score >= last.score) break;
        a[i] = a[child];
        i = child;
      }
      a[i] = last;
    }
    return top;
  };
  Object.defineProperty(MinHeap.prototype, 'size', {
    get: function () { return this.items.length; },
  });

  /* --- navigation graph ------------------------------------------------------- */

  /* A geodesic mesh over the whole globe, built once and cached. Nodes that sit
   * inside an obstacle are closed; edges between neighbours are kept only if
   * the arc between them is clear. This gives roughly 4 500 nodes for the whole
   * planet, which A* chews through in well under a millisecond. */
  var graphCache = new WeakMap();

  function navGraph(colliders, radius) {
    var cached = graphCache.get(colliders);
    if (cached && cached.radius === radius && cached.colliderCount === colliders.length) return cached;

    var planCaps = buildCaps(colliders, radius, PLAN_CLEARANCE);
    var bodyCaps = buildCaps(colliders, radius, BODY_CLEARANCE);

    var geo = new T.IcosahedronGeometry(1, 21);
    var pos = geo.getAttribute('position');
    var nodes = [];
    var byKey = new Map();
    var neighbours = [];
    var tri = [];

    for (var i = 0; i < pos.count; i++) {
      var v = new T.Vector3().fromBufferAttribute(pos, i).normalize();
      var key = [v.x, v.y, v.z].map(function (n) { return Math.round(n * 1e6); }).join(',');
      var id = byKey.get(key);
      if (id === undefined) {
        id = nodes.length;
        byKey.set(key, id);
        var open = true;
        for (var c = 0; c < planCaps.length; c++) {
          if (v.dot(planCaps[c].normal) >= planCaps[c].cos) { open = false; break; }
        }
        nodes.push({ normal: v, open: open, edges: [] });
        neighbours.push(new Set());
      }
      tri.push(id);
      if (tri.length === 3) {
        for (var e = 0; e < 3; e++) {
          var a = tri[e], b = tri[(e + 1) % 3];
          neighbours[a].add(b);
          neighbours[b].add(a);
        }
        tri.length = 0;
      }
    }
    geo.dispose();

    for (var n2 = 0; n2 < nodes.length; n2++) {
      var node = nodes[n2];
      if (!node.open) continue;
      neighbours[n2].forEach(function (other) {
        if (other < n2 || !nodes[other].open) return;
        if (!arcIsClear(node.normal, nodes[other].normal, planCaps)) return;
        var len = arcLength(node.normal, nodes[other].normal, radius);
        node.edges.push({ id: other, length: len });
        nodes[other].edges.push({ id: n2, length: len });
      });
    }

    var graph = {
      radius: radius,
      colliderCount: colliders.length,
      nodes: nodes,
      planCaps: planCaps,
      bodyCaps: bodyCaps,
    };
    graphCache.set(colliders, graph);
    return graph;
  }

  /** Up to ten graph nodes that are both near `point` and visible from it. */
  function portals(point, graph) {
    var ranked = [];
    for (var i = 0; i < graph.nodes.length; i++) {
      var node = graph.nodes[i];
      if (!node.open || !node.edges.length) continue;
      ranked.push({ id: i, cosine: point.dot(node.normal) });
    }
    ranked.sort(function (a, b) { return b.cosine - a.cosine; });

    var out = [];
    var limit = Math.min(192, ranked.length);
    for (var r = 0; r < limit; r++) {
      var candidate = ranked[r];
      if (!arcIsClear(point, graph.nodes[candidate.id].normal, graph.bodyCaps)) continue;
      out.push({ id: candidate.id, length: Math.acos(clamp(candidate.cosine, -1, 1)) * graph.radius });
      if (out.length >= 10) break;
    }
    return out;
  }

  /**
   * Plan a route from `from` to `to`. Returns an array of waypoints (unit
   * normals), or null if nothing connects. If the destination is already in
   * plain sight, the route is just the destination.
   */
  function findRoute(from, to, colliders, radius) {
    if (arcIsClear(from, to, buildCaps(colliders, radius, BODY_CLEARANCE))) return [to.clone()];

    var graph = navGraph(colliders, radius);
    var starts = portals(from, graph);
    var goals = portals(to, graph);
    if (!starts.length || !goals.length) return null;

    var count = graph.nodes.length;
    var GOAL = count; /* a virtual node standing for the destination */
    var goalCost = new Map();
    for (var g = 0; g < goals.length; g++) goalCost.set(goals[g].id, goals[g].length);

    var dist = new Float64Array(count + 1);
    dist.fill(Infinity);
    var from2 = new Int32Array(count + 1);
    from2.fill(-1);
    var done = new Uint8Array(count + 1);
    var open = new MinHeap();

    var heuristic = function (id) {
      return id === GOAL ? 0 : arcLength(graph.nodes[id].normal, to, radius);
    };

    for (var s = 0; s < starts.length; s++) {
      dist[starts[s].id] = starts[s].length;
      open.push({ id: starts[s].id, score: starts[s].length + heuristic(starts[s].id) });
    }

    var reached = false;
    while (open.size) {
      var current = open.pop().id;
      if (done[current]) continue;
      if (current === GOAL) { reached = true; break; }
      done[current] = 1;

      var relax = function (id, cost) {
        if (done[id]) return;
        var next = dist[current] + cost;
        if (next >= dist[id]) return;
        dist[id] = next;
        from2[id] = current;
        open.push({ id: id, score: next + heuristic(id) });
      };

      var edges = graph.nodes[current].edges;
      for (var e = 0; e < edges.length; e++) relax(edges[e].id, edges[e].length);
      if (goalCost.has(current)) relax(GOAL, goalCost.get(current));
    }
    if (!reached) return null;

    /* Walk the parent chain back to the start. */
    var chain = [];
    var node = from2[GOAL];
    while (node >= 0) {
      chain.push(graph.nodes[node].normal);
      node = from2[node];
    }
    chain.reverse();
    chain.push(to);

    /* String-pull: from each anchor, skip to the furthest waypoint still in
     * clear line of sight. Turns a staircase of graph hops into a few long,
     * natural-looking legs. */
    var route = [];
    var anchor = from;
    var i2 = 0;
    while (i2 < chain.length) {
      var best = i2;
      for (var j = chain.length - 1; j > i2; j--) {
        var caps = route.length === 0 || j === chain.length - 1 ? graph.bodyCaps : graph.planCaps;
        if (arcIsClear(anchor, chain[j], caps)) { best = j; break; }
      }
      route.push(chain[best].clone());
      anchor = chain[best];
      i2 = best + 1;
    }
    return route;
  }

  /* --- the walker ------------------------------------------------------------ */

  /**
   * @param {object} opts
   * @param {number} opts.radius        planet radius
   * @param {THREE.Vector3} opts.start  spawn normal
   * @param {Array}  opts.colliders
   * @param {function} opts.surfaceRadius
   * @param {function} opts.isWater
   */
  function Walker(opts) {
    this.radius = opts.radius;
    this.normal = opts.start.clone().normalize();
    this.spawn = this.normal.clone();
    this.colliders = opts.colliders || [];
    this.surfaceRadius = opts.surfaceRadius || function () { return opts.radius; };
    this.isWater = opts.isWater || function () { return false; };

    this.forward = tangent(new T.Vector3(0, -1, 0), this.normal);
    if (this.forward.lengthSq() < 0.1) this.forward = tangent(new T.Vector3(0, 0, 1), this.normal);
    this._travel = this.forward.clone();

    this.speed = 0;
    this.distance = 0;
    this.height = 0;
    this.verticalSpeed = 0;
    this.target = null;
    this.targetId = null;
    this.arrived = null;
    this.swimming = this.isWater(this.normal);
    this.running = false;

    this._avoidSide = 1;
    this._avoidId = -1;
    this._stuck = 0;
    this._route = null;
    this._waypoint = 0;

    this.walkSpeed = 2.6;
    this.runSpeed = 4.7;
    this.swimSpeed = 2.9;
    this.jumpSpeed = 5.6;
    this.gravity = 15;
  }

  Walker.prototype.destination = function (target, id) {
    this.target = resolve(target.clone().normalize(), this.colliders, this.radius);
    this.targetId = id || null;
    this.arrived = null;
    this._stuck = 0;
    this._avoidId = -1;
    this._route = findRoute(this.normal, this.target, this.colliders, this.radius);
    this._waypoint = 0;
  };

  Walker.prototype.stop = function () {
    this.target = null;
    this.targetId = null;
    this.speed = 0;
    this.arrived = null;
    this._route = null;
    this._waypoint = 0;
  };

  Walker.prototype.reset = function () {
    var q = new T.Quaternion().setFromUnitVectors(this.normal, this.spawn);
    this.forward.applyQuaternion(q);
    this._travel.applyQuaternion(q);
    this.normal.copy(this.spawn);
    this.height = 0;
    this.verticalSpeed = 0;
    this.stop();
    this.swimming = this.isWater(this.normal);
  };

  Walker.prototype.jump = function () {
    if (this.height < 0.005 && !this.swimming) {
      this.verticalSpeed = this.jumpSpeed;
      return true;
    }
    return false;
  };

  /** Steering toward the current target, following the route if there is one
   *  and improvising a dodge if there is not. */
  Walker.prototype._steer = function () {
    if (this._route && this._route.length) {
      while (this._waypoint < this._route.length - 1 &&
             arcLength(this.normal, this._route[this._waypoint], this.radius) < 0.13) {
        this._waypoint++;
      }
      return tangent(this._route[this._waypoint], this.normal);
    }

    var toward = tangent(this.target, this.normal);
    var remaining = arcLength(this.normal, this.target, this.radius);
    if (toward.lengthSq() < 0.01) toward.copy(this.forward);

    /* Find the nearest obstacle that is actually in the way. */
    var threat = null;
    var closest = Infinity;
    for (var i = 0; i < this.colliders.length; i++) {
      var c = this.colliders[i];
      var d = arcLength(this.normal, c.normal, this.radius);
      if (d > c.radius + 3 || d > remaining + 0.2) continue;
      var dir = tangent(c.normal, this.normal);
      var ahead = dir.dot(toward);
      if (ahead < 0.22) continue;
      var lateral = d * Math.sqrt(Math.max(0, 1 - ahead * ahead));
      if (lateral < c.radius + 0.7 && d - c.radius < closest) {
        threat = { collider: c, index: i, dir: dir, distance: d };
        closest = d - c.radius;
      }
    }

    if (threat) {
      /* Commit to one side per obstacle so we never dither in front of a tree. */
      if (this._avoidId !== threat.index) {
        var cross = new T.Vector3().crossVectors(this.normal, threat.dir);
        var side = toward.dot(cross);
        this._avoidSide = Math.abs(side) > 0.02 ? Math.sign(side) : 1;
        this._avoidId = threat.index;
      }
      var slide = new T.Vector3().crossVectors(this.normal, threat.dir).multiplyScalar(this._avoidSide);
      var urgency = clamp((threat.collider.radius + 2.5 - threat.distance) / 2.3, 0, 1);
      toward.addScaledVector(slide, 0.7 + urgency * 1.5).addScaledVector(threat.dir, -urgency).normalize();
    } else {
      this._avoidId = -1;
    }
    return toward;
  };

  /**
   * @param {number} dt
   * @param {object} input  { x, y, forward, right, running }
   * @returns {{moved:number, arrived:string|null}}
   */
  Walker.prototype.update = function (dt, input) {
    input = input || {};
    dt = clamp(dt, 0, 0.05);
    this.arrived = null;

    var ix = input.x || 0;
    var iy = input.y || 0;
    var fwd = input.forward || this.forward;
    var right = input.right || new T.Vector3().crossVectors(this.normal, fwd);

    var desired = new T.Vector3();
    var manual = Math.hypot(ix, iy) > 0.045;

    if (manual) {
      /* Any manual input cancels an auto-walk. */
      this.target = null;
      this.targetId = null;
      this._route = null;
      this._waypoint = 0;
      desired.addScaledVector(right, ix).addScaledVector(fwd, iy);
      desired = tangent(desired, this.normal);
    } else if (this.target) {
      var reach = this.targetId ? 0.72 : 0.28;
      if (arcLength(this.normal, this.target, this.radius) < reach) {
        this.arrived = this.targetId || 'ground';
        this.target = null;
        this.targetId = null;
        this._route = null;
        this._waypoint = 0;
      } else {
        desired = this._steer();
      }
    }

    this.swimming = this.isWater(this.normal);
    this.running = !!input.running || (!manual && !!this.target);

    var throttle = manual ? Math.min(1, Math.hypot(ix, iy)) : 1;
    var wants = desired.lengthSq() > 0.2;
    var top = wants
      ? (this.swimming ? this.swimSpeed : this.running ? this.runSpeed : this.walkSpeed) * throttle
      : 0;
    this.speed = damp(this.speed, top, top > 0 ? 12 : 17, dt);
    if (this.speed < 0.015) this.speed = 0;
    if (wants) this._travel.copy(desired);
    else desired.copy(this._travel);

    var before = this.normal.clone();
    if (this.speed > 0) {
      var next = advance(this.normal, desired, this.speed * dt, this.radius);
      next = resolve(next, this.colliders, this.radius);
      var moved = arcLength(this.normal, next, this.radius);
      this.distance += moved;
      this.normal.copy(next);

      /* Parallel-transport the facing vectors along the move so they stay
       * tangent without drifting. */
      var carry = new T.Quaternion().setFromUnitVectors(before, this.normal);
      this.forward.applyQuaternion(carry);
      this._travel.applyQuaternion(carry);
      desired.applyQuaternion(carry);

      /* Turn toward the direction of travel with an exponential ease. */
      var turn = Math.atan2(
        new T.Vector3().crossVectors(this.forward, desired).dot(this.normal),
        clamp(this.forward.dot(desired), -1, 1)
      );
      this.forward.applyAxisAngle(this.normal, turn * (1 - Math.exp(-dt * 14)));
      this.forward = tangent(this.forward, this.normal);

      /* If an auto-walk stops making progress, flip the dodge side. */
      this._stuck = this.target && moved < dt * 0.14
        ? this._stuck + dt
        : Math.max(0, this._stuck - dt * 2);
      if (this._stuck > 0.75) {
        this._avoidSide *= -1;
        this._stuck = 0;
      }
    }

    if (this.height > 0 || this.verticalSpeed > 0) {
      this.verticalSpeed -= this.gravity * dt;
      this.height = Math.max(0, this.height + this.verticalSpeed * dt);
      if (this.height === 0) this.verticalSpeed = 0;
    }
    if (this.swimming) {
      this.height = 0;
      this.verticalSpeed = 0;
    }

    return { moved: arcLength(before, this.normal, this.radius), arrived: this.arrived };
  };

  Object.defineProperty(Walker.prototype, 'position', {
    get: function () {
      return this.normal.clone().multiplyScalar(this.surfaceRadius(this.normal) + this.height);
    },
  });

  Object.defineProperty(Walker.prototype, 'quaternion', {
    get: function () {
      var right = new T.Vector3().crossVectors(this.normal, this.forward).normalize();
      return new T.Quaternion().setFromRotationMatrix(
        new T.Matrix4().makeBasis(right, this.normal, this.forward)
      );
    },
  });

  TW.walk = {
    Walker: Walker,
    arcLength: arcLength,
    tangent: tangent,
    advance: advance,
    resolve: resolve,
    arcIsClear: arcIsClear,
    buildCaps: buildCaps,
    findRoute: findRoute,
    BODY_CLEARANCE: BODY_CLEARANCE,
    PLAN_CLEARANCE: PLAN_CLEARANCE,
  };
})(typeof window !== 'undefined' ? window : this);
