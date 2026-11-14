import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/nxt_digital_service.dart';
import '../theme/app_theme.dart';

class NxtDigitalModals {
  static final AudioPlayer _audioPlayer = AudioPlayer();

  static void _playChime() {
    try {
      _audioPlayer.play(AssetSource('audio/phonepe_chime.mp3')).catchError((_) {});
    } catch (_) {}
  }

  /// 1. Configure NXT Digital Credentials Modal
  static Future<void> showSettingsModal(BuildContext context) async {
    final creds = await NxtDigitalService.getCredentials();
    final userController = TextEditingController(text: creds['username']);
    final passController = TextEditingController(text: creds['password']);

    bool isTesting = false;
    String? testStatusMessage;
    bool? testStatusSuccess;

    if (!context.mounted) return;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          return Padding(
            padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
            child: Container(
              padding: const EdgeInsets.all(22),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.satellite_alt_rounded, color: Color(0xFF2563EB), size: 24),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "NXT Digital LCO Integration",
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.textPrimary),
                              ),
                              Text(
                                "Configure your portal login for 1-click STB refresh",
                                style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded, color: AppColors.textMuted),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                    const Divider(height: 24),

                    // User Name Field
                    const Text(
                      "NXT User Name / LCO Code",
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: userController,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: "e.g. LCO200031285.04",
                        hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                        prefixIcon: const Icon(Icons.person_outline_rounded, color: AppColors.primary, size: 20),
                        filled: true,
                        fillColor: AppColors.inputBg,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Password Field
                    const Text(
                      "NXT Portal Password",
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: passController,
                      obscureText: true,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: "Enter portal password",
                        hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                        prefixIcon: const Icon(Icons.lock_outline_rounded, color: AppColors.primary, size: 20),
                        filled: true,
                        fillColor: AppColors.inputBg,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Test Status Feedback Banner
                    if (testStatusMessage != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: testStatusSuccess == true ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: testStatusSuccess == true ? const Color(0xFFA7F3D0) : const Color(0xFFFECACA)),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              testStatusSuccess == true ? Icons.check_circle_rounded : Icons.error_outline_rounded,
                              color: testStatusSuccess == true ? const Color(0xFF059669) : const Color(0xFFDC2626),
                              size: 20,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                testStatusMessage!,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: testStatusSuccess == true ? const Color(0xFF065F46) : const Color(0xFF991B1B),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                    // Action Buttons: Test & Save
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 13),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            icon: isTesting
                                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                                : const Icon(Icons.bolt_rounded, size: 18),
                            label: Text(isTesting ? "Testing..." : "Test Connection"),
                            onPressed: isTesting
                                ? null
                                : () async {
                                    setModalState(() {
                                      isTesting = true;
                                      testStatusMessage = null;
                                    });

                                    final res = await NxtDigitalService.login(
                                      username: userController.text.trim(),
                                      password: passController.text.trim(),
                                    );

                                    setModalState(() {
                                      isTesting = false;
                                      testStatusSuccess = res.isSuccess;
                                      if (res.isSuccess) {
                                        testStatusMessage = "Connection Successful!\nLCO: ${res.operatorName} • Balance: ₹${res.balance}";
                                      } else {
                                        testStatusMessage = "Login Failed: ${res.error}";
                                      }
                                    });
                                  },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 13),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            icon: const Icon(Icons.save_rounded, size: 18),
                            label: const Text("Save Login", style: TextStyle(fontWeight: FontWeight.bold)),
                            onPressed: () async {
                              await NxtDigitalService.saveCredentials(
                                userController.text.trim(),
                                passController.text.trim(),
                              );
                              if (context.mounted) {
                                Navigator.pop(context);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text("NXT Digital Credentials Saved!"),
                                    backgroundColor: Color(0xFF059669),
                                  ),
                                );
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  /// 2. 1-Click STB Refresh Execution Dialog
  static Future<void> showRetrackModal(
    BuildContext context, {
    required String deviceId,
    required String customerName,
  }) async {
    final cleanId = deviceId.trim();
    if (cleanId.isEmpty || cleanId == '0' || cleanId.toLowerCase() == 'null') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("No valid STB or VC Number assigned to this customer."),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    // Check credentials first
    final hasCreds = await NxtDigitalService.hasCredentials();
    if (!hasCreds) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Please configure your NXT Digital Username & Password first."),
          backgroundColor: Color(0xFFD97706),
        ),
      );
      await showSettingsModal(context);
      return;
    }

    if (!context.mounted) return;

    // Show Progress Sheet & Trigger API
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _RetrackExecutionSheet(
        deviceId: cleanId,
        customerName: customerName,
      ),
    );
  }

  /// 3. STB Locator / Track STB Modal
  static Future<void> showLocatorModal(BuildContext context, {String? initialDeviceId}) async {
    final controller = TextEditingController(text: initialDeviceId ?? '');
    bool isSearching = false;
    NxtTrackResult? result;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          return Padding(
            padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
            child: Container(
              padding: const EdgeInsets.all(22),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.travel_explore_rounded, color: Color(0xFF2563EB), size: 24),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "STB Locator & Track",
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.textPrimary),
                              ),
                              Text(
                                "Track STB Box / Smartcard mapping in NXT Digital",
                                style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded, color: AppColors.textMuted),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                    const Divider(height: 24),

                    // Input Box
                    TextField(
                      controller: controller,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: "Enter STB ID or VC Number...",
                        prefixIcon: const Icon(Icons.search_rounded, color: AppColors.primary),
                        suffixIcon: IconButton(
                          icon: const Icon(Icons.clear_rounded, size: 18),
                          onPressed: () => setModalState(() {
                            controller.clear();
                            result = null;
                          }),
                        ),
                        filled: true,
                        fillColor: AppColors.inputBg,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                      ),
                    ),
                    const SizedBox(height: 12),

                    SizedBox(
                      width: double.infinity,
                      height: 46,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        icon: isSearching
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Icon(Icons.my_location_rounded, size: 18),
                        label: Text(isSearching ? "Locating STB..." : "Locate STB (Track)"),
                        onPressed: isSearching
                            ? null
                            : () async {
                                final text = controller.text.trim();
                                if (text.isEmpty) return;

                                setModalState(() {
                                  isSearching = true;
                                  result = null;
                                });

                                final res = await NxtDigitalService.trackStb(text);

                                setModalState(() {
                                  isSearching = false;
                                  result = res;
                                });
                              },
                      ),
                    ),

                    if (result != null) ...[
                      const SizedBox(height: 18),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: result!.isSuccess ? const Color(0xFFF8FAFC) : const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: result!.isSuccess ? const Color(0xFFE2E8F0) : const Color(0xFFFECACA)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  result!.isSuccess ? Icons.verified_rounded : Icons.info_outline_rounded,
                                  color: result!.isSuccess ? const Color(0xFF059669) : const Color(0xFFDC2626),
                                  size: 20,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  result!.isSuccess ? "STB Located Successfully" : "Status / Notice",
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                    color: result!.isSuccess ? const Color(0xFF065F46) : const Color(0xFF991B1B),
                                  ),
                                ),
                                const Spacer(),
                                Text(
                                  "${result!.latencyMs}ms",
                                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                ),
                              ],
                            ),
                            const Divider(height: 16),
                            if (result!.customerName != null) ...[
                              _buildDetailRow("Assigned Customer:", result!.customerName!),
                              const SizedBox(height: 6),
                            ],
                            if (result!.lcoCode != null) ...[
                              _buildDetailRow("Operator LCO Code:", result!.lcoCode!),
                              const SizedBox(height: 6),
                            ],
                            if (result!.canNumber != null) ...[
                              _buildDetailRow("Customer CAN No:", result!.canNumber!),
                              const SizedBox(height: 6),
                            ],
                            if (result!.casType != null) ...[
                              _buildDetailRow("CAS Type / Item:", "${result!.casType} (${result!.itemCode ?? ''})"),
                              const SizedBox(height: 6),
                            ],
                            _buildDetailRow("NXT Message:", result!.rawMessage),
                            const SizedBox(height: 14),

                            // 1-Tap Refresh Button right from tracking result!
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF059669),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                icon: const Icon(Icons.bolt_rounded, size: 18),
                                label: const Text("Refresh (Retrack) This Box", style: TextStyle(fontWeight: FontWeight.bold)),
                                onPressed: () {
                                  Navigator.pop(context);
                                  showRetrackModal(
                                    context,
                                    deviceId: controller.text.trim(),
                                    customerName: result!.customerName ?? "Customer",
                                  );
                                },
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  static Widget _buildDetailRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 130,
          child: Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.bold)),
        ),
        Expanded(
          child: Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
        ),
      ],
    );
  }
}

/// Execution Sheet for Retrack with real API state and debug log
class _RetrackExecutionSheet extends StatefulWidget {
  final String deviceId;
  final String customerName;

  const _RetrackExecutionSheet({
    required this.deviceId,
    required this.customerName,
  });

  @override
  State<_RetrackExecutionSheet> createState() => _RetrackExecutionSheetState();
}

class _RetrackExecutionSheetState extends State<_RetrackExecutionSheet> {
  bool _isLoading = true;
  NxtRetrackResult? _result;
  bool _showDebugLog = false;

  @override
  void initState() {
    super.initState();
    _executeRetrack();
  }

  Future<void> _executeRetrack() async {
    setState(() => _isLoading = true);
    final res = await NxtDigitalService.retrackStb(widget.deviceId);
    if (!mounted) return;

    setState(() {
      _isLoading = false;
      _result = res;
    });

    if (res.isSuccess) {
      NxtDigitalModals._playChime();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
          ),
          const SizedBox(height: 18),

          if (_isLoading) ...[
            const SizedBox(height: 20),
            const SizedBox(
              width: 52,
              height: 52,
              child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 3.5),
            ),
            const SizedBox(height: 20),
            const Text(
              "Sending STB Refresh Command...",
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 6),
            Text(
              "Connecting to NXT Digital for ${widget.customerName} (${widget.deviceId})",
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 30),
          ] else if (_result != null) ...[
            // Result Icon
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _result!.isSuccess ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2),
                shape: BoxShape.circle,
              ),
              child: Icon(
                _result!.isSuccess ? Icons.check_circle_rounded : Icons.error_rounded,
                color: _result!.isSuccess ? const Color(0xFF059669) : const Color(0xFFDC2626),
                size: 52,
              ),
            ),
            const SizedBox(height: 16),

            Text(
              _result!.isSuccess ? "STB Refreshed Successfully!" : "Refresh Request Failed",
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 18,
                color: _result!.isSuccess ? const Color(0xFF065F46) : const Color(0xFF991B1B),
              ),
            ),
            const SizedBox(height: 8),

            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceSecondary,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                children: [
                  Text(
                    _result!.message,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary, height: 1.4),
                  ),
                  if (_result!.transactionId != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      "NXT Transaction ID: ${_result!.transactionId}",
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF059669)),
                    ),
                  ],
                  if (_result!.errorCode != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      "Error Code: ${_result!.errorCode}",
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFFDC2626)),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Latency & Timestamp
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.speed_rounded, size: 14, color: AppColors.textMuted),
                const SizedBox(width: 4),
                Text(
                  "Latency: ${_result!.latencyMs} ms",
                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                ),
                const SizedBox(width: 14),
                TextButton.icon(
                  style: TextButton.styleFrom(padding: EdgeInsets.zero),
                  icon: Icon(_showDebugLog ? Icons.expand_less_rounded : Icons.expand_more_rounded, size: 16),
                  label: const Text("View Debug Log", style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  onPressed: () => setState(() => _showDebugLog = !_showDebugLog),
                ),
              ],
            ),

            // Debug Log Drawer
            if (_showDebugLog) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text("RAW SERVER RESPONSE", style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
                        InkWell(
                          onTap: () {
                            Clipboard.setData(ClipboardData(text: _result!.rawResponse));
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text("Debug Log copied to clipboard!"), duration: Duration(seconds: 1)),
                            );
                          },
                          child: const Row(
                            children: [
                              Icon(Icons.copy_rounded, color: Colors.white, size: 12),
                              SizedBox(width: 4),
                              Text("Copy", style: TextStyle(color: Colors.white, fontSize: 10)),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _result!.rawResponse,
                      style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: Color(0xFF38BDF8)),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),

            // Action Buttons
            Row(
              children: [
                if (!_result!.isSuccess)
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 13), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                      onPressed: _executeRetrack,
                      child: const Text("Retry", style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                if (!_result!.isSuccess) const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _result!.isSuccess ? const Color(0xFF059669) : AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () => Navigator.pop(context),
                    child: const Text("Done", style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
