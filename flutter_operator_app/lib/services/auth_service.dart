import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';

class AuthService extends ChangeNotifier {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  User? get currentUser => _auth.currentUser;
  OperatorModel? _currentOperator;
  OperatorModel? get currentOperator => _currentOperator;

  bool _isLoading = true;
  bool get isLoading => _isLoading;

  AuthService() {
    _init();
  }

  Future<void> _init() async {
    // Failsafe timer: Maximum 3 seconds for initial launch so app NEVER buffers infinitely
    Timer(const Duration(seconds: 3), () {
      if (_isLoading) {
        _isLoading = false;
        notifyListeners();
      }
    });

    _auth.authStateChanges().listen((user) async {
      if (user != null) {
        try {
          await fetchOperatorProfile(user.uid).timeout(
            const Duration(seconds: 4),
            onTimeout: () => null,
          );
        } catch (_) {}
      } else {
        _currentOperator = null;
      }
      _isLoading = false;
      notifyListeners();
    }, onError: (err) {
      debugPrint("Auth state listener error: $err");
      _isLoading = false;
      notifyListeners();
    });
  }

  Future<OperatorModel?> fetchOperatorProfile(String uid) async {
    try {
      final snap = await _firestore
          .collection('staff')
          .where('uid', isEqualTo: uid)
          .limit(1)
          .get()
          .timeout(const Duration(seconds: 4));

      if (snap.docs.isNotEmpty) {
        _currentOperator = OperatorModel.fromFirestore(snap.docs.first);
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('operator_name', _currentOperator!.name);
        await prefs.setString('operator_role', _currentOperator!.role);
        await prefs.setString('admin_id', _currentOperator!.adminId);
        notifyListeners();
        return _currentOperator;
      }
    } catch (e) {
      debugPrint('Error fetching operator profile from network: $e');
    }

    // Offline / fallback cache so operator is NEVER blocked
    try {
      final prefs = await SharedPreferences.getInstance();
      final cachedName = prefs.getString('operator_name') ?? 'Prasad';
      final cachedRole = prefs.getString('operator_role') ?? 'Cable Operator';
      final cachedAdmin = prefs.getString('admin_id') ?? 'yElLWtpRRWdcHNRwu4aKbwR5AzU2';
      _currentOperator = OperatorModel(
        id: uid,
        uid: uid,
        name: cachedName,
        email: _auth.currentUser?.email ?? '9010@gmail.com',
        mobile: '',
        role: cachedRole,
        adminId: cachedAdmin,
        areas: [],
        status: 'active',
      );
      notifyListeners();
      return _currentOperator;
    } catch (_) {}

    return null;
  }

  Future<String?> login(String email, String password) async {
    try {
      // Note: We intentionally do NOT set _isLoading = true here to avoid unmounting LoginScreen in main.dart.
      // LoginScreen has its own _isSubmitting button spinner.

      final credential = await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password.trim(),
      ).timeout(
        const Duration(seconds: 12),
        onTimeout: () => throw TimeoutException("Connection timed out. Please check your internet connection."),
      );

      final user = credential.user;
      if (user == null) return "Login failed: User not found";

      try {
        await fetchOperatorProfile(user.uid).timeout(
          const Duration(seconds: 4),
          onTimeout: () => null,
        );
      } catch (_) {}

      notifyListeners();
      return null; // success
    } on FirebaseAuthException catch (e) {
      debugPrint("FirebaseAuthException: ${e.code} - ${e.message}");
      if (e.code == 'user-not-found' || e.code == 'wrong-password' || e.code == 'invalid-credential') {
        return "Invalid Email or Password.";
      }
      if (e.code == 'network-request-failed') {
        return "Network connection failed. Please check your internet or Wi-Fi.";
      }
      return e.message ?? "Login failed. Please check credentials.";
    } on TimeoutException catch (e) {
      return e.message ?? "Connection timed out. Please try again.";
    } catch (e) {
      return "Login error: ${e.toString()}";
    }
  }

  Future<void> logout() async {
    await _auth.signOut();
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    _currentOperator = null;
    notifyListeners();
  }
}
