import 'sound_service_stub.dart'
    if (dart.library.html) 'sound_service_web.dart';

class SoundService {
  static void playSuccessSound() {
    try {
      playSuccessSoundImpl();
    } catch (_) {}
  }
}

