// ─── camera.js — Kamera AR background ─────────────────────
export class ARCamera {
  constructor(videoEl) {
    this.video      = videoEl;
    this.stream     = null;
    this.facing     = 'environment'; // rear camera default
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.facing,
          width:  { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      return true;
    } catch (err) {
      console.warn('Camera error:', err.name, err.message);
      return false;
    }
  }

  async flip() {
    this.stop();
    this.facing = this.facing === 'environment' ? 'user' : 'environment';
    return this.start();
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }
}
