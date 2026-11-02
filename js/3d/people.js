/* The people: rigged human models (Quaternius, CC0) with real walking and working animations.
   The models come undressed, so the shader dresses them. It colours each part of the body as
   shirt, trousers or boots from the look in art.js, and drops the skin detail under the cloth. */
(function () {
  const People = (CTC.people = { ready: false });
  const HEIGHT = 66; // About 1.8 metres on the game's scale.
  const FEMALE_HAIR = ["Hair_Long", "Hair_Buns"];
  const bodies = {}, hairs = {};
  let clips = {};

  function parse(key) {
    const bytes = Uint8Array.from(atob(CTC.PEOPLE_DATA[key]), (c) => c.charCodeAt(0));
    return new Promise((resolve, reject) => new THREE.GLTFLoader().parse(bytes.buffer, "", resolve, reject));
  }

  // Where the clothes stop, measured from the bones of each body so they fit both models.
  function measure(mesh) {
    const at = {};
    mesh.skeleton.bones.forEach((b, i) => {
      at[b.name] = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(mesh.skeleton.boneInverses[i]).invert());
    });
    const spine = at.spine_01, head = at.Head, neck = at.neck_01;
    return {
      at,
      cuts: new THREE.Vector4(spine.y + (at.spine_02.y - spine.y) * 0.1, neck.y + (head.y - neck.y) * 0.05, Math.abs(at.lowerarm_l.x), at.foot_l.y + (at.calf_l.y - at.foot_l.y) * 0.2),
      legX: Math.abs(at.thigh_l.x),
      unit: head.y
    };
  }

  People.load = async function () {
    const [male, female, anim] = await Promise.all([parse("male"), parse("female"), parse("clips")]);
    [["male", male], ["female", female]].forEach(([k, g]) => {
      const meshes = [];
      g.scene.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
      const body = meshes.find((m) => /Superhero/.test(m.material.name));
      bodies[k] = { scene: g.scene, ...measure(body) };
    });
    anim.animations.forEach((c) => {
      c.tracks = c.tracks.filter((t) => !t.name.startsWith("root."));
      clips[c.name] = c;
    });
    await Promise.all(["Hair_SimpleParted", "Hair_Buzzed", "Hair_Beard", "Hair_Long", "Hair_Buns"].map(async (k) => {
      const g = await parse(k);
      g.scene.traverse((o) => { if (o.isSkinnedMesh) hairs[k] = o; });
    }));
    People.ready = true;
  };

  /* ---------- clothes ---------- */
  function dress(mat, look, fit) {
    const cloth = {
      uShirt: { value: new THREE.Color(look.shirt) }, uPants: { value: new THREE.Color(look.pants) },
      uBoots: { value: new THREE.Color(look.boots || "#3b2a1e") }, uApron: { value: new THREE.Color(look.apron || "#000") },
      uHasApron: { value: look.apron ? 1 : 0 }, uCuts: { value: fit.cuts }, uPuff: { value: fit.unit * 0.014 }, uLegX: { value: fit.legX }
    };
    mat.color.set(look.skin).lerp(new THREE.Color("#ffffff"), 0.15).multiplyScalar(1.35);
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, cloth);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", `#include <common>
          varying vec3 vRest;
          uniform vec4 uCuts; uniform float uPuff, uLegX;`)
        // Everyday builds rather than athletes: slimmer legs. Clothes also sit a little off the
        // skin, which softens the muscles under them.
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          vRest = position;
          float covered = (abs(position.x) < uCuts.z && position.y < uCuts.y) ? 1.0 : 0.0;
          float leg = 1.0 - smoothstep(uCuts.x * 0.86, uCuts.x, position.y);
          transformed.x = mix(transformed.x, sign(position.x) * (uLegX + (abs(position.x) - uLegX) * 0.8), leg);
          transformed.z *= mix(1.0, 0.84, leg);
          transformed += objectNormal * uPuff * covered;`);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>
          varying vec3 vRest;
          uniform vec3 uShirt, uPants, uBoots, uApron; uniform vec4 uCuts; uniform float uHasApron;
          float clothMask; float weave;`)
        .replace("#include <color_fragment>", `#include <color_fragment>
          float ax = abs(vRest.x);
          float shirt = step(uCuts.x, vRest.y) * step(vRest.y, uCuts.y) * step(ax, uCuts.z);
          float pants = step(vRest.y, uCuts.x) * step(uCuts.w, vRest.y);
          float boots = step(vRest.y, uCuts.w);
          clothMask = max(max(shirt, pants), boots);
          float scale = 1.0 / uCuts.y;
          weave = ${CTC.stage.android ? "0.5" : "sin(vRest.y * scale * 900.0) * sin((vRest.x + vRest.z) * scale * 900.0) * 0.5 + 0.5"};
          float folds = 0.86 + 0.14 * sin(vRest.y * scale * 46.0 + sin(vRest.x * scale * 30.0) * 2.0);
          vec3 fabric = uShirt * shirt + uPants * pants + uBoots * boots;
          // Belt, trouser cuff and a dark sole
          float band = 1.0 - smoothstep(0.0, 0.014, abs(vRest.y - uCuts.x) * scale);
          fabric = mix(fabric, vec3(0.05, 0.035, 0.025), band);
          float soleY = uCuts.w * 0.22;
          fabric *= mix(1.0, 0.45, boots * step(vRest.y, soleY));
          if (uHasApron > 0.5) {
            float front = smoothstep(0.0, 0.03, vRest.z * scale);
            float inArea = step(ax * scale, 0.075 + 0.03 * step(vRest.y, uCuts.x * 1.04)) * step(uCuts.x * 0.76, vRest.y) * step(vRest.y, uCuts.y * 0.9);
            fabric = mix(fabric, uApron, front * inArea);
          }
          diffuseColor.rgb = mix(diffuseColor.rgb, fabric * folds * (0.92 + weave * 0.08), clothMask);`)
        .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
          normal = normalize(mix(normal, nonPerturbedNormal, clothMask));`)
        .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
          roughnessFactor = mix(max(roughnessFactor, 0.55), 0.92, clothMask);`);
    };
    mat.customProgramCacheKey = () => "dressed";
  }

  /* ---------- props people hold or wear ---------- */
  function strawHat(look) {
    const straw = new THREE.MeshStandardMaterial({ color: look.hat, roughness: 0.9 });
    const hat = new THREE.Group();
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.17, 0.012, 24), straw);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.085, 20), straw);
    crown.position.y = 0.045;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.102, 0.022, 20), new THREE.MeshStandardMaterial({ color: look.hatBand || "#c0392b", roughness: 0.8 }));
    band.position.y = 0.018;
    hat.add(brim, crown, band);
    hat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return hat;
  }

  function backBasket() {
    const wicker = new THREE.MeshStandardMaterial({ color: "#a97c45", roughness: 0.95 });
    const b = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.34, 14, 1, true), wicker);
    shell.material.side = THREE.DoubleSide;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.12, 14), wicker);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.17;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 8, 20), new THREE.MeshStandardMaterial({ color: "#7c5230", roughness: 0.9 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.17;
    b.add(shell, floor, rim);
    b.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return b;
  }

  function axe() {
    const a = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.62, 8), new THREE.MeshStandardMaterial({ color: "#7c5230", roughness: 0.8 }));
    handle.position.y = 0.22;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.026), new THREE.MeshStandardMaterial({ color: "#aab3bb", metalness: 0.8, roughness: 0.35 }));
    head.position.set(0.05, 0.48, 0);
    a.add(handle, head);
    a.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return a;
  }

  // Fixes a prop to a bone, given where it should be while the body is in its resting pose.
  function attach(root, boneName, fit, prop, x, y, z, rot) {
    let bone = null;
    root.traverse((o) => { if (o.isBone && o.name === boneName) bone = o; });
    const rest = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]))), new THREE.Vector3(1, 1, 1));
    const boneRest = new THREE.Matrix4().compose(fit.at[boneName], fit.restQ[boneName], new THREE.Vector3(1, 1, 1));
    new THREE.Matrix4().copy(boneRest).invert().multiply(rest).decompose(prop.position, prop.quaternion, prop.scale);
    prop.scale.setScalar(1);
    bone.add(prop);
    return bone;
  }

  function restRotations(fit, meshBones, inverses) {
    fit.restQ = {};
    meshBones.forEach((b, i) => {
      const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
      new THREE.Matrix4().copy(inverses[i]).invert().decompose(p, q, s);
      fit.restQ[b.name] = q;
    });
  }

  function addHair(root, key, color, bones) {
    const src = hairs[key];
    const mat = src.material.clone();
    mat.color.set(color).multiplyScalar(2.4);
    mat.side = THREE.DoubleSide;
    if (CTC.stage.android) { mat.normalMap = null; mat.roughnessMap = null; mat.roughness = 0.85; }
    const mesh = new THREE.SkinnedMesh(src.geometry, mat);
    mesh.castShadow = !CTC.stage.android; // On Android a body casts no shadow, so its hair mustn't either.
    const skel = new THREE.Skeleton(src.skeleton.bones.map((b) => bones[b.name]), src.skeleton.boneInverses);
    root.add(mesh);
    mesh.bind(skel, src.bindMatrix);
    return mesh;
  }

  /* ---------- making a person ---------- */
  // look.style picks the figure: 0 short hair, 1 long hair, 2 hair in a bun.
  People.make = function (look, opts) {
    const female = look.style === 1 || look.style === 2;
    const src = bodies[female ? "female" : "male"];
    const fit = src;
    const root = THREE.cloneSkinned(src.scene);
    const bones = {};
    root.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
      if (o.isSkinnedMesh) {
        // Phones draw a shadow for the player only, to keep a busy town smooth.
        o.castShadow = !CTC.stage.low || !!(opts && opts.basket);
        o.frustumCulled = false;
        o.material = o.material.clone();
        // Fine surface detail sparkles on figures this small when they move, and Android phones show it most.
        if (CTC.stage.android) {
          o.material.normalMap = null;
          o.material.roughnessMap = null;
          o.material.roughness = 0.85;
        }
        if (/Superhero/.test(o.material.name)) {
          dress(o.material, look, fit);
          if (!fit.restQ) restRotations(fit, o.skeleton.bones, o.skeleton.boneInverses);
        } else if (/Hair/.test(o.material.name)) {
          o.material.color.set(look.hair).multiplyScalar(2.4);
        }
      }
    });
    if (look.hair) {
      const key = female ? FEMALE_HAIR[look.style - 1] : look.hat ? "Hair_Buzzed" : "Hair_SimpleParted";
      addHair(root, key, look.hair, bones);
      if (!female && look.beard) addHair(root, "Hair_Beard", look.hair, bones);
    }
    const u = fit.unit / 1.72; // Models are about 1.72 tall to the head bone, whatever their file's units.
    if (look.hat) attach(root, "Head", fit, withScale(strawHat(look), u), 0, fit.at.Head.y + 0.19 * u, fit.at.Head.z + 0.01 * u);
    const a = {
      group: new THREE.Group(), root, mixer: new THREE.AnimationMixer(root), action: null, name: "",
      bones, yaw: 0, y: null, seen: 0, basket: null, axe: null, look
    };
    if (opts && opts.basket) a.basket = attach(root, "spine_03", fit, a.basketMesh = withScale(backBasket(), u * 0.8), 0, fit.at.spine_03.y - 0.02 * u, fit.at.spine_03.z - 0.19 * u, [-0.12, 0, 0]);
    if (opts && opts.axe) {
      a.axeMesh = withScale(axe(), u);
      attach(root, "hand_r", fit, a.axeMesh, fit.at.hand_r.x, fit.at.hand_r.y, fit.at.hand_r.z, [1.45, 0, -0.2]);
      a.axeMesh.visible = false;
    }
    const size = (HEIGHT / (fit.unit * 1.065)) * (look.scale || 1);
    root.scale.multiplyScalar(size / rootScale(root));
    a.group.add(root);
    People.play(a, "Idle_Loop");
    a.mixer.update(Math.random() * 3);
    return a;
  };

  function withScale(g, u) {
    const w = new THREE.Group();
    g.scale.setScalar(u);
    w.add(g);
    w.scaleLock = u;
    return w;
  }
  const rootScale = (r) => r.scale.x;

  People.play = function (a, name, speed) {
    if (a.name !== name) {
      const next = a.mixer.clipAction(clips[name]);
      next.reset().play();
      if (a.action) a.action.crossFadeTo(next, 0.18, false);
      a.action = next;
      a.name = name;
    }
    a.action.timeScale = speed || 1;
  };

  People.dispose = function (a) {
    a.mixer.stopAllAction();
    a.root.traverse((o) => { if (o.isSkinnedMesh) { o.material.dispose(); o.skeleton.dispose(); } });
    a.group.removeFromParent();
  };

  // World position of a bone, for things like the fish in a back basket.
  People.boneAt = function (a, name, out) { return a.bones[name].getWorldPosition(out); };
})();
