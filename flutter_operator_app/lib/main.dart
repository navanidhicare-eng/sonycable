import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'firebase_options.dart';
import 'screens/dashboard_screen.dart';
import 'screens/login_screen.dart';
import 'services/auth_service.dart';
import 'theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const SonyCableOperatorApp());
}

class SonyCableOperatorApp extends StatefulWidget {
  const SonyCableOperatorApp({super.key});

  @override
  State<SonyCableOperatorApp> createState() => _SonyCableOperatorAppState();
}

class _SonyCableOperatorAppState extends State<SonyCableOperatorApp> {
  final AuthService _authService = AuthService();

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _authService,
      builder: (context, _) {
        return MaterialApp(
          title: 'Sony Cable Operator',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.lightTheme,
          home: _authService.isLoading
              ? const Scaffold(
                  backgroundColor: AppColors.background,
                  body: Center(
                    child: CircularProgressIndicator(color: AppColors.primary),
                  ),
                )
              : _authService.currentUser != null
                  ? DashboardScreen(authService: _authService)
                  : LoginScreen(authService: _authService),
        );
      },
    );
  }
}
