/* Every 3D object that isn't a person: fish and sea creatures, buildings, boats and trees.
   All of it is built from code with generated textures, so the game needs no image files. */
(function () {
  const G = CTC.game, L = CTC.LAYOUT, St = CTC.stage;
  const M = (CTC.models = {});
  const TAU = Math.PI * 2;
  const seeded = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
  M.seeded = seeded;

  /* ---------- generated textures ---------- */
  function canvasTex(w, h, draw, repeat) {
    const el = document.createElement("canvas");
    el.width = w;
    el.height = h;
    draw(el.getContext("2d"), w, h);
    const tex = new THREE.CanvasTexture(el);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); }
    return tex;
  }
  const woodTex = (base, dark, rep) => canvasTex(256, 256, (c, w, h) => {
    const r = seeded(77);
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      c.strokeStyle = dark;
      c.globalAlpha = 0.05 + r() * 0.16;
      c.lineWidth = 0.5 + r() * 1.8;
      const y = r() * h;
      c.beginPath();
      c.moveTo(0, y);
      c.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 12, w * 0.7, y + (r() - 0.5) * 12, w, y);
      c.stroke();
    }
    c.globalAlpha = 0.55;
    c.fillStyle = dark;
    for (let i = 0; i < 4; i++) c.fillRect(0, (i * h) / 4, w, 2.5);
    c.globalAlpha = 1;
  }, rep);
  const roughTex = (colors, rep, blot) => canvasTex(256, 256, (c, w, h) => {
    const r = seeded(31);
    c.fillStyle = colors[0];
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      c.fillStyle = colors[1 + Math.floor(r() * (colors.length - 1))];
      c.globalAlpha = 0.08 + r() * 0.25;
      c.beginPath();
      c.ellipse(r() * w, r() * h, r() * (blot || 5) + 0.6, r() * (blot || 5) * 0.6 + 0.6, r() * 3, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }, rep);
  const bricks = (base, line, rep) => canvasTex(256, 256, (c, w, h) => {
    const r = seeded(9);
    c.fillStyle = line;
    c.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < 5; col++) {
        c.fillStyle = base;
        c.globalAlpha = 0.72 + r() * 0.28;
        c.fillRect(col * 64 + (row % 2) * 32 + 2, row * 32 + 2, 60, 28);
      }
    }
    c.globalAlpha = 1;
  }, rep);
  const stripes = (a, b, n) => canvasTex(512, 64, (c, w, h) => {
    for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? b : a; c.fillRect((i * w) / n, 0, w / n + 1, h); }
    const r = seeded(5);
    for (let i = 0; i < 500; i++) { c.fillStyle = "rgba(0,0,0," + r() * 0.04 + ")"; c.fillRect(r() * w, r() * h, 2, 18); }
  });

  function signTex(text, bg, fg, border) {
    return canvasTex(512, 128, (c, w, h) => {
      c.fillStyle = bg;
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { c.fillStyle = "rgba(255,255,255," + Math.random() * 0.04 + ")"; c.fillRect(0, Math.random() * h, w, 1 + Math.random() * 3); }
      if (border) { c.strokeStyle = border; c.lineWidth = 10; c.strokeRect(8, 8, w - 16, h - 16); }
      c.fillStyle = fg;
      c.font = "900 " + (text.length > 10 ? 58 : 72) + "px Georgia, serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(text, w / 2, h / 2 + 4, w - 40);
    });
  }

  let mats = null;
  function materials() {
    if (mats) return mats;
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0 }, o));
    mats = {
      wood: std({ map: woodTex("#a9713a", "#4f2f14") }), woodDark: std({ map: woodTex("#6e4426", "#2d1a0c") }),
      plank: std({ map: woodTex("#b9834c", "#5c3a1c", [1, 2]) }), weathered: std({ map: woodTex("#8d7a63", "#463a2c", [2, 2]) }),
      ice: std({ color: "#e4f6ff", roughness: 0.25, metalness: 0.1 }), iron: std({ color: "#3a4552", metalness: 0.75, roughness: 0.45 }),
      steel: std({ color: "#aab7c2", metalness: 0.8, roughness: 0.35 }),
      stone: std({ map: roughTex(["#8d939a", "#6c7178", "#a6acb3", "#55595f"], null, 9), roughness: 1 }),
      brick: std({ map: bricks("#a8452f", "#6b5a4c", [3, 2]) }), plaster: std({ map: roughTex(["#fff1dc", "#e7d6bb", "#f8e8d0"], [2, 2]) }),
      stucco: std({ map: roughTex(["#ecd2a4", "#d9bd8c", "#f4dcb2"], [3, 3]) }), roof: std({ map: bricks("#b5452f", "#5c2a1c", [5, 3]) }),
      slate: std({ map: bricks("#5a6470", "#2e343b", [4, 3]) }), rope: std({ color: "#d9c7a0", roughness: 1 }),
      glass: std({ color: "#93bfd6", roughness: 0.1, metalness: 0.65 }), lit: std({ color: "#ffe9a3", emissive: "#ffcb6b", emissiveIntensity: 0.7 }),
      ash: std({ color: "#2a2522", roughness: 1 }), plate: std({ color: "#f4f1ea", roughness: 0.3 }),
      bark: std({ map: roughTex(["#7a5a3a", "#4f3822", "#94754f"], [1, 3], 7), roughness: 1 }), barkPine: std({ map: roughTex(["#5b4330", "#37281c", "#6e5540"], [1, 3], 7), roughness: 1 })
    };
    return mats;
  }

  // Phones: small parts stop casting shadows, which are drawn in a second pass.
  const SMALL_PART = 14;
  const partScale = new THREE.Vector3();
  M.trimShadows = function (root) {
    if (!St.low) return;
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if (!o.isMesh || !o.castShadow || o.isInstancedMesh) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      o.getWorldScale(partScale);
      if (o.geometry.boundingSphere.radius * Math.max(partScale.x, partScale.y, partScale.z) < SMALL_PART) o.castShadow = false;
    });
  };

  /* ---------- small building helpers ---------- */
  function box(parent, w, h, d, mat, x, y, z, ry) {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x || 0, (y || 0) + h / 2, z || 0);
    if (ry) m.rotation.y = ry;
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function cyl(parent, r0, r1, h, mat, x, y, z, seg) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg || 10), mat);
    m.position.set(x || 0, (y || 0) + h / 2, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function beam(parent, a, b, r, mat) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.sub(A).normalize());
    m.castShadow = true;
    parent.add(m);
    return m;
  }
  function plane(parent, w, h, mat, x, y, z, rx, ry) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    parent.add(m);
    return m;
  }
  function sign(parent, text, bg, fg, w, h, x, y, z, border) {
    const tex = signTex(text, bg, fg, border);
    box(parent, w + 5, h + 5, 3, materials().woodDark, x, y - 2.5, z - 2);
    const m = plane(parent, w, h, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), x, y + h / 2, z);
    m.castShadow = false;
    return m;
  }

  // A striped canvas awning sloping toward the customers, with a scalloped front edge.
  function awning(parent, w, depth, drop, x, y, z, tex) {
    const g = new THREE.PlaneGeometry(w, depth, 24, 6);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / w + 0.5, v = pos.getY(i) / depth + 0.5;
      pos.setXYZ(i, pos.getX(i), y - (1 - v) * drop + Math.sin(u * 60) * 0.3 * (1 - v), z + (0.5 - v) * depth);
    }
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide });
    const top = new THREE.Mesh(g, mat);
    top.castShadow = true;
    parent.add(top);
    const n = 12, sw = w / n, parts = [];
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(sw, 0); shape.absarc(sw / 2, 0, sw / 2, 0, Math.PI, true);
    for (let i = 0; i < n; i++) {
      const sg = new THREE.ShapeGeometry(shape, 8), uv = sg.attributes.uv, sp = sg.attributes.position;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (i + sp.getX(k) / sw) / n, 0.5);
      sg.translate(-w / 2 + i * sw, y - drop, z + depth / 2);
      parts.push(sg);
    }
    parent.add(new THREE.Mesh(THREE.mergeGeometries(parts), mat));
  }

  // Merges a group's unmoving meshes, one mesh per material. Far fewer draw calls, same picture.
  M.bake = function (group) {
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const byMat = new Map(), old = [];
    group.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      Object.keys(g.attributes).forEach((k) => { if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k); });
      if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!byMat.has(o.material)) byMat.set(o.material, []);
      byMat.get(o.material).push(g);
      old.push(o);
    });
    old.forEach((o) => { o.removeFromParent(); o.geometry.dispose(); });
    byMat.forEach((list, mat) => {
      const m = new THREE.Mesh(THREE.mergeGeometries(list), mat);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    });
    return group;
  };

  /* ---------- fish, the same mesh for every species ---------- */
  function fishGeometry() {
    const parts = [];
    const SEG = 18, RING = 10;
    const pos = [], part = [], idx = [];
    const profile = (u) => { // u 0 at the tail, 1 at the nose
      const h = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.72)), 0.75);
      return Math.max(0.05, h);
    };
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG, x = -13 + u * 28, hh = profile(u) * 7.6, ww = profile(u) * 3.6;
      for (let j = 0; j < RING; j++) {
        const a = (j / RING) * TAU;
        pos.push(x, Math.sin(a) * hh, Math.cos(a) * ww);
        part.push(0);
      }
    }
    for (let i = 0; i < SEG; i++) for (let j = 0; j < RING; j++) {
      const a = i * RING + j, b = i * RING + ((j + 1) % RING), c = a + RING, d = b + RING;
      idx.push(a, c, b, b, c, d);
    }
    const body = new THREE.BufferGeometry();
    body.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    body.setAttribute("aPart", new THREE.Float32BufferAttribute(part, 1));
    body.setIndex(idx);
    body.computeVertexNormals();
    parts.push(body);
    const fin = (shape, z) => {
      const g = new THREE.ShapeGeometry(shape, 6);
      g.translate(0, 0, z || 0);
      g.deleteAttribute("uv");
      g.setAttribute("aPart", new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(1), 1));
      return g;
    };
    const tail = new THREE.Shape();
    tail.moveTo(-12, 0); tail.quadraticCurveTo(-19, 2, -24, 9); tail.quadraticCurveTo(-20, 0, -24, -9); tail.quadraticCurveTo(-19, -2, -12, 0);
    parts.push(fin(tail));
    const dorsal = new THREE.Shape();
    dorsal.moveTo(-7, 5.5); dorsal.quadraticCurveTo(-2, 13, 7, 6.5); dorsal.closePath();
    parts.push(fin(dorsal));
    const belly = new THREE.Shape();
    belly.moveTo(-6, -5.5); belly.quadraticCurveTo(-2, -10, 3, -6.5); belly.closePath();
    parts.push(fin(belly));
    const pect = new THREE.Shape();
    pect.moveTo(4, -1); pect.quadraticCurveTo(-2, -4, -3, -6); pect.quadraticCurveTo(3, -6, 6, -2.5); pect.closePath();
    [1, -1].forEach((d) => { const g = fin(pect, d * 3.7); g.rotateY(d * 0.2); parts.push(g); });
    [1, -1].forEach((d) => {
      const g = new THREE.SphereGeometry(1.25, 8, 6);
      g.translate(9.3, 1.4, d * 2.7);
      g.deleteAttribute("uv");
      g.setAttribute("aPart", new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill(2), 1));
      parts.push(g);
    });
    parts.forEach((g) => { if (g.index) { const n = g.toNonIndexed(); g.copy(n); } });
    const merged = THREE.mergeGeometries(parts);
    merged.computeVertexNormals();
    return merged;
  }

  /* ---------- banks: many copies of one mesh, refilled each frame ---------- */
  const dummy = new THREE.Object3D();
  class Bank {
    constructor(geo, mat, cap, shadow) {
      this.mesh = new THREE.InstancedMesh(geo, mat, cap);
      this.mesh.frustumCulled = false;
      this.mesh.castShadow = !!shadow && !St.low;
      this.cap = cap;
      this.n = 0;
      St.scene.add(this.mesh);
    }
    begin() { this.n = 0; }
    add(x, y, z, yaw, s, pitch, roll) {
      if (this.n >= this.cap) return -1;
      dummy.position.set(x, y, z);
      dummy.rotation.set(pitch || 0, yaw || 0, roll || 0, "YXZ");
      dummy.scale.setScalar(s === undefined ? 1 : s);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(this.n, dummy.matrix);
      return this.n++;
    }
    end() {
      this.mesh.count = this.n;
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  class FishBank extends Bank {
    constructor(cap) {
      const geo = fishGeometry();
      const inst = (n) => new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n);
      const body = inst(3), belly = inst(3), fin = inst(3), misc = inst(2);
      [["iBody", body], ["iBelly", belly], ["iFin", fin], ["iMisc", misc]].forEach(([k, a]) => { a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, a); });
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.34, metalness: 0.22, side: THREE.DoubleSide });
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", `#include <common>
            attribute float aPart; attribute vec3 iBody, iBelly, iFin; attribute vec2 iMisc;
            varying vec3 vFishCol; varying vec3 vL;`)
          .replace("#include <begin_vertex>", `#include <begin_vertex>
            float tailward = clamp((6.0 - position.x) / 30.0, 0.0, 1.0);
            transformed.z += sin(iMisc.x - position.x * 0.2) * tailward * tailward * 9.0;
            vL = position;
            float under = smoothstep(0.5, -2.8, position.y);
            vFishCol = aPart > 1.5 ? vec3(0.015) : aPart > 0.5 ? iFin : mix(iBody, iBelly, under);`);
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vFishCol; varying vec3 vL;")
          .replace("#include <color_fragment>", `#include <color_fragment>
            float scales = sin(vL.x * 3.2 + sin(vL.y * 3.0) * 1.2) * 0.5 + 0.5;
            diffuseColor.rgb = vFishCol * (0.86 + scales * 0.2);`);
      };
      super(geo, mat, cap, true);
      Object.assign(this, { body, belly, fin, misc, c: new THREE.Color() });
    }
    // def holds the three colours; cooked fish use the browned colours from Art.cookedDef.
    put(def, x, y, z, yaw, s, wig, pitch, roll) {
      const i = this.add(x, y, z, yaw, s, pitch, roll);
      if (i < 0) return;
      const set = (a, hex) => { this.c.set(hex); a.setXYZ(i, this.c.r, this.c.g, this.c.b); };
      set(this.body, def.body);
      set(this.belly, def.belly);
      set(this.fin, def.fin);
      this.misc.setXY(i, wig || 0, 0);
    }
    end() {
      super.end();
      this.body.needsUpdate = this.belly.needsUpdate = this.fin.needsUpdate = this.misc.needsUpdate = true;
    }
  }

  /* ---------- sea creatures ---------- */
  function paint(geo, hex) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const c = new THREE.Color(hex), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.deleteAttribute("uv");
    return g;
  }
  function tube(points, r, hex) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return paint(new THREE.TubeGeometry(curve, 12, r, 6), hex);
  }
  function ball(r, sx, sy, sz, x, y, z, hex) {
    const g = new THREE.SphereGeometry(r, 12, 9);
    g.scale(sx, sy, sz);
    g.translate(x, y, z);
    return paint(g, hex);
  }
  const eyesAt = (x, y, z, r) => [ball(r, 1, 1, 1, x, y, z, "#0b0f14"), ball(r, 1, 1, 1, x, y, -z, "#0b0f14")];
  function creatureGeo(kind, C) {
    const a = C.color, b = C.dark;
    const parts = [];
    if (kind === "prawn") {
      parts.push(tube([[-13, 1, 0], [-9, 6, 0], [-1, 8, 0], [8, 6, 0], [13, 2, 0]], 3.3, a));
      for (let i = 0; i < 5; i++) [1, -1].forEach((d) => parts.push(tube([[-6 + i * 3.4, 3, d * 2], [-7 + i * 3.4, -1, d * 4], [-8 + i * 3.4, -3, d * 5]], 0.45, b)));
      [1, -1].forEach((d) => parts.push(tube([[12, 4, d], [18, 8, d * 3], [24, 5, d * 5]], 0.3, b)));
      parts.push(...eyesAt(12, 5, 2, 0.9));
    } else if (kind === "starfish") {
      for (let i = 0; i < 5; i++) {
        const an = (i / 5) * TAU, ax = Math.cos(an), az = Math.sin(an);
        parts.push(tube([[0, 2, 0], [ax * 8, 1.6, az * 8], [ax * 16, 0.6, az * 16]], 2.6, a));
      }
      parts.push(ball(5, 1, 0.5, 1, 0, 2, 0, b));
    } else if (kind === "jellyfish") {
      const dome = new THREE.SphereGeometry(13, 16, 8, 0, TAU, 0, Math.PI / 2);
      dome.scale(1, 0.75, 1);
      parts.push(paint(dome, a));
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * TAU, x = Math.cos(an) * 8, z = Math.sin(an) * 8;
        parts.push(tube([[x, 0, z], [x * 1.15 + 1.5, -8, z * 1.15], [x * 0.9 - 1.5, -15, z * 0.9], [x, -22, z]], 0.8, b));
      }
    } else if (kind === "squid") {
      parts.push(ball(1, 16, 6.6, 6.6, 6, 0, 0, a));
      [1, -1].forEach((d) => { const f = new THREE.ConeGeometry(6, 13, 4); f.rotateZ(-Math.PI / 2); f.scale(1, 0.25, 1); f.translate(20, 0, d * 3); parts.push(paint(f, b)); });
      for (let i = 0; i < 6; i++) {
        const z = -5 + i * 2;
        parts.push(tube([[-8, 0, z * 0.6], [-16, (i % 2) * 2 - 1, z], [-27, 1 - (i % 3), z * 1.5]], 0.85, b));
      }
      parts.push(...eyesAt(-5, 3, 5, 1.5));
    } else if (kind === "lobster") {
      parts.push(ball(1, 12, 5.6, 6.2, 2, 2, 0, a));
      for (let i = 0; i < 4; i++) parts.push(ball(1, 3.2, 3.8 - i * 0.3, 5.3 - i * 0.5, -10 - i * 3.6, 2, 0, i % 2 ? b : a));
      const tailFan = new THREE.ConeGeometry(6, 8, 6);
      tailFan.rotateZ(Math.PI / 2);
      tailFan.scale(1, 0.25, 1);
      tailFan.translate(-26, 2, 0);
      parts.push(paint(tailFan, b));
      [1, -1].forEach((d) => {
        parts.push(tube([[10, 2, d * 4], [17, 3, d * 10], [23, 3, d * 8]], 1.5, a));
        parts.push(ball(1, 6.4, 2.4, 3.8, 28, 3, d * 8, b));
        parts.push(tube([[12, 4, d * 2], [24, 7, d * 3], [38, 4, d * 8]], 0.3, b));
        for (let i = 0; i < 4; i++) parts.push(tube([[4 - i * 3.4, 1, d * 4], [3 - i * 3.4, -1, d * 10], [2 - i * 3.4, -3, d * 12]], 0.6, b));
      });
      parts.push(...eyesAt(13, 6, 2.5, 1));
    } else if (kind === "octopus") {
      parts.push(ball(1, 12, 11, 11, -2, 8, 0, a));
      parts.push(ball(1, 7, 6, 8, 5, 2, 0, a));
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * TAU, x = Math.cos(an), z = Math.sin(an);
        parts.push(tube([[x * 5, 0, z * 5], [x * 13, -2, z * 13], [x * 22, -1, z * 22], [x * 29 + z * 4, -3, z * 29 - x * 4]], 1.7, i % 2 ? a : b));
      }
      parts.push(...eyesAt(9, 5, 5, 1.7));
    } else {
      const body = new THREE.SphereGeometry(1, 18, 10);
      body.scale(31, 8.6, 8.6);
      const pos = body.attributes.position;
      for (let i = 0; i < pos.count; i++) if (pos.getX(i) < 0) { const k = 1 + pos.getX(i) / 42; pos.setY(i, pos.getY(i) * k); pos.setZ(i, pos.getZ(i) * k); }
      parts.push(paint(body, a));
      parts.push(ball(1, 21, 4.5, 6.5, 3, -4.8, 0, "#e8eef2"));
      const fin = (x, y, z, w, h, rot, rx) => { const g = new THREE.ConeGeometry(w, h, 4); g.scale(1, 1, 0.14); g.rotateZ(rot); if (rx) g.rotateX(rx); g.translate(x, y, z); parts.push(paint(g, b)); };
      fin(1, 13, 0, 7, 13, 0.25);
      fin(-37, 8, 0, 5, 19, 0.6);
      fin(-37, -6, 0, 4, 13, 2.5);
      fin(7, -6, 9, 5, 15, 0, -2.1);
      fin(7, -6, -9, 5, 15, 0, 2.1);
      parts.push(...eyesAt(22, 2.5, 5.2, 0.9));
    }
    return THREE.mergeGeometries(parts);
  }

  /* ---------- all banks ---------- */
  M.banks = {};
  M.initBanks = function () {
    const B = M.banks;
    B.fish = new FishBank(260);
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.6 }, o));
    B.coin = new Bank(new THREE.CylinderGeometry(6, 6, 1.4, 16), std({ color: "#ffc531", metalness: 0.95, roughness: 0.28 }), 40, false);
    B.log = new Bank(new THREE.CylinderGeometry(4, 4, 24, 8), materials().bark, 30, true);
    B.pellet = new Bank(new THREE.SphereGeometry(2, 6, 5), std({ color: "#b5712c", roughness: 1 }), 80, false);
    B.sea = {};
    const S = CTC.SEA.creatures;
    Object.keys(S).forEach((k) => {
      const g = creatureGeo(k, S[k]);
      B.sea[k] = new Bank(g, new (St.low ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial)({ vertexColors: true, roughness: 0.38, ...(St.low ? {} : { clearcoat: 0.4 }), transparent: k === "jellyfish", opacity: k === "jellyfish" ? 0.75 : 1 }), 40, true);
    });
  };
  M.beginBanks = function () {
    const B = M.banks;
    [B.fish, B.coin, B.log, B.pellet, ...Object.values(B.sea)].forEach((b) => b.begin());
  };
  M.endBanks = function () {
    const B = M.banks;
    [B.fish, B.coin, B.log, B.pellet, ...Object.values(B.sea)].forEach((b) => b.end());
  };

  /* ---------- ground rings: pads and selling circles ---------- */
  const ringGeo = new THREE.CircleGeometry(1, 64);
  ringGeo.rotateX(-Math.PI / 2);
  M.ring = function (color) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
      uniforms: { uC: { value: new THREE.Color(color) }, uFill: { value: 0.18 }, uProg: { value: 0 }, uT: { value: 0 }, uR: { value: 50 }, uDash: { value: 1 } },
      vertexShader: "varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `
        varying vec2 vP; uniform vec3 uC; uniform float uFill, uProg, uT, uR, uDash;
        void main() {
          float r = length(vP) * uR, a = atan(vP.x, -vP.y) / 6.28318 + 0.5;
          float edge = 1.0 - smoothstep(2.0, 3.2, abs(r - uR + 4.0));
          float dash = mix(1.0, step(0.42, fract(a * floor(uR / 3.2) + uT * 0.6)), uDash);
          vec3 col = uC; float al = uFill * smoothstep(uR, uR - 2.0, r) + edge * dash;
          float ring = (1.0 - smoothstep(4.0, 6.0, abs(r - uR + 9.0))) * step(fract(a + 0.5), uProg);
          col = mix(col, vec3(0.21, 0.76, 0.42), ring);
          gl_FragColor = vec4(col, clamp(al + ring, 0.0, 1.0));
          #include <colorspace_fragment>
        }`
    });
    const m = new THREE.Mesh(ringGeo, mat);
    m.visible = false;
    m.renderOrder = 3;
    St.scene.add(m);
    m.place = (x, y, r, h) => {
      m.visible = true;
      m.position.set(x, (h === undefined ? St.groundY(x, y) : h) + 1.2, y);
      m.scale.setScalar(r);
      mat.uniforms.uR.value = r;
    };
    m.u = mat.uniforms;
    return m;
  };

  /* ---------- trees ---------- */
  const sharedMats = {};
  const shared = (key, make) => (sharedMats[key] = sharedMats[key] || make());
  function palm(rnd) {
    const m = materials(), g = new THREE.Group();
    const lean = 14 + rnd() * 14, h = 125 + rnd() * 25;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * 0.2, h * 0.4, 0), new THREE.Vector3(lean * 0.65, h * 0.75, 0), new THREE.Vector3(lean, h, 0)]);
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 5, 8), m.bark);
    trunk.castShadow = true;
    g.add(trunk);
    const crown = new THREE.Group();
    crown.position.set(lean, h, 0);
    g.add(crown);
    const blade = new THREE.PlaneGeometry(1, 1, 10, 2);
    const leafMat = shared("leaf", () => new THREE.MeshStandardMaterial({ color: "#4f8f3d", roughness: 0.7, side: THREE.DoubleSide }));
    for (let i = 0; i < 11; i++) {
      const geo = blade.clone(), pos = geo.attributes.position, len = 70 + rnd() * 24, droop = 34 + rnd() * 22;
      for (let k = 0; k < pos.count; k++) {
        const u = pos.getX(k) + 0.5, v = pos.getY(k) * 2;
        const width = 11 * Math.sin(Math.min(1, u + 0.12) * Math.PI) ** 0.7;
        const serr = 1 - 0.35 * Math.abs(Math.sin(u * 40));
        pos.setXYZ(k, u * len, u * 15 - u * u * droop * 1.5 - Math.abs(v) * 3, v * width * serr);
      }
      geo.computeVertexNormals();
      const f = new THREE.Mesh(geo, leafMat);
      f.rotation.y = (i / 11) * TAU + rnd() * 0.3;
      f.castShadow = true;
      crown.add(f);
    }
    [[-4, 5], [5, 3], [0, -6]].forEach(([x, z]) => {
      const nut = new THREE.Mesh(new THREE.SphereGeometry(4.2, 8, 6), shared("nut", () => new THREE.MeshStandardMaterial({ color: "#5c3d20", roughness: 0.8 })));
      nut.position.set(x, -5, z);
      nut.castShadow = true;
      crown.add(nut);
    });
    g.sway = crown;
    return g;
  }

  function pine(rnd) {
    const m = materials(), g = new THREE.Group();
    cyl(g, 4, 7, 34, m.barkPine, 0, 0, 0, 8);
    const needles = shared("needles", () => new THREE.MeshStandardMaterial({ color: "#2b5c49", roughness: 0.9, flatShading: true }));
    const snow = shared("snow", () => new THREE.MeshStandardMaterial({ color: "#f5fbff", roughness: 0.75, flatShading: true }));
    const crown = new THREE.Group();
    g.add(crown);
    for (let k = 0; k < 5; k++) {
      const r = 42 - k * 7.5, h = 48 - k * 3, y = 20 + k * 27;
      const c = new THREE.Mesh(jag(new THREE.ConeGeometry(r, h, 11, 2), rnd, r), needles);
      c.position.y = y + h / 2;
      c.castShadow = true;
      crown.add(c);
      const cap = new THREE.Mesh(jag(new THREE.ConeGeometry(r * 0.72, h * 0.62, 11, 1), rnd, r * 0.7), snow);
      cap.position.y = y + h * 0.72;
      crown.add(cap);
    }
    g.sway = crown;
    return g;
  }
  function jag(geo, rnd, r) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > geo.parameters.height / 2 - 0.01) continue;
      const k = 1 + (rnd() - 0.5) * 0.22;
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function coralTree(rnd, i) {
    const g = new THREE.Group();
    const color = ["#e8577a", "#ff8f5a", "#b05fd6"][i % 3];
    const mat = shared(color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.55 }));
    const crown = new THREE.Group();
    g.add(crown);
    (function branch(x, y, z, ax, az, len, r, depth) {
      const nx = x + Math.sin(ax) * Math.cos(az) * len, ny = y + Math.cos(ax) * len, nz = z + Math.sin(ax) * Math.sin(az) * len;
      beam(crown, [x, y, z], [nx, ny, nz], r, mat);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(r * 1.1, 8, 6), mat);
      tip.position.set(nx, ny, nz);
      tip.castShadow = true;
      crown.add(tip);
      if (depth > 0) for (let k = 0; k < 3; k++) branch(nx, ny, nz, ax * 0.55 + 0.35 + rnd() * 0.55, az + (k / 3) * TAU + rnd(), len * 0.74, r * 0.72, depth - 1);
    })(0, 0, 0, 0.05, 0, 40, 6.5, 3);
    g.sway = crown;
    return g;
  }

  M.stump = function (decor) {
    const g = new THREE.Group(), m = materials();
    cyl(g, 7, 9, 13, decor === "pine" ? m.barkPine : m.bark, 0, 0, 0, 10);
    const top = new THREE.Mesh(new THREE.CircleGeometry(7, 12), new THREE.MeshStandardMaterial({ color: "#d9b98a", roughness: 0.9 }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 13.1;
    g.add(top);
    return g;
  };
  M.tree = function (decor, rnd, i) {
    const t = decor === "palm" ? palm(rnd) : decor === "pine" ? pine(rnd) : coralTree(rnd, i);
    M.bake(t.sway);
    return t;
  };

  /* ---------- buildings: each returns a group placed by the renderer ---------- */
  function stockTray(parent, w, d, x, y, z) { box(parent, w, 3, d, materials().ice, x, y, z); }

  M.stall = function (T) {
    const g = new THREE.Group(), m = materials();
    const paint = new THREE.MeshStandardMaterial({ map: woodTex("#2f6f9f", "#123a56"), roughness: 0.7 });
    const counter = box(g, 184, 40, 40, m.wood, 0, 0, 0);
    g.setUpgraded = (on) => { counter.material = on ? paint : m.wood; };
    box(g, 192, 4, 46, m.woodDark, 0, 40, 0);
    stockTray(g, 172, 34, 0, 44, 0);
    [[-86, -38, 158], [86, -38, 158], [-86, 24, 140], [86, 24, 140]].forEach(([x, z, h]) => box(g, 7, h, 7, m.woodDark, x, 0, z));
    const tex = stripes(T.awning, "#fff8e7", 12);
    awning(g, 208, 82, 22, 0, 166, -14, tex);
    const signBoard = sign(g, "FRESH FISH", "#16324a", "#ffc531", 112, 28, 0, 172, -52, null);
    box(g, 3, 28, 3, m.woodDark, -46, 148, -52);
    box(g, 3, 28, 3, m.woodDark, 46, 148, -52);
    // Upgrades: bunting and lanterns, then side crates of fish.
    const fancy = new THREE.Group();
    g.add(fancy);
    const colors = ["#e4574c", "#ffc531", "#3fb6c9", "#2fb37a", "#a45fd6"];
    for (let i = 0; i < 12; i++) {
      const flag = new THREE.Mesh(new THREE.ConeGeometry(4, 9, 3), new THREE.MeshStandardMaterial({ color: colors[i % 5], roughness: 0.9 }));
      flag.rotation.x = Math.PI;
      flag.scale.z = 0.2;
      flag.position.set(-82 + i * 15, 138 - Math.sin((i / 11) * Math.PI) * 9, 24);
      fancy.add(flag);
    }
    [-86, 86].forEach((x) => {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), m.lit);
      lamp.position.set(x, 128, 26);
      fancy.add(lamp);
    });
    const side = new THREE.Group();
    g.add(side);
    [-120, 120].forEach((x) => { box(side, 40, 26, 34, m.plank, x, 0, 4); });
    g.fancy = fancy;
    g.side = side;
    g.signBoard = signBoard;
    return g;
  };

  M.foodShop = function () {
    const g = new THREE.Group(), m = materials();
    const purple = new THREE.MeshStandardMaterial({ map: bricks("#7a3f9c", "#3c2150", [3, 1]) });
    const counter = box(g, 152, 38, 34, new THREE.MeshStandardMaterial({ map: bricks("#a8452f", "#6b5a4c", [3, 1]) }), 0, 0, 0);
    const plain = counter.material;
    g.setUpgraded = (on) => { counter.material = on ? purple : plain; };
    box(g, 160, 4, 40, m.plank, 0, 38, 0);
    [[-72, -30, 138], [72, -30, 138], [-72, 18, 124], [72, 18, 124]].forEach(([x, z, h]) => box(g, 7, h, 7, m.woodDark, x, 0, z));
    awning(g, 174, 66, 18, 0, 144, -12, stripes("#d9412f", "#ffc531", 10));
    sign(g, "HOT FOOD", "#5a1f12", "#ffd34d", 96, 26, 0, 148, -46, null);
    const fancy = new THREE.Group();
    g.add(fancy);
    [-70, 70].forEach((x) => {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), m.lit);
      lamp.position.set(x, 118, 20);
      fancy.add(lamp);
    });
    g.fancy = fancy;
    return g;
  };

  M.crate = function () {
    const g = new THREE.Group(), m = materials();
    box(g, 72, 4, 44, m.woodDark, 0, 0, 0);
    [-21, 21].forEach((z, row) => { for (let i = 0; i < 3; i++) box(g, 72, 9, 3, m.plank, 0, 4 + i * 10.5, z); });
    [-35, 35].forEach((x) => { for (let i = 0; i < 3; i++) box(g, 3, 9, 44, m.plank, x, 4 + i * 10.5, 0); });
    [[-35, -21], [35, -21], [-35, 21], [35, 21]].forEach(([x, z]) => box(g, 5, 36, 5, m.woodDark, x, 0, z));
    const c = canvasTex(256, 64, (x, w, h) => {
      x.fillStyle = "#b9834c";
      x.fillRect(0, 0, w, h);
      x.fillStyle = "#3a230f";
      x.font = "900 44px Georgia, serif";
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText("CATCH", w / 2, h / 2 + 2);
    });
    plane(g, 40, 10, new THREE.MeshStandardMaterial({ map: c }), 0, 18, 22.8);
    return g;
  };

  M.fireplace = function () {
    const g = new THREE.Group(), m = materials();
    const rnd = seeded(444);
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * TAU, s = new THREE.Mesh(new THREE.DodecahedronGeometry(8 + rnd() * 3, 0), m.stone);
      s.position.set(Math.cos(a) * 30, 5, Math.sin(a) * 24);
      s.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      s.scale.y = 0.75;
      s.castShadow = true;
      g.add(s);
    }
    const ash = new THREE.Mesh(new THREE.CircleGeometry(27, 18), m.ash);
    ash.rotation.x = -Math.PI / 2;
    ash.scale.y = 0.8;
    ash.position.y = 0.8;
    g.add(ash);
    beam(g, [-22, 5, 7], [20, 10, -8], 4, m.bark);
    beam(g, [22, 5, 7], [-20, 10, -8], 4, m.bark);
    beam(g, [0, 5, 14], [0, 11, -14], 3.6, m.bark);
    // The grill stands on two iron legs.
    beam(g, [-40, 0, 0], [-40, 40, 0], 2, m.iron);
    beam(g, [40, 0, 0], [40, 40, 0], 2, m.iron);
    for (let i = 0; i < 9; i++) beam(g, [-40, 40, -18 + i * 4.5], [40, 40, -18 + i * 4.5], 0.7, m.iron);
    beam(g, [-40, 40, -18], [-40, 40, 18], 1.3, m.iron);
    beam(g, [40, 40, -18], [40, 40, 18], 1.3, m.iron);
    // Plank for cooked fish.
    box(g, 50, 16, 26, m.plank, 70, 0, 6);
    // Woodpile, shown as wood comes in.
    const pile = new THREE.Group();
    pile.position.set(-74, 0, 8);
    g.add(pile);
    for (let i = 0; i < 12; i++) {
      const row = i < 5 ? 0 : i < 9 ? 1 : i < 11 ? 2 : 3, start = [0, 5, 9, 11][row], n = i - start;
      const log = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 26, 8), m.bark);
      log.rotation.x = Math.PI / 2;
      log.position.set(-14 + n * 7 + row * 3.5, 3.4 + row * 6, 0);
      log.castShadow = true;
      pile.add(log);
    }
    g.pile = pile;
    // Flames: three crossed planes with an animated shader.
    const flameMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `
        varying vec2 vUv; uniform float uT;
        ${St.NOISE}
        void main() {
          vec2 p = vUv; float y = p.y;
          float n = fbm(vec2(p.x * 3.0, y * 2.5 - uT * 2.2));
          float x = abs(p.x - 0.5 + (n - 0.5) * 0.3 * y) * 2.0;
          float w = (1.0 - y) * (0.55 + n * 0.75) + 0.02;
          float f = 1.0 - smoothstep(w * 0.45, w, x);
          f *= smoothstep(0.0, 0.08, y);
          vec3 col = mix(vec3(1.0, 0.85, 0.3), mix(vec3(1.0, 0.36, 0.06), vec3(0.7, 0.08, 0.02), y), smoothstep(0.1, 0.65, y + x * 0.5));
          gl_FragColor = vec4(col * f * 0.85, f * 0.8);
          #include <colorspace_fragment>
        }`
    });
    const flames = new THREE.Group();
    const fg = new THREE.PlaneGeometry(58, 52);
    fg.translate(0, 26, 0);
    [0, 1.05, 2.1].forEach((r) => {
      const p = new THREE.Mesh(fg, flameMat);
      p.rotation.y = r;
      p.renderOrder = 5;
      flames.add(p);
    });
    flames.position.y = 4;
    g.add(flames);
    const glow = new THREE.PointLight("#ff9440", 0, 260, 1.7);
    glow.position.set(0, 34, 0);
    if (!St.low) g.add(glow); // A light in the scene adds work to every lit pixel.
    Object.assign(g, { flames, flameMat, glow });
    return g;
  };

  M.crane = function () {
    const g = new THREE.Group(), m = materials();
    [[-20, -14], [20, -14], [-20, 14], [20, 14]].forEach(([x, z]) => beam(g, [x, 0, z], [x * 0.25, 64, z * 0.25], 3.4, m.wood));
    beam(g, [-13, 26, -9], [13, 26, -9], 2.2, m.woodDark);
    beam(g, [-13, 26, 9], [13, 26, 9], 2.2, m.woodDark);
    box(g, 26, 22, 22, new THREE.MeshStandardMaterial({ color: "#3f6c8f", roughness: 0.5, metalness: 0.45 }), 0, 8, 0);
    const winch = new THREE.Group();
    winch.position.set(0, 19, 12);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 3, 6), new THREE.MeshStandardMaterial({ color: "#ffc531", metalness: 0.5, roughness: 0.4 }));
    drum.rotation.x = Math.PI / 2;
    drum.castShadow = true;
    winch.add(drum);
    g.add(winch);
    beam(g, [18, 66, 0], [-115, 66, 0], 3.2, m.wood);
    beam(g, [18, 66, 0], [-30, 84, 0], 1.0, m.rope);
    beam(g, [-115, 66, 0], [-30, 84, 0], 1.0, m.rope);
    beam(g, [0, 62, 0], [-30, 84, 0], 2.5, m.wood);
    const rope = cyl(g, 0.7, 0.7, 1, m.rope, -112, 0, 0, 5);
    const bag = netBag(15);
    bag.position.x = -112;
    g.add(bag);
    Object.assign(g, { winch, rope, bag });
    return g;
  };

  const netTex = () => canvasTex(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = "rgba(245,235,210,1)";
    c.lineWidth = 3.4;
    for (let i = 0; i <= 8; i++) {
      c.beginPath(); c.moveTo((i * w) / 8, 0); c.lineTo((i * w) / 8, h); c.stroke();
      c.beginPath(); c.moveTo(0, (i * h) / 8); c.lineTo(w, (i * h) / 8); c.stroke();
    }
  });
  let meshTexCache = null;
  function netMaterial(rep) {
    meshTexCache = meshTexCache || netTex();
    const tex = meshTexCache.clone();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(rep, rep);
    tex.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1, color: "#fff4d8" });
  }
  function netBag(r) {
    const geo = new THREE.SphereGeometry(r, 14, 10);
    geo.scale(1, 1.15, 1);
    geo.translate(0, -r * 0.95, 0);
    const b = new THREE.Mesh(geo, netMaterial(3));
    b.castShadow = true;
    return b;
  }

  // The thrown net: a shallow dome that opens in flight, with a weighted rim.
  M.thrownNet = function () {
    const g = new THREE.Group();
    const dome = new THREE.SphereGeometry(1, 28, 8, 0, TAU, 0, Math.PI / 2.8);
    dome.scale(1, 0.55, 1);
    dome.translate(0, -0.45, 0);
    const mesh = new THREE.Mesh(dome, netMaterial(7));
    mesh.castShadow = true;
    const rimGeo = new THREE.TorusGeometry(0.82, 0.017, 6, 40);
    rimGeo.rotateX(Math.PI / 2);
    rimGeo.translate(0, -0.45 + 0.55 * Math.cos(Math.PI / 2.8), 0);
    const rim = new THREE.Mesh(rimGeo, new THREE.MeshStandardMaterial({ color: "#d9bd7f", roughness: 1 }));
    g.add(mesh, rim);
    g.visible = false;
    St.scene.add(g);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1, 5), materials().rope);
    line.visible = false;
    St.scene.add(line);
    g.rope = line;
    return g;
  };
  // Stretches a thin cylinder between two points.
  const up = new THREE.Vector3(0, 1, 0), da = new THREE.Vector3(), db = new THREE.Vector3();
  M.stretch = function (mesh, ax, ay, az, bx, by, bz) {
    da.set(ax, ay, az);
    db.set(bx, by, bz);
    const len = da.distanceTo(db);
    mesh.position.copy(da).add(db).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(up, db.sub(da).normalize());
    mesh.scale.set(1, len, 1);
    mesh.visible = true;
  };

  // Lofted boat hull, bow at +x.
  function hull(len, beam_, depth, color, deckColor) {
    const n = 16, ring = 9, pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = (u - 0.5) * len;
      const w = beam_ * Math.pow(Math.sin(Math.min(1, u * 0.86 + 0.14) * Math.PI), 0.55) * (u > 0.8 ? 1 - (u - 0.8) * 3.5 : 1);
      const rise = u > 0.6 ? (u - 0.6) * depth * 0.9 : 0;
      for (let j = 0; j < ring; j++) {
        const a = (j / (ring - 1)) * Math.PI;
        pos.push(x, -Math.sin(a) * depth * (1 - u * 0.2) + rise, Math.cos(a) * w * 0.5);
      }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < ring - 1; j++) {
      const a = i * ring + j, b = a + 1, c = a + ring, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const group = new THREE.Group();
    const shell = new THREE.Mesh(g, color);
    shell.castShadow = true;
    color.side = THREE.DoubleSide;
    group.add(shell);
    const dk = [], di = [];
    for (let i = 0; i <= n; i++) {
      dk.push(pos[(i * ring) * 3], pos[(i * ring) * 3 + 1] - 0.5, pos[(i * ring) * 3 + 2]);
      dk.push(pos[(i * ring + ring - 1) * 3], pos[(i * ring + ring - 1) * 3 + 1] - 0.5, pos[(i * ring + ring - 1) * 3 + 2]);
    }
    for (let i = 0; i < n; i++) { const a = i * 2; di.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const deckG = new THREE.BufferGeometry();
    deckG.setAttribute("position", new THREE.Float32BufferAttribute(dk, 3));
    deckG.setAttribute("uv", new THREE.Float32BufferAttribute(dk.flatMap((v, i) => (i % 3 === 2 ? [] : [v / 40])), 2));
    deckG.setIndex(di);
    deckG.computeVertexNormals();
    deckColor.side = THREE.DoubleSide;
    const deck = new THREE.Mesh(deckG, deckColor);
    deck.receiveShadow = true;
    group.add(deck);
    return group;
  }

  M.trawler = function (T) {
    const g = new THREE.Group(), m = materials();
    const paint = new THREE.MeshStandardMaterial({ color: T.weather === "snow" ? "#a8322f" : "#21598f", roughness: 0.45, metalness: 0.1 });
    g.add(hull(100, 34, 13, paint, m.plank.clone()));
    box(g, 26, 22, 20, new THREE.MeshStandardMaterial({ color: "#f3efe4", roughness: 0.6 }), 8, 0, 0);
    box(g, 30, 3, 24, m.woodDark, 8, 22, 0);
    [-1, 1].forEach((d) => box(g, 18, 8, 0.6, m.glass, 8, 11, d * 10.2));
    box(g, 0.6, 8, 14, m.glass, 21.2, 11, 0);
    beam(g, [-12, 0, 0], [-12, 54, 0], 1.7, m.woodDark);
    beam(g, [-12, 44, 0], [-50, 24, 0], 1.4, m.woodDark);
    const rope = cyl(g, 0.5, 0.5, 1, m.rope, -50, 0, 0, 5);
    const bag = netBag(11);
    bag.position.x = -50;
    g.add(rope, bag);
    Object.assign(g, { rope, bag });
    return g;
  };

  function sail(parent, w, h, x, y, z) {
    const geo = new THREE.PlaneGeometry(w, h, 10, 10);
    const mat = new THREE.MeshStandardMaterial({ color: "#f5ecd6", roughness: 0.92, side: THREE.DoubleSide });
    const s = new THREE.Mesh(geo, mat);
    s.rotation.y = Math.PI / 2;
    s.position.set(x, y, z);
    s.castShadow = true;
    s.base = Float32Array.from(geo.attributes.position.array);
    s.bw = w;
    s.bh = h;
    parent.add(s);
    return s;
  }

  M.ship = function () {
    const g = new THREE.Group(), m = materials();
    const paint = new THREE.MeshStandardMaterial({ map: woodTex("#6e3f22", "#2d1a0c", [4, 1]), roughness: 0.6 });
    const h = hull(220, 66, 30, paint, m.plank.clone());
    h.rotation.y = Math.PI;
    g.add(h);
    const gold = new THREE.MeshStandardMaterial({ color: "#ffc531", metalness: 0.7, roughness: 0.35 });
    box(g, 34, 22, 44, m.wood, 70, 0, 0);
    box(g, 38, 3, 48, gold, 70, 22, 0);
    const sails = [];
    [[-45, 150], [30, 118]].forEach(([x, ht]) => {
      cyl(g, 2.2, 3.2, ht, m.woodDark, x, 0, 0, 8);
      const rig = new THREE.Group();
      rig.position.x = x;
      rig.rotation.y = 0.8;
      g.add(rig);
      beam(rig, [0, ht * 0.86, -44], [0, ht * 0.86, 44], 1.8, m.woodDark);
      beam(rig, [0, ht * 0.32, -36], [0, ht * 0.32, 36], 1.5, m.woodDark);
      sails.push(sail(rig, 82, ht * 0.52, 2, ht * 0.59, 0));
    });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(26, 14, 6, 1), new THREE.MeshStandardMaterial({ color: "#e4574c", side: THREE.DoubleSide, roughness: 0.9 }));
    flag.position.set(-32, 146, 0);
    g.add(flag);
    Object.assign(g, { sails, flag });
    return g;
  };
  // Sails belly in the wind.
  M.animateShip = function (ship, t) {
    ship.sails.forEach((s, i) => {
      const p = s.geometry.attributes.position, b = s.base;
      for (let k = 0; k < p.count; k++) {
        const u = b[k * 3] / s.bw + 0.5, v = b[k * 3 + 1] / s.bh + 0.5;
        p.setZ(k, -Math.sin(u * Math.PI) * Math.sin(v * Math.PI * 0.95 + 0.1) * (11 + Math.sin(t * 0.9 + i) * 2.5));
      }
      p.needsUpdate = true;
    });
    ship.flag.rotation.y = Math.sin(t * 3) * 0.3;
  };

  M.pier = function () {
    const g = new THREE.Group(), m = materials(), P = L.pier;
    const w = P.x1 - P.x0, d = P.y1 - P.y0, cx = (P.x0 + P.x1) / 2, cz = (P.y0 + P.y1) / 2;
    const rnd = seeded(21);
    for (let x = P.x0; x < P.x1; x += 13.4) {
      const b = box(g, 12.6, 3, d + (rnd() - 0.5) * 3, m.weathered, x + 6.5, 10, cz);
      b.rotation.y = (rnd() - 0.5) * 0.008;
    }
    [P.y0 + 2, P.y1 - 2].forEach((z) => box(g, w, 4, 3, m.woodDark, cx, 6, z));
    for (let x = P.x0 + 12; x < P.x1 - 20; x += 62) {
      [P.y0, P.y1].forEach((z) => cyl(g, 4, 4.6, 50, m.woodDark, x, -36, z, 8));
    }
    // A couple of mooring bollards and a rope coil.
    cyl(g, 4, 5, 14, m.woodDark, P.x0 + 8, 13, P.y0 + 4, 8);
    cyl(g, 4, 5, 14, m.woodDark, P.x0 + 8, 13, P.y1 - 4, 8);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(7, 2, 6, 14), m.rope);
    coil.rotation.x = Math.PI / 2;
    coil.position.set(P.x0 + 44, 14.5, P.y1 - 10);
    g.add(coil);
    return g;
  };

  M.belt = function () {
    const g = new THREE.Group();
    g.rails = new THREE.MeshStandardMaterial({ color: "#5e6b78", metalness: 0.65, roughness: 0.4 });
    const tex = canvasTex(64, 64, (c, w, h) => {
      c.fillStyle = "#2c333b";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "rgba(255,255,255,.1)";
      for (let i = 0; i < 4; i++) c.fillRect(0, i * 16 + 2, w, 3);
      c.fillStyle = "#000";
      c.fillRect(0, 0, w, 2);
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    g.tex = tex;
    return g;
  };
  // Builds a belt along a map path: a rubber band in a steel frame, on legs.
  M.layBelt = function (g, P, y) {
    const m = materials(), group = new THREE.Group();
    const bandMats = [];
    let run = 0;
    for (let i = 1; i < P.length; i++) {
      const [ax, az] = P[i - 1], [bx, bz] = P[i];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 1) continue;
      const angle = Math.atan2(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2;
      const seg = new THREE.Group();
      seg.position.set(cx, y, cz);
      seg.rotation.y = angle;
      const tex = g.tex.clone();
      tex.repeat.set(1, Math.max(1, Math.round(len / 18)));
      tex.needsUpdate = true;
      const band = new THREE.Mesh(new THREE.BoxGeometry(22, 1.4, len + 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }));
      band.position.y = 1;
      band.receiveShadow = true;
      band.castShadow = true;
      band.startRun = run;
      bandMats.push({ tex, len });
      seg.add(band);
      [-12.5, 12.5].forEach((d) => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(3, 5, len + 16), g.rails);
        r.position.set(d, 0.7, 0);
        r.castShadow = true;
        seg.add(r);
      });
      const legs = Math.max(1, Math.floor(len / 42));
      for (let k = 0; k <= legs; k++) {
        const z = -len / 2 + (k * len) / legs;
        [-12, 12].forEach((d) => {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(2.4, y, 2.4), m.iron);
          leg.position.set(d, -y / 2, z);
          leg.castShadow = true;
          seg.add(leg);
        });
      }
      group.add(seg);
      run += len;
    }
    g.add(group);
    g.bands = bandMats;
  };

  M.fence = function () {
    const g = new THREE.Group(), m = materials(), P = CTC.SEA.pen, GAP = 42;
    const post = (x, z) => {
      cyl(g, 3, 3.6, 62, m.woodDark, x, -40, z, 8);
    };
    for (let x = P.x0; x <= P.x1; x += GAP) { post(x, P.y0); post(x, P.y1); }
    for (let z = P.y0 + GAP; z < P.y1; z += GAP) { post(P.x0, z); post(P.x1, z); }
    const w = P.x1 - P.x0, d = P.y1 - P.y0;
    [10, 18].forEach((y) => {
      beam(g, [P.x0, y, P.y0], [P.x1, y, P.y0], 0.9, m.rope);
      beam(g, [P.x0, y, P.y1], [P.x1, y, P.y1], 0.9, m.rope);
      beam(g, [P.x0, y, P.y0], [P.x0, y, P.y1], 0.9, m.rope);
      beam(g, [P.x1, y, P.y0], [P.x1, y, P.y1], 0.9, m.rope);
    });
    [[0, 0], [w, 0], [0, d], [w, d]].forEach(([x, z]) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(7, 10, 8), new THREE.MeshStandardMaterial({ color: "#e4574c", roughness: 0.5 }));
      f.position.set(P.x0 + x, 2, P.y0 + z);
      g.add(f);
    });
    return g;
  };

  function roofPrism(parent, w, h, d, mat, x, y, z) {
    const s = new THREE.Shape();
    s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    g.rotateY(Math.PI / 2);
    g.translate(-w / 2, 0, 0);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.012, uv.getY(i) * 0.02);
    const r = new THREE.Mesh(g, mat);
    r.position.set(x, y, z);
    r.castShadow = true;
    parent.add(r);
    return r;
  }

  M.kitchen = function () {
    const g = new THREE.Group(), m = materials();
    box(g, 160, 66, 96, m.plaster, 0, 0, 0);
    roofPrism(g, 176, 40, 110, m.roof, 0, 66, 0);
    cyl(g, 9, 10, 52, m.brick, 44, 66, -22, 10);
    box(g, 108, 30, 2, m.ash, 0, 24, 48.2);
    box(g, 118, 4, 14, m.plank, 0, 22, 54);
    const smoke = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 6), new THREE.MeshStandardMaterial({ color: "#f5f5f5", transparent: true, opacity: 0.4, roughness: 1 }));
      s.position.set(44, 120, -22);
      smoke.push(s);
      g.add(s);
    }
    sign(g, "CLOUD KITCHEN", "#7a2a18", "#ffd34d", 118, 26, 0, 72, 51, null);
    box(g, 22, 44, 2, m.woodDark, 66, 0, 48.2);
    g.smoke = smoke;
    return g;
  };

  M.hotel = function () {
    const g = new THREE.Group(), m = materials();
    box(g, 172, 144, 104, m.stucco, 0, 0, 0);
    box(g, 184, 8, 116, m.wood, 0, 144, 0);
    roofPrism(g, 182, 36, 116, m.slate, 0, 152, 0);
    g.win = [];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
      if (row === 0 && (col === 1 || col === 2)) continue;
      const x = -60 + col * 40, y = 16 + row * 42;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(22, 26), m.glass);
      w.position.set(x, y + 13, 52.2);
      g.add(w);
      g.win.push(w);
      box(g, 26, 2.5, 3, m.wood, x, y - 1, 52);
      box(g, 26, 2.5, 3, m.wood, x, y + 26, 52);
    }
    box(g, 34, 42, 2, m.woodDark, 0, 0, 52.3);
    box(g, 70, 3, 26, new THREE.MeshStandardMaterial({ color: "#2f7fd6", roughness: 0.8 }), 0, 44, 62);
    [-32, 32].forEach((x) => cyl(g, 2, 2, 44, m.steel, x, 0, 74, 8));
    sign(g, "HOTEL", "#16324a", "#ffd34d", 66, 20, 0, 118, 54.5, null);
    return g;
  };

  /* ---------- scenery ---------- */
  // Rocks along the shore, and grass or low plants inland, all drawn as one mesh each.
  M.scenery = function (T, seed) {
    const g = new THREE.Group(), rnd = seeded(seed);
    const free = (x, y) => {
      if (x > 840 && x < 1090 && y > 360 && y < 560) return false;
      if (x > 850 && x < 1100 && y > 580 && y < 700) return false;
      if (x > 610 && x < 900 && y > 340 && y < 660) return false;
      if (x > 640 && x < 1200 && y > 80 && y < 280) return false;
      return Math.abs(y - (L.queue.y + 3)) > 40 || x < 860;
    };
    const rockMat = new THREE.MeshStandardMaterial({ map: materials().stone.map, roughness: 1, flatShading: true, color: T.decor === "pine" ? "#b8c6d2" : "#9a8f80" });
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, 150);
    rocks.castShadow = !St.low;
    rocks.receiveShadow = true;
    const o = new THREE.Object3D();
    let n = 0;
    for (let i = 0; i < 700 && n < 150; i++) {
      const y = rnd() * 2000 - 640;
      const x = G.shoreX(y) + (rnd() - 0.45) * 46;
      if (G.onPier(x, y) || Math.abs(y - 360) < 50) continue;
      o.position.set(x, St.groundY(x, y) - 0.5, y);
      o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      const s = 3 + rnd() * rnd() * 16;
      o.scale.set(s, s * (0.5 + rnd() * 0.4), s * (0.7 + rnd() * 0.5));
      o.updateMatrix();
      rocks.setMatrixAt(n++, o.matrix);
    }
    rocks.count = n;
    g.add(rocks);
    // Grass tufts: three crossed blades, a shade off per tuft.
    const blade = new THREE.ConeGeometry(1.2, 9, 3, 1);
    blade.translate(0, 4.5, 0);
    const tuftParts = [];
    for (let i = 0; i < 6; i++) {
      const b = blade.clone();
      b.rotateZ((rnd() - 0.5) * 0.7);
      b.rotateY(rnd() * 6);
      b.translate((rnd() - 0.5) * 5, 0, (rnd() - 0.5) * 5);
      tuftParts.push(b);
    }
    const tuft = THREE.mergeGeometries(tuftParts);
    const snowy = T.decor === "pine";
    const count = St.low ? 800 : 5200;
    const grass = new THREE.InstancedMesh(tuft, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), count);
    const col = new THREE.Color();
    n = 0;
    for (let i = 0; i < count * 2 && n < count; i++) {
      const x = 770 + rnd() * 1560, y = rnd() * 1900 - 600;
      if (x < 1290 && y > 0 && y < 720 && !free(x, y)) continue;
      o.position.set(x, St.groundY(x, y) - 0.5, y);
      o.rotation.set(0, rnd() * 6, 0);
      o.scale.setScalar(snowy ? 0.8 + rnd() * 0.5 : 1 + rnd() * 1.1);
      o.updateMatrix();
      grass.setMatrixAt(n, o.matrix);
      col.set(snowy ? "#8fa08f" : T.groundDark).lerp(new THREE.Color(T.ground), rnd()).multiplyScalar(0.72 + rnd() * 0.3);
      grass.setColorAt(n, col);
      n++;
    }
    grass.count = n;
    grass.receiveShadow = true;
    g.add(grass);
    // Background trees on the hills give the map depth.
    const backdrop = new THREE.Group();
    const treeRnd = seeded(seed + 5);
    for (let i = 0; i < 32; i++) {
      const x = 2330 + treeRnd() * 700, y = treeRnd() * 2600 - 750;
      const tr = M.tree(T.decor, treeRnd, i);
      tr.position.set(x, St.groundY(x, y), y);
      tr.scale.setScalar(0.8 + treeRnd() * 0.6);
      tr.rotation.y = treeRnd() * 6;
      backdrop.add(tr);
    }
    for (let i = 0; i < 24; i++) {
      const x = 720 + treeRnd() * 1700, y = -570 - treeRnd() * 360;
      const tr = M.tree(T.decor, treeRnd, i);
      tr.position.set(x, St.groundY(x, y), y);
      tr.scale.setScalar(0.8 + treeRnd() * 0.6);
      tr.rotation.y = treeRnd() * 6;
      backdrop.add(tr);
    }
    for (let i = 0; i < 14; i++) {
      const x = 640 + treeRnd() * 1800, y = 1290 + treeRnd() * 240;
      const tr = M.tree(T.decor, treeRnd, i);
      tr.position.set(x, St.groundY(x, y), y);
      tr.scale.setScalar(0.8 + treeRnd() * 0.6);
      tr.rotation.y = treeRnd() * 6;
      backdrop.add(tr);
    }
    g.add(M.bake(backdrop));
    return g;
  };

  // Snowflakes or petals falling through the whole view.
  M.weather = function (kind) {
    const n = St.low ? 1200 : 2600, pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = Math.random() * 4000 - 1000; pos[i * 3 + 1] = Math.random() * 500; pos[i * 3 + 2] = Math.random() * 2600 - 800; seed[i] = Math.random() * 6; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aS", new THREE.BufferAttribute(seed, 1));
    const snowy = kind === "snow";
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(snowy ? "#ffffff" : "#ffbecd") }, uDrop: { value: snowy ? 34 : 15 } },
      vertexShader: `
        attribute float aS; uniform float uT, uDrop;
        void main() {
          vec3 p = position;
          p.y = mod(p.y - uT * uDrop * (0.7 + fract(aS) * 0.6), 500.0);
          p.x += sin(uT * 0.8 + aS) * 22.0 + uT * 7.0 * fract(aS * 3.0);
          p.x = mod(p.x + 1000.0, 4000.0) - 1000.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (3.0 + fract(aS * 7.0) * 3.0) * 1500.0 / -mv.z;
        }`,
      fragmentShader: `uniform vec3 uC;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(uC, smoothstep(0.5, 0.15, d) * 0.9);
          #include <colorspace_fragment>
        }`
    });
    const p = new THREE.Points(geo, mat);
    p.frustumCulled = false;
    p.renderOrder = 6;
    return p;
  };

  // Sparks, splashes and steam from the game's particle list.
  M.particles = function () {
    const n = 500;
    const geo = new THREE.BufferGeometry();
    const pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3), col = new THREE.BufferAttribute(new Float32Array(n * 4), 4), size = new THREE.BufferAttribute(new Float32Array(n), 1);
    [pos, col, size].forEach((a) => a.setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("position", pos);
    geo.setAttribute("aC", col);
    geo.setAttribute("aSize", size);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: `attribute vec4 aC; attribute float aSize; varying vec4 vC;
        void main() { vC = aC; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * 1500.0 / -mv.z; }`,
      fragmentShader: `varying vec4 vC;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(vC.rgb, vC.a * smoothstep(0.5, 0.2, d));
          #include <colorspace_fragment>
        }`
    });
    const p = new THREE.Points(geo, mat);
    p.frustumCulled = false;
    p.renderOrder = 7;
    St.scene.add(p);
    p.fill = (list) => {
      const c = new THREE.Color();
      let k = 0;
      list.forEach((q) => {
        if (q.ring || k >= n) return;
        if (q.y0 === undefined) q.y0 = q.y;
        const life = 1 - q.t / q.life;
        pos.setXYZ(k, q.x, St.groundY(q.x, q.y0) + Math.max(2, 26 + q.y0 - q.y), q.y0);
        const hex = q.c.startsWith("rgba") ? "#ffffff" : q.c;
        c.set(hex);
        col.setXYZW(k, c.r, c.g, c.b, life);
        size.setX(k, q.r * 1.8);
        k++;
      });
      geo.setDrawRange(0, k);
      pos.needsUpdate = col.needsUpdate = size.needsUpdate = true;
    };
    return p;
  };
})();
