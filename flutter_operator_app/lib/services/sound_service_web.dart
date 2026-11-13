// ignore: avoid_web_libraries_in_flutter
import 'dart:js' as js;
import 'package:flutter/services.dart';

void playSuccessSoundImpl() {
  try {
    SystemSound.play(SystemSoundType.click);

    js.context.callMethod('eval', [r'''
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const now = ctx.currentTime;
          const playTone = (freq, start, dur) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + start);
            gain.gain.setValueAtTime(0.01, now + start);
            gain.gain.exponentialRampToValueAtTime(0.35, now + start + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + start);
            osc.stop(now + start + dur);
          };
          // PhonePe ascending harmonic chime
          playTone(523.25, 0.00, 0.16); // C5
          playTone(659.25, 0.10, 0.16); // E5
          playTone(783.99, 0.20, 0.20); // G5
          playTone(1046.50, 0.30, 0.32); // C6
        }
      } catch (e) {}
    ''']);
  } catch (_) {
    SystemSound.play(SystemSoundType.click);
  }
}
