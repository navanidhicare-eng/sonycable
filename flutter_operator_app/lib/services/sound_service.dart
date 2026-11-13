import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'sound_service_stub.dart'
    if (dart.library.html) 'sound_service_web.dart';

class SoundService {
  static AudioPlayer? _player;

  static AudioPlayer get _audioPlayer {
    _player ??= AudioPlayer();
    return _player!;
  }

  static void playSuccessSound() {
    try {
      // 1. Strong haptic feedback on mobile
      HapticFeedback.heavyImpact();

      // 2. Play audible PhonePe chime using audioplayers (works natively on Android & iOS)
      _audioPlayer.stop(); // Stop previous if rapid taps
      _audioPlayer.play(
        AssetSource('sounds/success.wav'),
        volume: 1.0,
        mode: PlayerMode.lowLatency,
      );

      // 3. Web audio synthesizer fallback for Flutter web
      if (kIsWeb) {
        try {
          playSuccessSoundImpl();
        } catch (_) {}
      }
    } catch (e) {
      debugPrint("SoundService error: $e");
      try {
        SystemSound.play(SystemSoundType.click);
      } catch (_) {}
    }
  }
}
