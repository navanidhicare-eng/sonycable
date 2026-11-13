import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Default [FirebaseOptions] for use with your Sony Cable Firebase project.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        return android;
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyAO-uwNtzknX2sDQREZbdSO-BTL9ZuoLDc',
    appId: '1:519372037423:web:aa5618a6f79350546ed5da',
    messagingSenderId: '519372037423',
    projectId: 'sony-cable-network',
    authDomain: 'sony-cable-network.firebaseapp.com',
    storageBucket: 'sony-cable-network.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAO-uwNtzknX2sDQREZbdSO-BTL9ZuoLDc',
    appId: '1:519372037423:android:aa5618a6f79350546ed5da',
    messagingSenderId: '519372037423',
    projectId: 'sony-cable-network',
    storageBucket: 'sony-cable-network.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyAO-uwNtzknX2sDQREZbdSO-BTL9ZuoLDc',
    appId: '1:519372037423:ios:aa5618a6f79350546ed5da',
    messagingSenderId: '519372037423',
    projectId: 'sony-cable-network',
    storageBucket: 'sony-cable-network.firebasestorage.app',
  );
}
