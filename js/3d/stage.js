/* The 3D scene itself: renderer, camera, light, terrain and water.
   The game rules still work on the flat 1280x720 map. A map point (x, y) sits at
   3D position (x, height, y), and 36 units is about one metre. */
(function () {
  const G = CTC.game, L = CTC.LAYOUT;
  const St = (CTC.stage = { low: window.matchMedia("(pointer: coarse)").matches });
  const PITCH = 0.76, FOV = 30, PIER_Y = 13, LAND_Y = 10;
  let renderer, baseDist = 1000, baseShift = 0;
  const ray = new THREE.Raycaster(), v = new THREE.Vector3();

  const smooth = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  St.smooth = smooth;

  /* ---------- heights ---------- */
  // Rolling hills past the edges of the playable map.
  function hills(x, y) {
    const out = smooth(2320, 2800, x) + smooth(-560, -1000, y) * smooth(600, 1100, x) + smooth(1280, 1640, y) * smooth(600, 1100, x);
    if (out <= 0) return 0;
    return out * (150 + 70 * Math.sin(x * 0.006 + y * 0.004) + 40 * Math.sin(x * 0.013 - y * 0.009) + 16 * Math.sin(y * 0.031 + x * 0.02));
  }
  function terrainY(x, y) {
    const d = x - G.shoreX(y);
    if (d < 0) return -Math.min(70, -d * 0.24);
    return LAND_Y * smooth(0, 45, d) + hills(x, y);
  }
  // Height people and buildings stand at.
  St.groundY = (x, y) => (G.onPier(x, y) ? PIER_Y : Math.max(terrainY(x, y), 0));

  /* ---------- setup ---------- */
  St.init = function (canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !St.low, powerPreference: "high-performance" });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    St.renderer = renderer;
    const scene = (St.scene = new THREE.Scene());
    St.camera = new THREE.PerspectiveCamera(FOV, L.width / L.height, 20, 18000);
    St.hemi = new THREE.HemisphereLight(0xffffff, 0x887766, 0.6);
    St.sun = new THREE.DirectionalLight(0xffffff, 3);
    const size = St.low ? 1024 : 2048, sc = St.sun.shadow.camera;
    St.sun.castShadow = true;
    St.sun.shadow.mapSize.set(size, size);
    Object.assign(sc, { left: -850, right: 850, top: 650, bottom: -650, near: 100, far: 9000 });
    St.sun.shadow.bias = -0.0003;
    St.sun.shadow.normalBias = 1.2;
    St.sun.target.position.set(640, 0, 360);
    scene.add(St.hemi, St.sun, St.sun.target);
    fitCamera();
    buildTerrain();
    buildWater();
  };

  St.resize = function (cssScale) {
    const ratio = Math.min(St.low ? 1.5 : 2, cssScale * (window.devicePixelRatio || 1));
    renderer.setPixelRatio(1);
    renderer.setSize(Math.round(L.width * ratio), Math.round(L.height * ratio), false);
  };

  function aimCamera(dist, tx, tz) {
    const c = St.camera;
    c.position.set(tx, Math.sin(PITCH) * dist, tz + Math.cos(PITCH) * dist);
    c.lookAt(tx, 0, tz);
    c.updateMatrixWorld();
  }
  // Moves back until the near corners of the map fit, then centres it on screen.
  function fitCamera() {
    const ndc = (x, y) => { v.set(x, LAND_Y, y).project(St.camera); return v; };
    let shift = 0;
    for (let dist = 800; dist < 4000; dist += 10) {
      aimCamera(dist, L.width / 2, L.height / 2 + shift);
      const hi = ndc(L.width / 2, 0).y, lo = ndc(L.width / 2, L.height).y;
      shift -= ((hi + lo) / 2) * 60;
      if (Math.abs(ndc(L.width, L.height).x) <= 1 && ndc(L.width, L.height).y >= -1 && ndc(L.width, 0).y <= 1) { baseDist = dist; break; }
    }
    baseShift = shift;
  }

  // Follows the same view rectangle the 2D game used, so panning and zoom rules stay the same.
  St.updateCamera = function () {
    const cam = G.cam;
    const jolt = G.shake > 0 ? G.shake : 0;
    aimCamera(baseDist / cam.z, cam.x + L.width / (2 * cam.z) + (Math.random() - 0.5) * jolt, cam.y + L.height / (2 * cam.z) + baseShift / cam.z + (Math.random() - 0.5) * jolt);
    St.camera.updateProjectionMatrix();
    // Haze and sharp shadows follow the view, so zooming out stays clear and zooming in stays crisp.
    const dist = baseDist / cam.z;
    if (St.scene.fog) {
      St.scene.fog.near = dist + 1500;
      St.scene.fog.far = dist + 3400;
      waterU.uFogFar.value = dist + 3400;
    }
    const sc = St.sun.shadow.camera, half = Math.max(420, 1280 / cam.z);
    if (sc.right !== half) {
      sc.left = -half; sc.right = half;
      sc.top = half; sc.bottom = -half;
      sc.updateProjectionMatrix();
    }
    const snap = 32;
    const sx = Math.round((cam.x + L.width / (2 * cam.z)) / snap) * snap, sz = Math.round((cam.y + L.height / (2 * cam.z)) / snap) * snap;
    St.sun.target.position.set(sx, 0, sz);
    if (St.sunDir) St.sun.position.set(sx + St.sunDir[0] * 3, St.sunDir[1] * 3, sz + St.sunDir[2] * 3);
    St.sun.target.updateMatrixWorld();
  };

  // Map point and height to a position on the 1280x720 stage.
  St.project = function (x, y, h) {
    v.set(x, St.groundY(x, y) + (h || 0), y).project(St.camera);
    return { x: (v.x + 1) * 0.5 * L.width, y: (1 - v.y) * 0.5 * L.height, near: 1 };
  };
  St.pixelsPerUnit = function (x, y) {
    return Math.abs(St.project(x + 50, y).x - St.project(x - 50, y).x) / 100;
  };

  // Stage position back to a map point, by finding where the view ray meets the ground.
  St.pick = function (sx, sy) {
    ray.setFromCamera({ x: (sx / L.width) * 2 - 1, y: 1 - (sy / L.height) * 2 }, St.camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    let h = 0, x = o.x, y = o.z;
    for (let i = 0; i < 4; i++) {
      const k = (h - o.y) / d.y;
      x = o.x + d.x * k;
      y = o.z + d.z * k;
      h = St.groundY(x, y);
    }
    return { x, y };
  };

  /* ---------- shared shader text ---------- */
  const NOISE = `
    float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
    }
    float fbm(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.1 + 7.0) * 0.3 + vnoise(p * 4.3 + 3.0) * 0.15; }
    float shoreAt(float y) { return 470.0 + 28.0 * sin(y * 0.012 + 1.0) + 12.0 * sin(y * 0.031); }`;
  St.NOISE = NOISE;

  /* ---------- terrain ---------- */
  const groundU = {
    uSand: { value: new THREE.Color() }, uSandDark: { value: new THREE.Color() }, uGround: { value: new THREE.Color() },
    uGroundDark: { value: new THREE.Color() }, uPath: { value: new THREE.Color() }, uBed: { value: new THREE.Color() },
    uRock: { value: new THREE.Color() }, uPathY: { value: 0 }, uShopY: { value: 0 }, uPathX: { value: 0 }, uShopX: { value: 0 }, uShop: { value: 0 }
  };
  function buildTerrain() {
    const geo = new THREE.PlaneGeometry(7200, 5800, St.low ? 220 : 400, St.low ? 180 : 320);
    geo.rotateX(-Math.PI / 2);
    geo.translate(700, 0, 360);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainY(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, envMapIntensity: 0 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, groundU);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vW;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvW = (modelMatrix * vec4(position, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>
          varying vec3 vW;
          uniform vec3 uSand, uSandDark, uGround, uGroundDark, uPath, uBed, uRock;
          uniform float uPathY, uShopY, uPathX, uShopX, uShop;
          ${NOISE}
          float surf(vec2 p) { return fbm(p * 0.09) * 0.7 + vnoise(p * 0.7) * 0.3; }`)
        .replace("#include <color_fragment>", `#include <color_fragment>
          vec2 P = vW.xz;
          float d = P.x - shoreAt(P.y);
          float n = fbm(P * 0.02), fine = vnoise(P * 0.55), grain = vnoise(P * 2.3);
          vec3 sand = mix(uSand, uSandDark, n * 0.75 + grain * 0.2);
          float wet = 1.0 - smoothstep(4.0, 42.0, d + (n - 0.5) * 18.0);
          sand = mix(sand, uSandDark * 0.62, wet * 0.75);
          float edge = 740.0 + 24.0 * sin(P.y * 0.018) + 10.0 * sin(P.y * 0.07);
          float inland = smoothstep(-18.0, 22.0, P.x - edge + (n - 0.5) * 70.0);
          vec3 grass = mix(uGroundDark, uGround, smoothstep(0.25, 0.75, fbm(P * 0.05)) * 0.7 + fine * 0.3);
          grass = mix(grass, vec3(dot(grass, vec3(0.3, 0.6, 0.1))) * vec3(1.0, 0.98, 0.72), 0.3) * (0.62 + grain * 0.3);
          vec3 col = mix(sand, grass, inland);
          float worn = max((1.0 - smoothstep(18.0, 34.0, abs(P.y - uPathY) + (n - 0.5) * 16.0)) * smoothstep(uPathX - 40.0, uPathX, P.x),
                           uShop * (1.0 - smoothstep(14.0, 28.0, abs(P.y - uShopY) + (n - 0.5) * 16.0)) * smoothstep(uShopX - 40.0, uShopX, P.x));
          col = mix(col, uPath * (0.82 + grain * 0.28), worn);
          col = mix(col, uRock * (0.8 + fine * 0.35), smoothstep(40.0, 150.0, vW.y + (n - 0.5) * 60.0) * 0.8);
          col = mix(col, uBed * (0.75 + fbm(P * 0.06) * 0.5), 1.0 - smoothstep(-5.0, 2.0, d));
          diffuseColor.rgb = col;`)
        .replace("#include <normal_fragment_maps>", St.low ? "#include <normal_fragment_maps>" : `#include <normal_fragment_maps>
          float b0 = surf(vW.xz), bx = surf(vW.xz + vec2(1.5, 0.0)), bz = surf(vW.xz + vec2(0.0, 1.5));
          normal = normalize(normal + (viewMatrix * vec4((b0 - bx) * 0.8, 0.0, (b0 - bz) * 0.8, 0.0)).xyz);`);
    };
    St.terrain = new THREE.Mesh(geo, mat);
    St.terrain.receiveShadow = true;
    St.scene.add(St.terrain);
  }

  /* ---------- water ---------- */
  const waterU = {
    uT: { value: 0 }, uDeep: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() },
    uFoam: { value: new THREE.Color() }, uSky: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() },
    uFog: { value: new THREE.Color() }, uFogFar: { value: 4000 }
  };
  function buildWater() {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: waterU,
      vertexShader: "varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: `
        varying vec3 vW;
        uniform float uT, uFogFar;
        uniform vec3 uDeep, uMid, uShallow, uFoam, uSky, uSunDir, uSunCol, uFog;
        ${NOISE}
        float wave(vec2 p) {
          return vnoise(p * 0.018 + uT * vec2(0.10, 0.07)) * 1.0
               + vnoise(p * 0.045 - uT * vec2(0.14, 0.05)) * 0.55
               + vnoise(p * 0.11 + uT * vec2(0.09, -0.16)) * 0.24
               + vnoise(p * 0.27 - uT * vec2(0.22, 0.13)) * 0.09;
        }
        void main() {
          vec2 P = vW.xz;
          float e = 1.4, w0 = wave(P);
          vec3 N = normalize(vec3((wave(P + vec2(e, 0.0)) - w0) * 1.5 / e * 10.0, 1.0, (wave(P + vec2(0.0, e)) - w0) * 1.5 / e * 10.0));
          vec3 V = normalize(cameraPosition - vW);
          float dist = length(cameraPosition - vW);
          float d = shoreAt(P.y) - P.x;
          vec3 body = mix(uShallow, uMid, smoothstep(10.0, 150.0, d));
          body = mix(body, uDeep, smoothstep(90.0, 460.0, d));
          float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          vec3 H = normalize(uSunDir + V);
          float spec = pow(max(dot(N, H), 0.0), 320.0) * 2.4 + pow(max(dot(N, H), 0.0), 40.0) * 0.1;
          vec3 col = mix(body, uSky, fres) + uSunCol * spec;
          // Waves breaking along the sand
          float surge = sin(uT * 0.9) * 7.0 + sin(P.y * 0.05 + uT * 1.4) * 3.0;
          float n = fbm(P * 0.09 + uT * 0.15);
          float line = 1.0 - smoothstep(0.0, 9.0, abs(d - 6.0 + surge + (n - 0.5) * 16.0));
          float line2 = 1.0 - smoothstep(0.0, 7.0, abs(d - 26.0 + surge * 1.4 + (n - 0.5) * 24.0));
          float foam = (line * 0.95 + line2 * 0.4) * smoothstep(0.26, 0.55, fbm(P * 0.24 - uT * 0.1));
          foam += (1.0 - smoothstep(-2.0, 7.0, d + surge)) * 0.7;
          col = mix(col, uFoam, clamp(foam, 0.0, 1.0));
          float alpha = mix(0.34, 0.72, smoothstep(0.0, 170.0, d));
          alpha = max(max(alpha, fres * 0.9), foam);
          alpha *= smoothstep(-16.0, 1.0, d + surge);
          col = mix(col, uFog, smoothstep(uFogFar * 0.55, uFogFar, dist));
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    const geo = new THREE.PlaneGeometry(11000, 9000);
    geo.rotateX(-Math.PI / 2);
    geo.translate(100, 0, 360);
    St.water = new THREE.Mesh(geo, mat);
    St.water.renderOrder = 2;
    St.scene.add(St.water);
  }

  /* ---------- per-place look ---------- */
  // Time of day and light for each place. Colours for land and sea come from its theme in levels.js.
  const SKIES = {
    palm: { sky: "#9fd2f2", fog: "#bfe3f5", sun: "#fff1d6", sunI: 3.4, hemi: 0.75, ground: "#a89878", dir: [-420, 900, 520], rock: "#7d7566", bed: "#c9b98c" },
    coral: { sky: "#f4a886", fog: "#f3b69a", sun: "#ffc08a", sunI: 3.0, hemi: 0.7, ground: "#8c6472", dir: [-800, 520, 340], rock: "#7c5a54", bed: "#d59a84" },
    pine: { sky: "#c6dcec", fog: "#d9e6ef", sun: "#f4f6ff", sunI: 2.3, hemi: 1.0, ground: "#a5b7c8", dir: [-480, 640, 560], rock: "#6d7780", bed: "#6d8ea3" }
  };
  St.applyTheme = function (T) {
    const S = SKIES[T.decor];
    groundU.uSand.value.set(T.sand);
    groundU.uSandDark.value.set(T.sandDark);
    groundU.uGround.value.set(T.ground);
    groundU.uGroundDark.value.set(T.groundDark);
    groundU.uPath.value.set(T.path);
    groundU.uBed.value.set(S.bed);
    groundU.uRock.value.set(S.rock);
    waterU.uDeep.value.set(T.deep);
    waterU.uMid.value.set(T.mid);
    waterU.uShallow.value.set(T.shallow);
    waterU.uFoam.value.set(T.foam);
    waterU.uSky.value.set(S.sky);
    waterU.uSunCol.value.set(S.sun);
    waterU.uFog.value.set(S.fog);
    St.sun.color.set(S.sun);
    St.sun.intensity = S.sunI;
    St.sunDir = S.dir;
    waterU.uSunDir.value.set(S.dir[0], S.dir[1], S.dir[2]).normalize();
    St.hemi.color.set(S.sky);
    St.hemi.groundColor.set(S.ground);
    St.hemi.intensity = S.hemi;
    St.scene.background = new THREE.Color(S.fog);
    St.scene.fog = new THREE.Fog(S.fog, 2600, 4400);
    waterU.uFogFar.value = 4400;
    St.setEnvironment(S);
  };

  // A soft sky for shiny things like wet fish, metal and glass to reflect.
  St.setEnvironment = function (S) {
    const pm = new THREE.PMREMGenerator(renderer);
    const env = new THREE.Scene();
    const top = new THREE.Color(S.sky), low = new THREE.Color(S.ground);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), new THREE.ShaderMaterial({
      side: THREE.BackSide, uniforms: { a: { value: top }, b: { value: low } },
      vertexShader: "varying vec3 p; void main() { p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "varying vec3 p; uniform vec3 a, b; void main() { gl_FragColor = vec4(mix(b, a * 1.3, smoothstep(-0.15, 0.25, normalize(p).y)), 1.0); }"
    }));
    env.add(dome);
    const rt = pm.fromScene(env, 0.02);
    if (St.scene.environment) St.scene.environment.dispose();
    St.scene.environment = rt.texture;
    St.scene.environmentIntensity = 0.55;
    pm.dispose();
    dome.geometry.dispose();
    dome.material.dispose();
  };

  St.render = function (t) {
    waterU.uT.value = t;
    groundU.uShop.value = G.s && G.s.fire ? 1 : 0;
    // The worn footpaths lead to wherever the stall and shop stand.
    groundU.uPathY.value = L.queue.y + 3;
    groundU.uPathX.value = L.queue.x - 110;
    groundU.uShopY.value = L.shopQueue.y + 28;
    groundU.uShopX.value = L.shopQueue.x - 90;
    renderer.render(St.scene, St.camera);
  };
})();
