// ─── App.js ────────────────────────────────────────────────

class App {
  constructor() {
    this.scene3D   = null;
    this.activeIndex = null;

    this._buildSidebar();
    this._initLoading();
    this._setHintText();
  }

  // ── Detect mobile for hint text ───────────────────────────
  _setHintText() {
    const isMobile = window.innerWidth <= 640;
    const hint = document.getElementById('hint-text');
    if (hint) hint.textContent = isMobile ? '↓ Pilih kata di bawah' : '← Pilih kata dari daftar';
  }

  // ── Sidebar / bottom list ─────────────────────────────────
  _buildSidebar() {
    const list = document.getElementById('word-list');
    list.innerHTML = '';

    DICTIONARY.forEach((entry, i) => {
      const item = document.createElement('div');
      item.className = 'word-item';
      item.dataset.index = i;
      item.innerHTML = `
        <span class="num">${String(i + 1).padStart(2, '0')}</span>
        <span class="en">${entry.word}</span>
        <span class="id">${entry.translation}</span>
      `;
      item.addEventListener('click', () => this._selectWord(i));
      list.appendChild(item);
    });
  }

  // ── Loading + progress bar ────────────────────────────────
  _initLoading() {
    const loadingEl  = document.getElementById('loading');
    const letterEls  = document.querySelectorAll('#loading-letters span');
    const progressBar = document.getElementById('progress-bar');
    const progressLbl = document.getElementById('progress-label');
    const total       = letterEls.length; // 26
    let lit = 0;

    const setProgress = (pct) => {
      const p = Math.min(Math.max(pct, 0), 1);
      progressBar.style.width = (p * 100).toFixed(1) + '%';
      progressLbl.textContent  = Math.round(p * 100) + '%';

      // light up letters proportionally
      const target = Math.floor(p * total);
      while (lit < target && lit < total) {
        letterEls[lit].classList.add('lit');
        lit++;
      }
    };

    // Animate letters even before font arrives (UX feel)
    const litInterval = setInterval(() => {
      if (lit < total) setProgress((lit + 1) / total * 0.4); // max 40% before font load
    }, 55);

    // Init 3D scene
    const container = document.getElementById('canvas-container');
    this.scene3D = new Scene3D(container);

    this.scene3D.loadFont(
      (progress) => {
        clearInterval(litInterval);
        // font download = 40-80%, geometry preload = 80-100%
        setProgress(0.4 + progress * 0.6);
      },
      () => {
        clearInterval(litInterval);
        setProgress(1);
        letterEls.forEach(el => el.classList.add('lit'));

        setTimeout(() => {
          loadingEl.classList.add('hidden');
          document.getElementById('hint').classList.remove('hidden');
          setTimeout(() => loadingEl.remove(), 700);
        }, 500);
      }
    );
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
      document.getElementById('panel-word-en').textContent  = entry.word;
      document.getElementById('panel-word-id').textContent  = entry.translation;
      document.getElementById('panel-definition').textContent = entry.definitionID;
      panel.classList.add('visible');
    }, 900);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window._app = new App();
});
