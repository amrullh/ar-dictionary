// ─── Scene3D.js ────────────────────────────────────────────
// Manages Three.js scene, font loading, letter geometry pool,
// and word assembly/scatter animations.

class Scene3D {
  constructor(container) {
    this.container = container;
    this.letterMeshes = [];     // active letter meshes in scene
    this.letterPool = {};       // pre-built geometry per character
    this.font = null;
    this.currentWord = null;
    this.isAnimating = false;

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._initPostFX();
    this._startLoop();
    this._onResize();
    window.addEventListener('resize', () => this._onResize());
  }

  // ── Renderer ──────────────────────────────────────────────
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xf0ece2, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
  }

  // ── Scene ─────────────────────────────────────────────────
  _initScene() {
    this.scene = new THREE.Scene();
    // subtle fog
    this.scene.fog = new THREE.Fog(0xf0ece2, 18, 40);

    // Ground plane (receives shadow)
    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xe8e3d8,
      roughness: 1,
      metalness: 0
    });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -2.8;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
  }

  // ── Camera ────────────────────────────────────────────────
  _initCamera() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 1.5, 10);
    this.camera.lookAt(0, 0.5, 0);

    // Orbit (mouse drag)
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 20;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.target.set(0, 0.5, 0);
  }

  // ── Lights ────────────────────────────────────────────────
  _initLights() {
    // Ambient — bright daylight
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambient);

    // Key light (soft warm sun)
    const key = new THREE.DirectionalLight(0xfff5e0, 1.8);
    key.position.set(5, 10, 5);
    key.castShadow = true;
    key.shadow.mapSize.width = 1024;
    key.shadow.mapSize.height = 1024;
    this.scene.add(key);

    // Fill (sky blue)
    const fill = new THREE.DirectionalLight(0xd0eaff, 0.8);
    fill.position.set(-6, 4, -4);
    this.scene.add(fill);

    // Rim (soft bounce)
    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(0, -2, -8);
    this.scene.add(rim);
  }

  // ── Post FX placeholder (bloom via CSS) ──────────────────
  _initPostFX() {
    // Real bloom needs EffectComposer (optional upgrade).
    // For now we rely on the renderer's tonemapping.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
  }

  // ── Resize ────────────────────────────────────────────────
  _onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ── Render Loop ───────────────────────────────────────────
  _startLoop() {
    const tick = () => {
      requestAnimationFrame(tick);
      this.controls.update();
      this._animateLetters();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  // ── Font Loading ──────────────────────────────────────────
  loadFont(onProgress, onDone) {
    const loader = new THREE.FontLoader();
    loader.load(
      'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json',
      (font) => {
        this.font = font;
        this._preloadAlphabet(onProgress);
        onDone();
      },
      (xhr) => {
        if (onProgress) onProgress(xhr.loaded / xhr.total);
      }
    );
  }

  // Pre-build geometry for all 26 uppercase letters
  _preloadAlphabet(onProgress) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    letters.forEach((ch, i) => {
      const geo = new THREE.TextGeometry(ch, {
        font: this.font,
        size: 1,
        height: 0.28,
        curveSegments: 6,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.02,
        bevelSegments: 3
      });
      geo.computeBoundingBox();
      geo.center();
      this.letterPool[ch] = geo;
      if (onProgress) onProgress((i + 1) / letters.length);
    });
  }

  // ── Word Display ──────────────────────────────────────────
  showWord(wordObj) {
    if (this.isAnimating) return;
    if (this.currentWord === wordObj.word) return;

    this.isAnimating = true;
    this.currentWord = wordObj.word;

    const hasExisting = this.letterMeshes.length > 0;

    if (hasExisting) {
      this._scatterOut(() => this._assembleWord(wordObj));
    } else {
      this._assembleWord(wordObj);
    }
  }

  // Build and animate letters flying in
  _assembleWord(wordObj) {
    const letters = wordObj.word.split('');
    const spacing = 1.18;
    const totalWidth = (letters.length - 1) * spacing;

    const accentColor = new THREE.Color(wordObj.color || '#2563eb');
    const baseColor   = new THREE.Color(0x1e293b);

    letters.forEach((ch, i) => {
      const geo = this.letterPool[ch];
      if (!geo) return;

      const mat = new THREE.MeshStandardMaterial({
        color: i === 0 ? accentColor : baseColor,
        roughness: 0.15,
        metalness: 0.3,
        envMapIntensity: 1
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;

      // Final target position
      mesh.userData.targetX = i * spacing - totalWidth / 2;
      mesh.userData.targetY = 0;
      mesh.userData.targetZ = 0;

      // Start position: random burst from above/sides
      const angle = (Math.random() * Math.PI * 2);
      const radius = 8 + Math.random() * 6;
      mesh.position.set(
        Math.cos(angle) * radius,
        3 + Math.random() * 6,
        Math.sin(angle) * radius * 0.4 - 2
      );
      mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      mesh.scale.setScalar(0.01);

      // Stagger delay
      mesh.userData.delay   = i * 80;          // ms
      mesh.userData.startT  = performance.now() + i * 80;
      mesh.userData.duration = 700;
      mesh.userData.phase   = 'in';
      mesh.userData.startPos = mesh.position.clone();
      mesh.userData.startRot = mesh.rotation.clone();

      this.scene.add(mesh);
      this.letterMeshes.push(mesh);
    });

    // Mark animation done after last letter settles
    setTimeout(() => {
      this.isAnimating = false;
    }, letters.length * 80 + 750);
  }

  // Scatter existing letters out
  _scatterOut(onDone) {
    const meshes = [...this.letterMeshes];
    this.letterMeshes = [];

    meshes.forEach((mesh, i) => {
      const angle = Math.random() * Math.PI * 2;
      const dist  = 6 + Math.random() * 5;
      mesh.userData.scatterX = Math.cos(angle) * dist;
      mesh.userData.scatterY = -2 + Math.random() * 4;
      mesh.userData.scatterZ = Math.sin(angle) * dist * 0.4;
      mesh.userData.scatterStartT = performance.now();
      mesh.userData.scatterDuration = 400;
      mesh.userData.phase = 'out';
    });

    setTimeout(() => {
      meshes.forEach(m => {
        this.scene.remove(m);
        m.material.dispose();
      });
      onDone();
    }, 450);
  }

  // ── Per-frame Letter Animation ────────────────────────────
  _animateLetters() {
    const now = performance.now();

    this.letterMeshes.forEach(mesh => {
      if (mesh.userData.phase === 'in') {
        const elapsed = now - mesh.userData.startT;
        const t = Math.min(elapsed / mesh.userData.duration, 1);
        const e = this._easeOutExpo(t);

        // Position lerp
        mesh.position.x = THREE.MathUtils.lerp(mesh.userData.startPos.x, mesh.userData.targetX, e);
        mesh.position.y = THREE.MathUtils.lerp(mesh.userData.startPos.y, mesh.userData.targetY, e);
        mesh.position.z = THREE.MathUtils.lerp(mesh.userData.startPos.z, mesh.userData.targetZ, e);

        // Rotation settle to 0
        mesh.rotation.x = THREE.MathUtils.lerp(mesh.userData.startRot.x, 0, e);
        mesh.rotation.y = THREE.MathUtils.lerp(mesh.userData.startRot.y, 0, e);
        mesh.rotation.z = THREE.MathUtils.lerp(mesh.userData.startRot.z, 0, e);

        // Scale from tiny to 1
        const s = THREE.MathUtils.lerp(0.01, 1, e);
        mesh.scale.setScalar(s);

        if (t >= 1) mesh.userData.phase = 'idle';
      }

      if (mesh.userData.phase === 'out') {
        const elapsed = now - mesh.userData.scatterStartT;
        const t = Math.min(elapsed / mesh.userData.scatterDuration, 1);
        const e = this._easeInExpo(t);

        mesh.position.x += (mesh.userData.scatterX - mesh.position.x) * 0.12;
        mesh.position.y += (mesh.userData.scatterY - mesh.position.y) * 0.12;
        mesh.position.z += (mesh.userData.scatterZ - mesh.position.z) * 0.12;
        mesh.rotation.x += 0.05;
        mesh.rotation.y += 0.07;

        const s = Math.max(0, THREE.MathUtils.lerp(1, 0, e));
        mesh.scale.setScalar(s);
      }

      // Idle: gentle float
      if (mesh.userData.phase === 'idle') {
        mesh.position.y = mesh.userData.targetY + Math.sin(now * 0.001 + mesh.userData.targetX) * 0.06;
      }
    });
  }

  _easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  _easeInExpo(t) {
    return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
  }
}
