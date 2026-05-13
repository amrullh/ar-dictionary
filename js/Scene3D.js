// ─── Scene3D.js — ES Module ────────────────────────────────
import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/jsm/controls/OrbitControls.js';
import { FontLoader }    from '../vendor/jsm/loaders/FontLoader.js';
import { TextGeometry }  from '../vendor/jsm/geometries/TextGeometry.js';

export class Scene3D {
  constructor(container) {
    this.container    = container;
    this.letterMeshes = [];
    this.letterPool   = {};
    this.font         = null;
    this.currentWord  = null;
    this.isAnimating  = false;

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._startLoop();
    this._onResize();
    window.addEventListener('resize', () => this._onResize());
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true          // ← transparent canvas biar kamera keliatan
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);  // fully transparent
    this.renderer.shadowMap.enabled = false;   // matiin shadow (ringan di mobile)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    this.container.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    // Hapus fog & ground — tidak relevan di AR mode
  }

  _initCamera() {
    const w = this.container.clientWidth  || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance   = 4;
    this.controls.maxDistance   = 20;
    this.controls.target.set(0, 0, 0);
  }

  _initLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));

    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(5, 10, 5);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xd0eaff, 0.8);
    fill.position.set(-6, 4, -4);
    this.scene.add(fill);
  }

  _onResize() {
    const w = this.container.clientWidth  || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _startLoop() {
    const tick = () => {
      requestAnimationFrame(tick);
      this.controls.update();
      this._animateLetters();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  loadFont(onProgress, onDone) {
    const loader = new FontLoader();
    loader.load(
      './fonts/helvetiker_bold.typeface.json',
      (font) => {
        this.font = font;
        this._preloadAlphabet(onProgress);
        onDone();
      },
      (xhr) => { if (xhr.total > 0) onProgress(xhr.loaded / xhr.total * 0.5); },
      (err) => console.error('Font error:', err)
    );
  }

  _preloadAlphabet(onProgress) {
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((ch, i, arr) => {
      const geo = new TextGeometry(ch, {
        font: this.font, size: 1, height: 0.28, curveSegments: 5,
        bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.02, bevelSegments: 2
      });
      geo.computeBoundingBox();
      geo.center();
      this.letterPool[ch] = geo;
      onProgress(0.5 + (i + 1) / arr.length * 0.5);
    });
  }

  showWord(wordObj) {
    if (this.isAnimating) return;
    if (this.currentWord === wordObj.word) return;
    this.isAnimating = true;
    this.currentWord = wordObj.word;

    if (this.letterMeshes.length > 0) {
      this._scatterOut(() => this._assembleWord(wordObj));
    } else {
      this._assembleWord(wordObj);
    }
  }

  _assembleWord(wordObj) {
    const letters    = wordObj.word.split('');
    const spacing    = 1.18;
    const totalWidth = (letters.length - 1) * spacing;
    const accent     = new THREE.Color(wordObj.color || '#2563eb');
    const base       = new THREE.Color(0xffffff);

    letters.forEach((ch, i) => {
      const geo = this.letterPool[ch];
      if (!geo) return;

      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: i === 0 ? accent : base,
        roughness: 0.2,
        metalness: 0.4,
      }));

      mesh.userData.targetX = i * spacing - totalWidth / 2;
      mesh.userData.targetY = 0;
      mesh.userData.targetZ = 0;

      const angle  = Math.random() * Math.PI * 2;
      const radius = 8 + Math.random() * 6;
      mesh.position.set(Math.cos(angle) * radius, 3 + Math.random() * 5, Math.sin(angle) * radius * 0.3);
      mesh.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
      mesh.scale.setScalar(0.01);

      mesh.userData.startT   = performance.now() + i * 80;
      mesh.userData.duration = 700;
      mesh.userData.phase    = 'in';
      mesh.userData.startPos = mesh.position.clone();
      mesh.userData.startRot = { x: mesh.rotation.x, y: mesh.rotation.y, z: mesh.rotation.z };

      this.scene.add(mesh);
      this.letterMeshes.push(mesh);
    });

    setTimeout(() => { this.isAnimating = false; }, letters.length * 80 + 750);
  }

  _scatterOut(onDone) {
    const meshes = [...this.letterMeshes];
    this.letterMeshes = [];
    meshes.forEach(mesh => {
      const angle = Math.random() * Math.PI * 2;
      const dist  = 6 + Math.random() * 5;
      Object.assign(mesh.userData, {
        scatterX: Math.cos(angle) * dist,
        scatterY: -2 + Math.random() * 4,
        scatterZ: Math.sin(angle) * dist * 0.4,
        scatterStartT: performance.now(),
        scatterDuration: 400,
        phase: 'out'
      });
    });
    setTimeout(() => {
      meshes.forEach(m => { this.scene.remove(m); m.material.dispose(); });
      onDone();
    }, 450);
  }

  _animateLetters() {
    const now = performance.now();
    this.letterMeshes.forEach(mesh => {
      const d = mesh.userData;
      if (d.phase === 'in') {
        const t = Math.max(0, Math.min((now - d.startT) / d.duration, 1));
        const e = this._easeOutExpo(t);
        mesh.position.x = THREE.MathUtils.lerp(d.startPos.x, d.targetX, e);
        mesh.position.y = THREE.MathUtils.lerp(d.startPos.y, d.targetY, e);
        mesh.position.z = THREE.MathUtils.lerp(d.startPos.z, d.targetZ, e);
        mesh.rotation.x = THREE.MathUtils.lerp(d.startRot.x, 0, e);
        mesh.rotation.y = THREE.MathUtils.lerp(d.startRot.y, 0, e);
        mesh.rotation.z = THREE.MathUtils.lerp(d.startRot.z, 0, e);
        mesh.scale.setScalar(THREE.MathUtils.lerp(0.01, 1, e));
        if (t >= 1) d.phase = 'idle';
      }
      if (d.phase === 'out') {
        mesh.position.x += (d.scatterX - mesh.position.x) * 0.12;
        mesh.position.y += (d.scatterY - mesh.position.y) * 0.12;
        mesh.position.z += (d.scatterZ - mesh.position.z) * 0.12;
        mesh.rotation.x += 0.05; mesh.rotation.y += 0.07;
        const t = Math.min((now - d.scatterStartT) / d.scatterDuration, 1);
        mesh.scale.setScalar(Math.max(0, THREE.MathUtils.lerp(1, 0, this._easeInExpo(t))));
      }
      if (d.phase === 'idle') {
        mesh.position.y = d.targetY + Math.sin(now * 0.001 + d.targetX) * 0.06;
      }
    });
  }

  _easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  _easeInExpo(t)  { return t === 0 ? 0 : Math.pow(2, 10 * t - 10); }
}
