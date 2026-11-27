import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/customer.dart';
import '../theme/app_theme.dart';

class OpticalPowerConfig {
  /// Range logic requested:
  /// >= -6.0 dBm -> Good / Perfect (Green)
  /// -7.0 to -10.0 dBm -> Warning / Low (Orange)
  /// <= -11.0 dBm (or -12.0 and below) -> Critical / Loss (Red)
  static String getStatus(double power) {
    if (power >= -6.0) return "Good";
    if (power >= -10.0) return "Low";
    return "Critical";
  }

  static String getStatusLabel(double power) {
    if (power >= -6.0) return "Good / Perfect";
    if (power >= -10.0) return "Warning / Low";
    return "Critical / Loss";
  }

  static Color getStatusColor(double power) {
    if (power >= -6.0) return const Color(0xFF16A34A); // Green
    if (power >= -10.0) return const Color(0xFFD97706); // Orange / Amber
    return const Color(0xFFDC2626); // Red
  }

  static Color getStatusBgColor(double power) {
    if (power >= -6.0) return const Color(0xFFDCFCE7);
    if (power >= -10.0) return const Color(0xFFFEF3C7);
    return const Color(0xFFFEE2E2);
  }

  static Color getStatusBorderColor(double power) {
    if (power >= -6.0) return const Color(0xFF86EFAC);
    if (power >= -10.0) return const Color(0xFFFCD34D);
    return const Color(0xFFFCA5A5);
  }

  static IconData getStatusIcon(double power) {
    if (power >= -6.0) return Icons.check_circle_rounded;
    if (power >= -10.0) return Icons.warning_amber_rounded;
    return Icons.error_outline_rounded;
  }

  static String getStatusGuidance(double power) {
    if (power >= -6.0) {
      return "Optimal Optical Signal (≥ -6 dBm). TV picture & channels are crystal clear.";
    }
    if (power >= -10.0) {
      return "Low Optical Power (-7 to -10 dBm). Check coupler, patch cord, or fiber bending.";
    }
    return "Critical Signal Loss (≤ -11/-12 dBm). Freezing, pixelation or STB no-signal occurs.";
  }
}

class OpticalPowerModal {
  static void show(
    BuildContext context, {
    required Customer customer,
    required String operatorName,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _OpticalPowerModalContent(
        customer: customer,
        operatorName: operatorName,
      ),
    );
  }
}

class _OpticalPowerModalContent extends StatefulWidget {
  final Customer customer;
  final String operatorName;

  const _OpticalPowerModalContent({
    required this.customer,
    required this.operatorName,
  });

  @override
  State<_OpticalPowerModalContent> createState() => _OpticalPowerModalContentState();
}

class _OpticalPowerModalContentState extends State<_OpticalPowerModalContent> {
  final TextEditingController _powerController = TextEditingController();
  final TextEditingController _remarksController = TextEditingController();
  bool _isSaving = false;
  double? _parsedPower;

  @override
  void initState() {
    super.initState();
    if (widget.customer.opticalPower != null) {
      _powerController.text = widget.customer.opticalPower!.toStringAsFixed(1);
      _parsedPower = widget.customer.opticalPower;
    }
  }

  @override
  void dispose() {
    _powerController.dispose();
    _remarksController.dispose();
    super.dispose();
  }

  void _onPowerChanged(String text) {
    final cleaned = text.trim();
    if (cleaned.isEmpty) {
      setState(() => _parsedPower = null);
      return;
    }
    // Allow entering positive or negative, but standard is negative unless '+' is typed
    double? val = double.tryParse(cleaned);
    if (val != null) {
      // If user typed 6, assume -6 if they didn't explicitly write + or -
      if (val > 0 && !cleaned.startsWith('+')) {
        val = -val;
      }
    }
    setState(() => _parsedPower = val);
  }

  Future<void> _saveReading() async {
    if (_parsedPower == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Please enter a valid optical power reading in dBm (e.g. -6.0)"),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      final now = DateTime.now();
      final nowTimestamp = Timestamp.fromDate(now);
      final double powerVal = _parsedPower!;
      final String remarks = _remarksController.text.trim();
      final String opName = widget.operatorName.isNotEmpty ? widget.operatorName : "Operator";

      // 1. Add log to subcollection optical_power_history
      await FirebaseFirestore.instance
          .collection('customers')
          .doc(widget.customer.id)
          .collection('optical_power_history')
          .add({
        'power': powerVal,
        'timestamp': nowTimestamp,
        'updatedBy': opName,
        'remarks': remarks,
        'status': OpticalPowerConfig.getStatus(powerVal),
      });

      // 2. Update customer main document for instant overview
      await FirebaseFirestore.instance
          .collection('customers')
          .doc(widget.customer.id)
          .update({
        'opticalPower': powerVal,
        'opticalPowerDate': nowTimestamp,
        'opticalPowerUpdatedBy': opName,
        'opticalPowerRemarks': remarks,
      });

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text("Optical power recorded: ${powerVal.toStringAsFixed(1)} dBm"),
              ),
            ],
          ),
          backgroundColor: const Color(0xFF16A34A),
          behavior: SnackBarBehavior.floating,
        ),
      );

      _remarksController.clear();
      setState(() => _isSaving = false);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Error saving optical reading: $e"),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _deleteHistoryEntry(String logId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text("Delete Record?"),
        content: const Text("Do you want to delete this optical power log entry?"),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text("Cancel"),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(c, true),
            child: const Text("Delete", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await FirebaseFirestore.instance
          .collection('customers')
          .doc(widget.customer.id)
          .collection('optical_power_history')
          .doc(logId)
          .delete();
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.90,
      minChildSize: 0.50,
      maxChildSize: 0.96,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // Modal Drag Handle
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 10, bottom: 6),
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),

              // Header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFBFDBFE)),
                      ),
                      child: const Icon(
                        Icons.settings_input_antenna_rounded,
                        color: Color(0xFF2563EB),
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "Optical Power (Node / Receiver)",
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            "${widget.customer.name} • ID: ${widget.customer.displayId}",
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),

              // Content Body
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(18, 14, 18, 30),
                  children: [
                    // 1. Current Live Status Card
                    StreamBuilder<DocumentSnapshot>(
                      stream: FirebaseFirestore.instance
                          .collection('customers')
                          .doc(widget.customer.id)
                          .snapshots(),
                      builder: (context, snap) {
                        final data = (snap.data?.data() as Map<String, dynamic>?) ?? {};
                        final dynamic rawPow = data['opticalPower'];
                        final double? currentPower = rawPow is num
                            ? rawPow.toDouble()
                            : (rawPow is String ? double.tryParse(rawPow) : null);

                        final dynamic rawDate = data['opticalPowerDate'];
                        DateTime? checkDate;
                        if (rawDate is Timestamp) checkDate = rawDate.toDate();

                        final String opBy = data['opticalPowerUpdatedBy']?.toString() ?? '';
                        final String currentRemarks = data['opticalPowerRemarks']?.toString() ?? '';

                        if (currentPower == null) {
                          return Container(
                            padding: const EdgeInsets.all(16),
                            margin: const EdgeInsets.only(bottom: 18),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.info_outline_rounded, color: Color(0xFF64748B), size: 28),
                                const SizedBox(width: 14),
                                const Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        "No Optical Power Recorded",
                                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                                      ),
                                      SizedBox(height: 2),
                                      Text(
                                        "Enter customer end power meter reading below to track signal quality.",
                                        style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        }

                        final color = OpticalPowerConfig.getStatusColor(currentPower);
                        final bgColor = OpticalPowerConfig.getStatusBgColor(currentPower);
                        final borderColor = OpticalPowerConfig.getStatusBorderColor(currentPower);
                        final label = OpticalPowerConfig.getStatusLabel(currentPower);
                        final guidance = OpticalPowerConfig.getStatusGuidance(currentPower);

                        return Container(
                          padding: const EdgeInsets.all(16),
                          margin: const EdgeInsets.only(bottom: 18),
                          decoration: BoxDecoration(
                            color: bgColor,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: borderColor, width: 1.5),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        "CURRENT OPTICAL POWER",
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: 1.0,
                                          color: AppColors.textSecondary,
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Row(
                                        crossAxisAlignment: CrossAxisAlignment.baseline,
                                        textBaseline: TextBaseline.alphabetic,
                                        children: [
                                          Text(
                                            "${currentPower.toStringAsFixed(1)} ",
                                            style: TextStyle(
                                              fontSize: 32,
                                              fontWeight: FontWeight.w900,
                                              color: color,
                                            ),
                                          ),
                                          const Text(
                                            "dBm",
                                            style: TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.bold,
                                              color: AppColors.textPrimary,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: color,
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(OpticalPowerConfig.getStatusIcon(currentPower), color: Colors.white, size: 16),
                                        const SizedBox(width: 6),
                                        Text(
                                          label,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Text(
                                guidance,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: color,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  const Icon(Icons.schedule_rounded, size: 13, color: AppColors.textSecondary),
                                  const SizedBox(width: 4),
                                  Text(
                                    checkDate != null
                                        ? DateFormat('dd MMM yyyy, hh:mm a').format(checkDate)
                                        : "Date not recorded",
                                    style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                  ),
                                  if (opBy.isNotEmpty) ...[
                                    const Text(" • ", style: TextStyle(color: AppColors.textSecondary)),
                                    const Icon(Icons.person_outline_rounded, size: 13, color: AppColors.textSecondary),
                                    const SizedBox(width: 2),
                                    Text(
                                      opBy,
                                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                                    ),
                                  ],
                                ],
                              ),
                              if (currentRemarks.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.7),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    "Note: $currentRemarks",
                                    style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppColors.textPrimary),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        );
                      },
                    ),

                    // 2. Record New Reading Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: AppColors.border),
                        boxShadow: AppColors.cardShadow,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.add_circle_outline_rounded, color: AppColors.primary, size: 20),
                              SizedBox(width: 8),
                              Text(
                                "Record New Optical Power",
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),

                          // Power input row with dBm suffix
                          Row(
                            children: [
                              Expanded(
                                flex: 3,
                                child: TextField(
                                  controller: _powerController,
                                  keyboardType: const TextInputType.numberWithOptions(signed: true, decimal: true),
                                  style: const TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.textPrimary,
                                  ),
                                  decoration: InputDecoration(
                                    labelText: "Reading (dBm)",
                                    labelStyle: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                                    hintText: "-6.0",
                                    hintStyle: TextStyle(color: Colors.grey.shade400),
                                    prefixIcon: const Icon(Icons.speed_rounded, color: AppColors.primary),
                                    suffixText: "dBm",
                                    suffixStyle: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                                    filled: true,
                                    fillColor: AppColors.surfaceSecondary,
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.primary, width: 2)),
                                  ),
                                  onChanged: _onPowerChanged,
                                ),
                              ),
                              const SizedBox(width: 12),
                              // Live Quality Preview Pill
                              Expanded(
                                flex: 2,
                                child: Container(
                                  height: 60,
                                  padding: const EdgeInsets.symmetric(horizontal: 8),
                                  decoration: BoxDecoration(
                                    color: _parsedPower != null
                                        ? OpticalPowerConfig.getStatusBgColor(_parsedPower!)
                                        : const Color(0xFFF1F5F9),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                      color: _parsedPower != null
                                          ? OpticalPowerConfig.getStatusBorderColor(_parsedPower!)
                                          : const Color(0xFFCBD5E1),
                                    ),
                                  ),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        _parsedPower != null
                                            ? OpticalPowerConfig.getStatusIcon(_parsedPower!)
                                            : Icons.help_outline_rounded,
                                        size: 20,
                                        color: _parsedPower != null
                                            ? OpticalPowerConfig.getStatusColor(_parsedPower!)
                                            : const Color(0xFF64748B),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        _parsedPower != null
                                            ? OpticalPowerConfig.getStatus(_parsedPower!)
                                            : "Enter Value",
                                        textAlign: TextAlign.center,
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: _parsedPower != null
                                              ? OpticalPowerConfig.getStatusColor(_parsedPower!)
                                              : const Color(0xFF64748B),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),

                          // Remarks / Notes Field
                          TextField(
                            controller: _remarksController,
                            style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                            decoration: InputDecoration(
                              labelText: "Remarks / Service Note (Optional)",
                              hintText: "e.g. Spliced joint, drop wire replaced",
                              hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 12),
                              prefixIcon: const Icon(Icons.notes_rounded, color: AppColors.textSecondary, size: 20),
                              filled: true,
                              fillColor: AppColors.surfaceSecondary,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Save Button
                          SizedBox(
                            width: double.infinity,
                            height: 48,
                            child: ElevatedButton.icon(
                              onPressed: _isSaving ? null : _saveReading,
                              icon: _isSaving
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                    )
                                  : const Icon(Icons.save_rounded, color: Colors.white),
                              label: Text(
                                _isSaving ? "Saving Reading..." : "Save Optical Reading",
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.white),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF2563EB),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                elevation: 0,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // 4. Optical Power History Header
                    const Row(
                      children: [
                        Icon(Icons.history_rounded, size: 20, color: AppColors.textPrimary),
                        SizedBox(width: 8),
                        Text(
                          "Optical Power History (లాగ్ రికార్డులు)",
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // 5. History Stream List
                    StreamBuilder<QuerySnapshot>(
                      stream: FirebaseFirestore.instance
                          .collection('customers')
                          .doc(widget.customer.id)
                          .collection('optical_power_history')
                          .orderBy('timestamp', descending: true)
                          .snapshots(),
                      builder: (context, snapshot) {
                        if (snapshot.connectionState == ConnectionState.waiting) {
                          return const Center(
                            child: Padding(
                              padding: EdgeInsets.all(20),
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          );
                        }

                        final docs = snapshot.data?.docs ?? [];
                        if (docs.isEmpty) {
                          return Container(
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: const Center(
                              child: Column(
                                children: [
                                  Icon(Icons.history_toggle_off_rounded, size: 36, color: Color(0xFF94A3B8)),
                                  SizedBox(height: 8),
                                  Text(
                                    "No past history logs found.",
                                    style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                  SizedBox(height: 2),
                                  Text(
                                    "Readings you save will appear here in chronological order.",
                                    style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }

                        return ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: docs.length,
                          separatorBuilder: (ctx, index) => const SizedBox(height: 10),
                          itemBuilder: (context, idx) {
                            final doc = docs[idx];
                            final d = doc.data() as Map<String, dynamic>;
                            final dynamic rawP = d['power'];
                            final double power = rawP is num ? rawP.toDouble() : (double.tryParse(rawP?.toString() ?? '') ?? 0.0);
                            final dynamic rawTs = d['timestamp'];
                            DateTime date = DateTime.now();
                            if (rawTs is Timestamp) date = rawTs.toDate();

                            final String updatedBy = d['updatedBy']?.toString() ?? 'Staff';
                            final String rem = d['remarks']?.toString() ?? '';

                            final color = OpticalPowerConfig.getStatusColor(power);
                            final bgColor = OpticalPowerConfig.getStatusBgColor(power);
                            final borderColor = OpticalPowerConfig.getStatusBorderColor(power);
                            final statusLabel = OpticalPowerConfig.getStatus(power);

                            return Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: borderColor),
                                boxShadow: const [
                                  BoxStyle.cardShadow,
                                ],
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  // Power badge
                                  Container(
                                    width: 82,
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                    decoration: BoxDecoration(
                                      color: bgColor,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: borderColor),
                                    ),
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Text(
                                          power.toStringAsFixed(1),
                                          style: TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w900,
                                            color: color,
                                          ),
                                        ),
                                        Text(
                                          "dBm",
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                            color: color,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  // Details
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: bgColor,
                                                borderRadius: BorderRadius.circular(4),
                                              ),
                                              child: Text(
                                                statusLabel,
                                                style: TextStyle(
                                                  color: color,
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 10,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 6),
                                            Text(
                                              DateFormat('dd MMM yyyy, hh:mm a').format(date),
                                              style: const TextStyle(
                                                fontSize: 11,
                                                color: AppColors.textSecondary,
                                                fontWeight: FontWeight.w500,
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          "Checked by: $updatedBy",
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: AppColors.textMuted,
                                          ),
                                        ),
                                        if (rem.isNotEmpty) ...[
                                          const SizedBox(height: 3),
                                          Text(
                                            rem,
                                            style: const TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w600,
                                              color: AppColors.textPrimary,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline_rounded, size: 18, color: Color(0xFF94A3B8)),
                                    onPressed: () => _deleteHistoryEntry(doc.id),
                                    tooltip: "Delete record",
                                  ),
                                ],
                              ),
                            );
                          },
                        );
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class BoxStyle {
  static const cardShadow = BoxShadow(
    color: Color(0x08000000),
    blurRadius: 8,
    offset: Offset(0, 2),
  );
}
