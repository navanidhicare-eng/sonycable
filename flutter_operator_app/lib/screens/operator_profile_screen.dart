import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';
import '../services/sms_service.dart';
import '../services/whatsapp_service.dart';
import '../theme/app_theme.dart';

class OperatorProfileScreen extends StatefulWidget {
  final OperatorModel? operator;
  final String operatorUid;

  const OperatorProfileScreen({
    super.key,
    required this.operator,
    required this.operatorUid,
  });

  @override
  State<OperatorProfileScreen> createState() => _OperatorProfileScreenState();
}

class _OperatorProfileScreenState extends State<OperatorProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameController;
  late TextEditingController _businessNameController;
  late TextEditingController _helplineController;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(
      text: widget.operator?.name ?? 'Prasad',
    );
    _businessNameController = TextEditingController(
      text: widget.operator?.businessName ?? 'Sony Cable Network',
    );
    _helplineController = TextEditingController(
      text: widget.operator?.helpline ?? widget.operator?.mobile ?? '9010737882',
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _businessNameController.dispose();
    _helplineController.dispose();
    super.dispose();
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;

    final newName = _nameController.text.trim();
    final newBusinessName = _businessNameController.text.trim();
    final newHelpline = _helplineController.text.trim();

    setState(() => _isSaving = true);

    try {
      // 1. Update in Firestore 'staff' collection
      final staffQuery = await FirebaseFirestore.instance
          .collection('staff')
          .where('uid', isEqualTo: widget.operatorUid)
          .limit(1)
          .get();

      if (staffQuery.docs.isNotEmpty) {
        await staffQuery.docs.first.reference.update({
          'name': newName,
          'businessName': newBusinessName,
          'helpline': newHelpline,
          'updatedAt': FieldValue.serverTimestamp(),
        });
      }

      // 2. Update local services and SharedPreferences cache
      WhatsAppService.businessName = newBusinessName;
      WhatsAppService.helpline = newHelpline;
      SmsService.businessName = newBusinessName.replaceAll(' Network', '').trim();

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('operator_name', newName);
      await prefs.setString('operator_business_name', newBusinessName);
      await prefs.setString('operator_helpline', newHelpline);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: const [
                Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                SizedBox(width: 8),
                Expanded(
                  child: Text("Profile & Network Info saved successfully! ✅"),
                ),
              ],
            ),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Error saving profile: $e"),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final operatorName = _nameController.text.isNotEmpty ? _nameController.text : (widget.operator?.name ?? "Operator");
    final initialLetter = operatorName.isNotEmpty ? operatorName[0].toUpperCase() : "P";

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          "Operator Profile & Settings",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.textPrimary),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Profile Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFFFF7ED), Color(0xFFFFFBEB)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFFED7AA)),
                  boxShadow: AppColors.cardShadow,
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 30,
                      backgroundColor: AppColors.primary,
                      child: Text(
                        initialLetter,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 26,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  operatorName,
                                  style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 17,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF10B981).withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Text(
                                  "ACTIVE",
                                  style: TextStyle(
                                    color: Color(0xFF059669),
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            "📱 ${widget.operator?.mobile ?? 'N/A'}",
                            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            "🏢 ${_businessNameController.text.isNotEmpty ? _businessNameController.text : 'Sony Cable Network'}",
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Network Setup Heading
              Row(
                children: [
                  Container(
                    width: 4,
                    height: 14,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    "NETWORK & HELPLINE DETAILS",
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.1,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Form Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                  boxShadow: AppColors.cardShadow,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Operator Name
                    const Text(
                      "Operator Name",
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _nameController,
                      decoration: InputDecoration(
                        prefixIcon: const Icon(Icons.person_outline_rounded, color: AppColors.primary),
                        hintText: "e.g. Prasad",
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                      validator: (val) => (val == null || val.trim().isEmpty) ? "Please enter your name" : null,
                      onChanged: (_) => setState(() {}),
                    ),

                    const SizedBox(height: 16),

                    // Cable Network / Business Name
                    const Text(
                      "Cable Network Name (Shown in Receipts & App)",
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _businessNameController,
                      decoration: InputDecoration(
                        prefixIcon: const Icon(Icons.tv_rounded, color: Color(0xFFD97706)),
                        hintText: "e.g. Sony Cable Network",
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                      validator: (val) => (val == null || val.trim().isEmpty) ? "Please enter your cable network name" : null,
                      onChanged: (_) => setState(() {}),
                    ),

                    const SizedBox(height: 16),

                    // Helpline Number
                    const Text(
                      "Helpline Phone Number (Shown in Receipts)",
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: _helplineController,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        prefixIcon: const Icon(Icons.phone_in_talk_rounded, color: Color(0xFF059669)),
                        hintText: "e.g. 9010737882",
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) return "Please enter helpline number";
                        if (val.trim().length < 10) return "Enter valid 10-digit number";
                        return null;
                      },
                      onChanged: (_) => setState(() {}),
                    ),

                    const SizedBox(height: 20),

                    // Save Button
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton.icon(
                        onPressed: _isSaving ? null : _saveProfile,
                        icon: _isSaving
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                              )
                            : const Icon(Icons.check_rounded, color: Colors.white),
                        label: Text(
                          _isSaving ? "Saving..." : "Save Profile & Network Settings",
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),



              // Message Preview Box
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: const [
                        Icon(Icons.mark_chat_read_rounded, color: Color(0xFF16A34A), size: 18),
                        SizedBox(width: 8),
                        Text(
                          "Live Customer Message Preview",
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF166534)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFDCFCE7)),
                      ),
                      child: Text(
                        "Recharge Successful!\n"
                        "Network: ${_businessNameController.text.trim()}\n"
                        "Customer ID: 101 (Ramesh)\n"
                        "Pack: ₹300 (Validity: 30 Days)\n"
                        "Helpline: ${_helplineController.text.trim()}",
                        style: const TextStyle(fontSize: 12, color: AppColors.textPrimary, height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }
}
