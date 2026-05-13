// ─── app.js — ES Module ────────────────────────────────────
import { Scene3D }   from './Scene3D.js';
import { ARCamera }  from './camera.js';

class App {
  constructor() {
    this.scene3D     = null;
    this.arCamera    = null;
    this.activeIndex = null;
    this.arActive    = false;

    this._buildSidebar();
    this._setHintText();
    this._initLoading();
  }

  _setHintText() {
    const el = document.getElementById('hint-text');
    if (el) el.textContent = window.innerWidth <= 640
      ? '↓ Pilih kata di bawah'
      : '← Pilih kata dari daftar';
  }

  _buildSidebar() {
    const list = document.getElementById('word-list');
    DICTIONARY.forEach((entry, i) => {
      const item = document.createElement('div');
      item.className = 'word-item';
      item.innerHTML = `
        <span class="num">${String(i+1).padStart(2,'0')}</span>
        <span class="en">${entry.word}</span>
        <span class="id">${entry.translation}</span>
      `;
      item.addEventListener('click', () => this._selectWord(i));
      list.appendChild(item);
    });
  }

  _initLoading() {
    const loadingEl   = document.getElementById('loading');
    const letterEls   = document.querySelectorAll('#loading-letters span');
    const progressBar = document.getElementById('progress-bar');
    const progressLbl = document.getElementById('progress-label');
    const total       = letterEls.length;
    let lit = 0;

    const setProgress = (pct) => {
      const p = Math.min(Math.max(pct, 0), 1);
      progressBar.style.width = (p * 100).toFixed(1) + '%';
      progressLbl.textContent = Math.round(p * 100) + '%';
      const target = Math.floor(p * total);
      while (lit < target && lit < total) letterEls[lit++].classList.add('lit');
    };

    const litInterval = setInterval(() => setProgress((lit + 1) / total * 0.35), 55);

    const container = document.getElementById('canvas-container');
    this.scene3D = new Scene3D(container);

    this.scene3D.loadFont(
      (p) => { clearInterval(litInterval); setProgress(p); },
      ()  => {
        clearInterval(litInterval);
        setProgress(1);
        letterEls.forEach(el => el.classList.add('lit'));
        setTimeout(() => {
          loadingEl.classList.add('hidden');
          document.getElementById('hint').classList.remove('hidden');
          setTimeout(() => loadingEl.remove(), 700);
          this._initARButton();
        }, 500);
      }
    );
  }

  // ── AR Controls ───────────────────────────────────────────
  _initARButton() {
    const btnAR   = document.getElementById('btn-ar');
    const btnFlip = document.getElementById('btn-flip');

    btnAR.addEventListener('click', () => this._toggleAR());
    btnFlip.addEventListener('click', () => this._flipCamera());

    // Sembunyikan flip kalau device tidak support multiple camera
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      btnAR.style.display = 'none';
    }
  }

  async _toggleAR() {
    const btnAR    = document.getElementById('btn-ar');
    const btnFlip  = document.getElementById('btn-flip');
    const videoEl  = document.getElementById('ar-video');
    const app      = document.getElementById('app');

    if (!this.arActive) {
      // Start AR
      this.arCamera = new ARCamera(videoEl);
      const ok = await this.arCamera.start();

      if (!ok) {
        this._showARError();
        return;
      }

      this.arActive = true;
      app.classList.add('ar-mode');
      btnAR.classList.add('active');
      btnAR.querySelector('.btn-label').textContent = 'Stop AR';
      btnFlip.classList.remove('hidden');
    } else {
      // Stop AR
      this.arCamera.stop();
      this.arActive = false;
      app.classList.remove('ar-mode');
      btnAR.classList.remove('active');
      btnAR.querySelector('.btn-label').textContent = 'AR Mode';
      btnFlip.classList.add('hidden');
    }
  }

  async _flipCamera() {
    if (this.arCamera) await this.arCamera.flip();
  }

  _showARError() {
    const toast = document.getElementById('ar-toast');
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
  }

  // ── Word Selection ────────────────────────────────────────
  _selectWord(index) {
    if (this.activeIndex === index) return;
    document.querySelectorAll('.word-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.word-item')[index].classList.add('active');

    this.activeIndex = index;
    const entry = DICTIONARY[index];

    document.getElementById('hint').classList.add('hidden');
    this.scene3D.showWord(entry);

    const panel = document.getElementById('info-panel');
    panel.classList.remove('visible');
    setTimeout(() => {
      document.getElementById('panel-word-en').textContent    = entry.word;
      document.getElementById('panel-word-id').textContent    = entry.translation;
      document.getElementById('panel-definition').textContent = entry.definitionID;
      panel.classList.add('visible');
    }, 900);
  }
}

window.addEventListener('DOMContentLoaded', () => { window._app = new App(); });
