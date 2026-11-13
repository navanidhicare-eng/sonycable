import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:ota_update/ota_update.dart';
import '../theme/app_theme.dart';

class AppUpdateInfo {
  final String latestVersion;
  final int buildNumber;
  final String apkUrl;
  final String releaseNotes;
  final bool mandatory;

  AppUpdateInfo({
    required this.latestVersion,
    required this.buildNumber,
    required this.apkUrl,
    required this.releaseNotes,
    this.mandatory = false,
  });

  factory AppUpdateInfo.fromFirestore(DocumentSnapshot doc) {
    final data = (doc.data() as Map<String, dynamic>?) ?? {};
    return AppUpdateInfo(
      latestVersion: data['latestVersion']?.toString() ?? data['version']?.toString() ?? '1.0.0',
      buildNumber: (data['buildNumber'] is int)
          ? data['buildNumber'] as int
          : (int.tryParse(data['buildNumber']?.toString() ?? '0') ?? 0),
      apkUrl: data['apkUrl']?.toString() ?? '',
      releaseNotes: data['releaseNotes']?.toString() ?? 'Performance improvements and bug fixes.',
      mandatory: data['mandatory'] == true,
    );
  }
}

class UpdateService {
  static bool _isChecking = false;

  /// Check Firestore for an update
  static Future<AppUpdateInfo?> checkForUpdate() async {
    try {
      final doc = await FirebaseFirestore.instance.collection('app_config').doc('operator_app').get();
      if (!doc.exists) return null;

      final info = AppUpdateInfo.fromFirestore(doc);
      final packageInfo = await PackageInfo.fromPlatform();
      final int currentBuild = int.tryParse(packageInfo.buildNumber) ?? 1;

      // If remote build is higher, or remote version string differs
      if (info.buildNumber > currentBuild && info.apkUrl.isNotEmpty) {
        return info;
      }
      return null;
    } catch (e) {
      debugPrint("Error checking for update: $e");
      return null;
    }
  }

  /// Automatically check on app startup and prompt if update is available
  static Future<void> checkOnStartup(BuildContext context) async {
    if (kIsWeb) return; // In-app APK updates only apply to Android
    if (_isChecking) return;
    _isChecking = true;

    try {
      await Future.delayed(const Duration(seconds: 2)); // Wait for initial render
      final update = await checkForUpdate();
      if (update != null && context.mounted) {
        showUpdateDialog(context, update);
      }
    } finally {
      _isChecking = false;
    }
  }

  /// Manual check from drawer menu with feedback
  static Future<void> checkManually(BuildContext context) async {
    if (kIsWeb) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("You are on Web. Updates are applied automatically on refresh!"),
          backgroundColor: Color(0xFF059669),
        ),
      );
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text("Checking for updates..."),
        duration: Duration(seconds: 1),
      ),
    );

    final update = await checkForUpdate();
    if (!context.mounted) return;

    if (update != null) {
      showUpdateDialog(context, update);
    } else {
      final packageInfo = await PackageInfo.fromPlatform();
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          icon: const Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 48),
          title: const Text(
            "App is Up to Date",
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          ),
          content: Text(
            "You are using the latest version (${packageInfo.version}+${packageInfo.buildNumber}).",
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text("OK", style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary)),
            ),
          ],
        ),
      );
    }
  }

  /// Show the Update Popup Dialog with 1-Tap Download & Install
  static void showUpdateDialog(BuildContext context, AppUpdateInfo update) {
    showDialog(
      context: context,
      barrierDismissible: !update.mandatory,
      builder: (ctx) => _UpdateDialogContent(update: update),
    );
  }
}

class _UpdateDialogContent extends StatefulWidget {
  final AppUpdateInfo update;
  const _UpdateDialogContent({required this.update});

  @override
  State<_UpdateDialogContent> createState() => _UpdateDialogContentState();
}

class _UpdateDialogContentState extends State<_UpdateDialogContent> {
  bool _isDownloading = false;
  int _downloadProgress = 0;
  String _statusMessage = "";

  void _startOtaUpdate() {
    setState(() {
      _isDownloading = true;
      _downloadProgress = 0;
      _statusMessage = "Starting download...";
    });

    try {
      OtaUpdate()
          .execute(widget.update.apkUrl, destinationFilename: 'SonyCable_Operator.apk')
          .listen(
        (OtaEvent event) {
          if (!mounted) return;
          switch (event.status) {
            case OtaStatus.DOWNLOADING:
              final int progress = int.tryParse(event.value ?? '0') ?? 0;
              setState(() {
                _downloadProgress = progress;
                _statusMessage = "Downloading update: $progress%";
              });
              break;
            case OtaStatus.INSTALLING:
              setState(() {
                _statusMessage = "Installing update...";
              });
              break;
            case OtaStatus.ALREADY_RUNNING_ERROR:
              setState(() {
                _statusMessage = "Update is already in progress.";
              });
              break;
            case OtaStatus.PERMISSION_NOT_GRANTED_ERROR:
              setState(() {
                _isDownloading = false;
                _statusMessage = "Permission denied to install update.";
              });
              break;
            default:
              setState(() {
                _isDownloading = false;
                _statusMessage = "Update failed: ${event.status}";
              });
              break;
          }
        },
        onError: (e) {
          if (!mounted) return;
          setState(() {
            _isDownloading = false;
            _statusMessage = "Download error: $e";
          });
        },
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isDownloading = false;
        _statusMessage = "Error: $e";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF3C7),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.system_update_rounded, color: Color(0xFFD97706), size: 24),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "New Update Available!",
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.textPrimary),
                ),
                Text(
                  "Version ${widget.update.latestVersion} (Build ${widget.update.buildNumber})",
                  style: const TextStyle(fontSize: 12, color: Color(0xFF059669), fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "What's New in this update:",
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(12),
              width: double.infinity,
              decoration: BoxDecoration(
                color: AppColors.surfaceSecondary,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Text(
                widget.update.releaseNotes,
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
              ),
            ),
            if (_isDownloading) ...[
              const SizedBox(height: 16),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: LinearProgressIndicator(
                  value: _downloadProgress > 0 ? _downloadProgress / 100.0 : null,
                  minHeight: 8,
                  backgroundColor: const Color(0xFFE2E8F0),
                  color: const Color(0xFF10B981),
                ),
              ),
              const SizedBox(height: 8),
              Center(
                child: Text(
                  _statusMessage,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF059669)),
                ),
              ),
            ] else if (_statusMessage.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                _statusMessage,
                style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
              ),
            ],
          ],
        ),
      ),
      actions: [
        if (!widget.update.mandatory && !_isDownloading)
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Later", style: TextStyle(color: AppColors.textMuted)),
          ),
        ElevatedButton.icon(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF10B981),
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          ),
          onPressed: _isDownloading ? null : _startOtaUpdate,
          icon: _isDownloading
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
              : const Icon(Icons.download_rounded, size: 18),
          label: Text(
            _isDownloading ? "Updating..." : "Update Now",
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          ),
        ),
      ],
    );
  }
}

