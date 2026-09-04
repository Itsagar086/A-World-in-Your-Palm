/* =============================================================================
 * Tiny World — 70-audio.js
 * Every sound in the game is synthesised at runtime: there are no audio files.
 *
 * Footsteps are a filtered noise burst plus a low sine "thud", tuned per biome
 * (a sandy step is long and bright, a stone step is short and hard). Wind is a
 * single looping brown-noise source whose low-pass corner moves with the
 * region. Discoveries are pentatonic chimes, so nothing can ever sound wrong.
 * ============================================================================= */
(function (global) {
  'use strict';

  var TW = global.TW;

  /** A pentatonic scale — one note per region, in region order. */
  var NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

  /** Per-region footstep and ambience character. */
  var GROUND = {
    mosswood:   { filter: 1700, duration: 0.105, level: 0.10,  thud: 125, wind: 0.010, air: 380 },
    honeyfield: { filter: 1450, duration: 0.080, level: 0.095, thud: 112, wind: 0.008, air: 320 },
    amberdunes: { filter: 2600, duration: 0.135, level: 0.105, thud: 82,  wind: 0.014, air: 230 },
    driftbay:   { filter: 2250, duration: 0.145, level: 0.100, thud: 78,  wind: 0.009, air: 500 },
    coralhollow:{ filter: 1800, duration: 0.160, level: 0.095, thud: 155, wind: 0.011, air: 540 },
    cinderpeak: { filter: 3400, duration: 0.045, level: 0.060, thud: 205, wind: 0.008, air: 135 },
    frostveil:  { filter: 3100, duration: 0.120, level: 0.095, thud: 155, wind: 0.011, air: 680 },
    glowgrove:  { filter: 1300, duration: 0.115, level: 0.090, thud: 138, wind: 0.012, air: 260 },
  };

  function createAudio() {
    var ctx = null;
    var master = null;      /* the single gain everything fades through */
    var bus = null;         /* pre-reverb mix bus */
    var windGain = null;
    var windFilter = null;
    var windSource = null;
    var noiseBuffer = null;

    var enabled = false;    /* the user's toggle */
    var unlocked = false;   /* the AudioContext has actually started */
    var paused = false;     /* tab hidden / dialog open */
    var disposed = false;
    var broken = false;     /* something threw; stay quiet rather than crash */
    var unlocking = null;
    var suspendTimer = null;

    var stepAccumulator = 0;
    var panFlip = 1;
    var lastChime = -Infinity;
    var lastJump = -Infinity;
    var live = new Set();
    var permanent = [];

    var doc = typeof document === 'undefined' ? null : document;
    var hidden = function () { return !!(doc && doc.hidden); };
    var shouldPlay = function () { return enabled && unlocked && !paused && !hidden() && !disposed && !broken; };
    var running = function () { return shouldPlay() && ctx && ctx.state === 'running'; };

    function clearSuspend() {
      if (suspendTimer !== null) {
        clearTimeout(suspendTimer);
        suspendTimer = null;
      }
    }

    function panic() {
      broken = true;
      enabled = false;
      stepAccumulator = 0;
      clearSuspend();
      try {
        if (master && ctx) {
          master.gain.cancelScheduledValues(ctx.currentTime);
          master.gain.setValueAtTime(0, ctx.currentTime);
        }
        if (ctx && ctx.state !== 'closed') ctx.suspend().catch(function () {});
      } catch (e) { /* nothing further we can do */ }
    }

    /* Fade the master gain toward where it should be, and park the context
     * when it has been silent for a moment. */
    function settle(immediate) {
      clearSuspend();
      if (!ctx || disposed || broken) return;
      try {
        var now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        if (shouldPlay()) {
          ctx.resume().then(function () {
            if (!shouldPlay() || ctx.state !== 'running') return;
            master.gain.setTargetAtTime(0.43, ctx.currentTime, 0.065);
          }).catch(panic);
        } else {
          master.gain.setTargetAtTime(0, now, 0.025);
          stepAccumulator = 0;
          var park = function () {
            suspendTimer = null;
            if (!ctx || shouldPlay() || ctx.state === 'closed') return;
            ctx.suspend().catch(panic);
          };
          if (immediate || hidden()) park();
          else suspendTimer = setTimeout(park, 100);
        }
      } catch (e) {
        panic();
      }
    }

    /** White or brown noise, generated once and reused. */
    function makeNoise(seconds, brown) {
      var length = Math.ceil(ctx.sampleRate * seconds);
      var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      var last = 0;
      for (var i = 0; i < length; i++) {
        var white = Math.random() * 2 - 1;
        if (brown) {
          last = (last + white * 0.035) / 1.025;
          data[i] = last * 3.5;
        } else {
          data[i] = white;
        }
      }
      return buffer;
    }

    function build() {
      var Ctor = global.AudioContext || global.webkitAudioContext;
      if (!Ctor) return false;
      ctx = new Ctor({ latencyHint: 'interactive' });

      master = ctx.createGain();
      master.gain.value = 0;
      bus = ctx.createGain();

      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 18;
      comp.ratio.value = 3;
      comp.attack.value = 0.008;
      comp.release.value = 0.18;

      bus.connect(comp);
      comp.connect(master);
      master.connect(ctx.destination);

      /* A short synthetic room, so footsteps have somewhere to land. */
      var convolver = ctx.createConvolver();
      var ir = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * 0.85), ctx.sampleRate);
      for (var c = 0; c < 2; c++) {
        var channel = ir.getChannelData(c);
        for (var i = 0; i < channel.length; i++) {
          channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / channel.length, 3.2) * 0.42;
        }
      }
      convolver.buffer = ir;
      var wet = ctx.createGain();
      wet.gain.value = 0.11;
      bus.connect(convolver);
      convolver.connect(wet);
      wet.connect(comp);

      noiseBuffer = makeNoise(2, false);

      /* the wind bed */
      windSource = ctx.createBufferSource();
      windSource.buffer = makeNoise(3, true);
      windSource.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 380;
      windFilter.Q.value = 0.4;
      var rumbleCut = ctx.createBiquadFilter();
      rumbleCut.type = 'highpass';
      rumbleCut.frequency.value = 65;
      windGain = ctx.createGain();
      windGain.gain.value = 0.006;
      windSource.connect(windFilter);
      windFilter.connect(rumbleCut);
      rumbleCut.connect(windGain);
      windGain.connect(master);

      permanent.push(bus, comp, convolver, wet, master, windSource, windFilter, rumbleCut, windGain);
      windSource.start();
      return true;
    }

    /* Browsers only allow audio to start inside a user gesture. */
    function unlock() {
      if (disposed || broken) return Promise.resolve(false);
      if (unlocked) { settle(); return Promise.resolve(true); }
      if (unlocking) return unlocking;
      if (global.navigator && global.navigator.userActivation && !global.navigator.userActivation.isActive) {
        return Promise.resolve(false);
      }
      unlocking = (async function () {
        try {
          if (!ctx && !build()) { panic(); return false; }
          await ctx.resume();
          if (disposed) return false;
          unlocked = ctx.state === 'running';
          if (!unlocked) { panic(); return false; }
          settle();
          return true;
        } catch (e) {
          panic();
          return false;
        } finally {
          unlocking = null;
        }
      })();
      return unlocking;
    }

    function setEnabled(on) {
      if (disposed || broken) return false;
      enabled = !!on;
      settle();
      return enabled;
    }

    function setPaused(on) {
      paused = !!on;
      settle(paused);
    }

    /* Voices clean themselves up so long sessions do not leak nodes. */
    function retire(source, chain) {
      live.add(source);
      source.onended = function () {
        live.delete(source);
        for (var i = 0; i < chain.length; i++) {
          try { chain[i].disconnect(); } catch (e) { /* already gone */ }
        }
      };
    }

    function panTo(node, pan, chain) {
      if (ctx.createStereoPanner) {
        var panner = ctx.createStereoPanner();
        panner.pan.value = pan;
        node.connect(panner);
        panner.connect(bus);
        chain.push(panner);
      } else {
        node.connect(bus);
      }
    }

    /** A single decaying oscillator note. */
    function tone(freq, at, duration, level, endFreq, type, pan) {
      var osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, at);
      osc.frequency.exponentialRampToValueAtTime(Math.max(35, endFreq === undefined ? freq : endFreq), at + duration * 0.7);
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(level, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      osc.connect(gain);
      var chain = [osc, gain];
      panTo(gain, pan || 0, chain);
      retire(osc, chain);
      osc.start(at);
      osc.stop(at + duration + 0.035);
    }

    /** A band-limited noise burst — the body of a footstep or a splash. */
    function burst(at, duration, level, cutoff, pan, highpass) {
      var src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      var low = ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.setValueAtTime(cutoff, at);
      low.frequency.exponentialRampToValueAtTime(Math.max(100, cutoff * 0.48), at + duration);
      low.Q.value = 0.5;
      var high = ctx.createBiquadFilter();
      high.type = 'highpass';
      high.frequency.value = highpass === undefined ? 180 : highpass;
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(level, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      src.connect(low);
      low.connect(high);
      high.connect(gain);
      var chain = [src, low, high, gain];
      panTo(gain, pan || 0, chain);
      retire(src, chain);
      src.start(at, Math.random() * Math.max(0.01, noiseBuffer.duration - duration - 0.05));
      src.stop(at + duration + 0.025);
    }

    function step(profile, swimming, speed) {
      var at = ctx.currentTime + 0.004;
      var variation = 0.88 + Math.random() * 0.22;
      panFlip *= -1;
      var pan = panFlip * 0.11;
      if (swimming) {
        burst(at, 0.2, 0.085 * variation, 2300, pan, 350);
        tone(290 + Math.random() * 95, at + 0.035, 0.105, 0.019, 145, 'sine', pan);
      } else {
        var weight = Math.min(1.25, 0.82 + speed * 0.08);
        burst(at, profile.duration, profile.level * variation * weight, profile.filter, pan);
        tone(profile.thud * variation, at, 0.075, 0.035 * weight, profile.thud * 0.58, 'sine', pan);
      }
    }

    /**
     * Per-frame. Advances the footstep timer and steers the wind bed.
     * @param {number} dt
     * @param {object} state { speed, swimming, biome }
     */
    function update(dt, state) {
      if (!running()) { stepAccumulator = 0; return; }
      try {
        state = state || {};
        var step_dt = Math.min(0.1, Math.max(0, Number.isFinite(dt) ? dt : 0));
        var speed = Math.max(0, Number.isFinite(state.speed) ? state.speed : 0);
        var biomeId = typeof state.biome === 'string' ? state.biome : state.biome && state.biome.id;
        var profile = GROUND[biomeId] || GROUND.mosswood;
        var now = ctx.currentTime;

        /* A slow double sine keeps the wind from sounding like a flat hiss. */
        var gust = 0.85 + 0.15 * Math.sin(now * 0.36) + 0.08 * Math.sin(now * 0.71);
        var nightLift = state.night ? 1.25 : 1;
        windGain.gain.setTargetAtTime(profile.wind * gust * nightLift, now, 1.2);
        windFilter.frequency.setTargetAtTime(profile.air, now, 1.5);

        if (speed < 0.12) { stepAccumulator = 0; return; }
        var swimming = !!state.swimming;
        var rate = swimming
          ? 0.95 + Math.min(speed, 4) * 0.16
          : 1.5 + Math.min(speed, 5) * 0.32;
        stepAccumulator += step_dt;
        if (stepAccumulator >= 1 / rate) {
          stepAccumulator %= 1 / rate;
          step(profile, swimming, speed);
        }
      } catch (e) {
        panic();
      }
    }

    /** A discovery chime. `fanfare` plays the full arpeggio. */
    function chime(index, fanfare) {
      if (!running()) return;
      try {
        var now = ctx.currentTime;
        if (now - lastChime < 0.15) return;
        lastChime = now;
        var note = NOTES[Number.isFinite(index) ? Math.abs(Math.floor(index)) % NOTES.length : 0];
        if (fanfare) {
          [261.63, 329.63, 392.0, 523.25].forEach(function (f, i) {
            tone(f, now + 0.02 + i * 0.095, 0.75, 0.07 - i * 0.006, f, 'sine', (i - 1.5) * 0.09);
          });
          tone(130.815, now + 0.02, 0.95, 0.033);
        } else {
          tone(note, now + 0.008, 0.43, 0.083);
          tone(note * 1.5, now + 0.1, 0.38, 0.041, note * 1.5, 'sine', 0.08);
          tone(note * 2, now + 0.008, 0.21, 0.011);
        }
      } catch (e) {
        panic();
      }
    }

    /** A soft shimmer for picking up a wisp. */
    function sparkle(index) {
      if (!running()) return;
      try {
        var now = ctx.currentTime;
        var note = NOTES[(Number.isFinite(index) ? index : 0) % NOTES.length] * 2;
        tone(note, now + 0.005, 0.3, 0.05, note * 1.02, 'triangle', 0.05);
        tone(note * 1.5, now + 0.06, 0.34, 0.03, note * 1.5, 'sine', -0.08);
      } catch (e) {
        panic();
      }
    }

    function jump() {
      if (!running()) return;
      try {
        var now = ctx.currentTime;
        if (now - lastJump < 0.18) return;
        lastJump = now;
        tone(170, now + 0.003, 0.145, 0.065, 285);
        burst(now + 0.003, 0.05, 0.023, 850, 0, 120);
      } catch (e) {
        panic();
      }
    }

    var onVisibility = function () { settle(hidden()); };
    if (doc) doc.addEventListener('visibilitychange', onVisibility);

    function dispose() {
      if (disposed) return;
      disposed = true;
      enabled = false;
      clearSuspend();
      if (doc) doc.removeEventListener('visibilitychange', onVisibility);
      try {
        if (master && ctx) {
          master.gain.cancelScheduledValues(ctx.currentTime);
          master.gain.setValueAtTime(0, ctx.currentTime);
        }
        live.forEach(function (s) { try { s.stop(); } catch (e) {} });
        live.clear();
        if (windSource) { try { windSource.stop(); } catch (e) {} }
        for (var i = 0; i < permanent.length; i++) {
          try { permanent[i].disconnect(); } catch (e) {}
        }
        if (ctx && ctx.state !== 'closed') ctx.close().catch(function () {});
      } catch (e) { /* going away anyway */ }
    }

    return {
      unlock: unlock,
      setEnabled: setEnabled,
      setPaused: setPaused,
      update: update,
      chime: chime,
      sparkle: sparkle,
      jump: jump,
      dispose: dispose,
      get enabled() { return enabled && !broken && !disposed; },
    };
  }

  TW.audio = { create: createAudio, NOTES: NOTES, GROUND: GROUND };
})(typeof window !== 'undefined' ? window : this);
