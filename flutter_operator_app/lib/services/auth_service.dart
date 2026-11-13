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
    _auth.authStateChanges().listen((user) async {
      if (user != null) {
        await fetchOperatorProfile(user.uid);
      } else {
        _currentOperator = null;
      }
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
          .get();

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
      debugPrint('Error fetching operator profile: $e');
    }
    return null;
  }

  Future<String?> login(String email, String password) async {
    try {
      _isLoading = true;
      notifyListeners();

      final credential = await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password.trim(),
      );

      final user = credential.user;
      if (user == null) return "Login failed: User not found";

      final profile = await fetchOperatorProfile(user.uid);
      if (profile == null) {
        // Maybe admin logged in or staff doc has different uid, check fallback
        return null; // allow login anyway
      }

      return null; // success
    } on FirebaseAuthException catch (e) {
      if (e.code == 'user-not-found' || e.code == 'wrong-password' || e.code == 'invalid-credential') {
        return "Invalid Email or Password.";
      }
      return e.message ?? "Login failed. Please check credentials.";
    } catch (e) {
      return "Login error: ${e.toString()}";
    } finally {
      _isLoading = false;
      notifyListeners();
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
