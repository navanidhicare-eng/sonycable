import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';
import '../services/sms_service.dart';
import '../services/whatsapp_service.dart';
import '../theme/app_theme.dart';

class MyNetworkInfoScreen extends StatefulWidget {
  final OperatorModel? operator;
  final String operatorUid;

  const MyNetworkInfoScreen({
    super.key,
    required this.operator,
    required this.operatorUid,
  });

  @override
  State<MyNetworkInfoScreen> createState() => _MyNetworkInfoScreenState();
}

class _MyNetworkInfoScreenState extends State<MyNetworkInfoScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _businessNameController;
  late TextEditingController _helplineController;
  late TextEditingController _nameController;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _businessNameController = TextEditingController(
      text: widget.operator?.businessName ?? 'Sony Cable Network',
    );
    _helplineController = TextEditingController(
      text: widget.operator?.helpline ?? '9010737882',
    );
    _nameController = TextEditingController(
      text: widget.operator?.name ?? 'Prasad',
    );
  }

  @override
  void dispose() {
    _businessNameController.dispose();
    _helplineController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _saveNetworkInfo() async {
    if (!_formKey.currentState!.validate()) return;

    final newBusinessName = _businessNameController.text.trim();
    final newHelpline = _helplineController.text.trim();
    final newName = _nameController.text.trim();

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
          'businessName': newBusinessName,
          'helpline': newHelpline,
          'name': newName,
        });
      }

      // 2. Update local services and SharedPreferences cache
      WhatsAppService.businessName = newBusinessName;
      WhatsAppService.helpline = newHelpline;
      SmsService.businessName = newBusinessName.replaceAll(' Network', '').trim();

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('operator_business_name', newBusinessName);
      await prefs.setString('operator_helpline', newHelpline);
      await prefs.setString('operator_name', newName);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: const [
                Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                SizedBox(width: 8),
                Text("Network Info & Helpline saved successfully! ✅"),
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
            content: Text("Error saving network info: $e"),
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
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          "My Network Info & Helpline",
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
              // Info Banner
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Icon(Icons.info_outline_rounded, color: Color(0xFF2563EB), size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        "ఈ నెట్‌వర్క్ పేరు మరియు హెల్ప్‌లైన్ నంబర్ మీ కస్టమర్లకు వెళ్లే SMS మరియు WhatsApp రసీదులలో ఆటోమేటిక్‌గా ప్రింట్ అవుతాయి.",
                        style: TextStyle(color: Color(0xFF1E40AF), fontSize: 12.5, height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // Form Card
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                  boxShadow: AppColors.cardShadow,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      "Business / Network Branding",
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 14),

                    // Network / Business Name
                    TextFormField(
                      controller: _businessNameController,
                      decoration: InputDecoration(
                        labelText: "Network / Business Name *",
                        hintText: "e.g. Sony Cable Network",
                        prefixIcon: const Icon(Icons.business_rounded, color: AppColors.primary, size: 20),
                        filled: true,
                        fillColor: AppColors.inputBg,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                      ),
                      validator: (val) => (val == null || val.trim().isEmpty) ? "Please enter network name" : null,
                    ),
                    const SizedBox(height: 14),

                    // Helpline Mobile Number
                    TextFormField(
                      controller: _helplineController,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        labelText: "Helpline Mobile Number *",
                        hintText: "e.g. 9010737882",
                        prefixIcon: const Icon(Icons.phone_rounded, color: AppColors.primary, size: 20),
                        filled: true,
                        fillColor: AppColors.inputBg,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) return "Please enter helpline number";
                        final clean = val.replaceAll(RegExp(r'[^0-9]'), '');
                        if (clean.length < 10) return "Please enter valid 10-digit mobile";
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),

                    // Operator Name
                    TextFormField(
                      controller: _nameController,
                      decoration: InputDecoration(
                        labelText: "Operator Name *",
                        hintText: "e.g. Prasad",
                        prefixIcon: const Icon(Icons.person_rounded, color: AppColors.primary, size: 20),
                        filled: true,
                        fillColor: AppColors.inputBg,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
                      ),
                      validator: (val) => (val == null || val.trim().isEmpty) ? "Please enter operator name" : null,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Save Button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: _isSaving ? null : _saveNetworkInfo,
                  icon: _isSaving
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Icon(Icons.save_rounded, size: 20),
                  label: Text(
                    _isSaving ? "Saving..." : "Save Network Info",
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
