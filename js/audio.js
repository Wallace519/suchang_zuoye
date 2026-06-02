/**
 * Web Audio API 音效引擎
 * 合成所有交互音效，无需外部音频文件
 * 白噪音使用 AudioBufferSourceNode（非 ScriptProcessorNode）
 */
const AudioEngine = (() => {
  let audioContext = null;
  let audioEnabled = true;

  // ---------- BGM ----------
  let bgmAudio = null;
  let bgmEnabled = true;

  // ---------- Init & Unlock ----------
  function init() {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        audioContext.suspend();
      }
    } catch (e) {
      console.warn('Web Audio API not available:', e);
      audioContext = null;
    }

    // Load preference from localStorage
    const saved = localStorage.getItem('inkstone_audio_enabled');
    if (saved !== null) {
      audioEnabled = saved === 'true';
      updateToggleIcon();
    }

    // Init BGM
    initBgm();

    // Unlock on first user touch
    const unlock = () => {
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          // Play a silent short tone to fully activate
          playSilent();
        }).catch(() => {});
      }
      // Also try to start BGM on first interaction
      if (bgmAudio && bgmEnabled) {
        bgmAudio.play().catch(() => {});
      }
      document.body.removeEventListener('touchstart', unlock);
      document.body.removeEventListener('click', unlock);
    };
    document.body.addEventListener('touchstart', unlock, { once: false });
    document.body.addEventListener('click', unlock, { once: false });
  }

  // ---------- BGM Controls ----------
  function initBgm() {
    bgmAudio = document.getElementById('bgm-audio');
    if (!bgmAudio) return;

    bgmAudio.volume = 0.35;

    const saved = localStorage.getItem('inkstone_bgm_enabled');
    if (saved !== null) {
      bgmEnabled = saved === 'true';
    }

    updateMusicToggleIcon();

    if (bgmEnabled) {
      bgmAudio.play().catch(() => {
        // Autoplay blocked — will resume on first user interaction
      });
    }
  }

  function toggleBgm() {
    bgmEnabled = !bgmEnabled;
    localStorage.setItem('inkstone_bgm_enabled', bgmEnabled.toString());
    updateMusicToggleIcon();

    if (!bgmAudio) return;

    if (bgmEnabled) {
      bgmAudio.play().catch(() => {});
    } else {
      bgmAudio.pause();
    }
  }

  function isBgmEnabled() {
    return bgmEnabled;
  }

  function updateMusicToggleIcon() {
    const el = document.getElementById('music-toggle');
    if (el) {
      el.textContent = bgmEnabled ? '🎵' : '🔇';
    }
  }

  function playSilent() {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    gain.gain.setValueAtTime(0.0001, now);
    osc.start(now);
    osc.stop(now + 0.001);
  }

  // ---------- Core Synthesis ----------
  function playBeep(frequency, duration, type = 'sine', volume = 0.2) {
    if (!audioEnabled || !audioContext) return;
    try {
      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      // Silently ignore rapid-fire errors
    }
  }

  /**
   * White noise via AudioBufferSourceNode (modern, no ScriptProcessorNode)
   */
  function playNoise(duration, cutoff = 1000, volume = 0.1) {
    if (!audioEnabled || !audioContext) return;
    try {
      const now = audioContext.currentTime;
      const sampleRate = audioContext.sampleRate;
      const length = Math.floor(sampleRate * duration);
      const buffer = audioContext.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1);
      }

      const source = audioContext.createBufferSource();
      source.buffer = buffer;

      const filter = audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, now);

      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(audioContext.destination);

      source.start(now);
      source.stop(now + duration);
    } catch (e) {
      // Silently ignore
    }
  }

  // ---------- Event Sounds ----------
  function playDragStart() {
    playNoise(0.08, 2000, 0.05);
  }

  function playPlace() {
    playBeep(800, 0.12, 'sine', 0.15);
  }

  function playButton() {
    playBeep(400, 0.06, 'sine', 0.1);
  }

  function playSuccess() {
    playBeep(700, 0.12, 'sine', 0.2);
    setTimeout(() => playBeep(1200, 0.2, 'sine', 0.15), 80);
  }

  function playError() {
    playNoise(0.1, 800, 0.08);
  }

  function playComplete() {
    playBeep(523.25, 0.25, 'sine', 0.2);  // C5
    setTimeout(() => playBeep(659.25, 0.25, 'sine', 0.2), 300); // E5
    setTimeout(() => playBeep(783.99, 0.4, 'sine', 0.2), 600);  // G5
  }

  function playTestSound() {
    playBeep(600, 0.15, 'sine', 0.15);
  }

  // ---------- Toggle ----------
  function toggle() {
    audioEnabled = !audioEnabled;
    localStorage.setItem('inkstone_audio_enabled', audioEnabled.toString());
    updateToggleIcon();
    if (audioEnabled) {
      playTestSound();
    }
  }

  function updateToggleIcon() {
    const el = document.getElementById('sound-toggle');
    if (el) {
      el.textContent = audioEnabled ? '🔊' : '🔇';
    }
  }

  function isEnabled() {
    return audioEnabled;
  }

  // ---------- Public API ----------
  return {
    init,
    toggle,
    isEnabled,
    updateToggleIcon,
    toggleBgm,
    isBgmEnabled,
    updateMusicToggleIcon,
    playDragStart,
    playPlace,
    playButton,
    playSuccess,
    playError,
    playComplete,
    playTestSound
  };
})();
