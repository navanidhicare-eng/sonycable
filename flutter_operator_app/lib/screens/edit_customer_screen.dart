import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/customer.dart';
import '../theme/app_theme.dart';
import '../widgets/barcode_scanner_modal.dart';

class EditCustomerScreen extends StatefulWidget {
  final Customer customer;

  const EditCustomerScreen({super.key, required this.customer});

  @override
  State<EditCustomerScreen> createState() => _EditCustomerScreenState();
}

class _EditCustomerScreenState extends State<EditCustomerScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _nameController;
  late TextEditingController _mobileController;
  late TextEditingController _customerIdController;
  late TextEditingController _stbIdController;
  late TextEditingController _gtplIdController;
  late TextEditingController _areaController;
  late TextEditingController _balanceController;

  DateTime? _selectedExpiryDate;
  bool _isSubmitting = false;
  List<String> _availableAreas = [];
  bool _isLoadingAreas = true;

  @override
  void initState() {
    super.initState();
    final c = widget.customer;
    _nameController = TextEditingController(text: c.name);
    _mobileController = TextEditingController(text: c.mobile);
    _customerIdController = TextEditingController(text: c.customerId);
    _stbIdController = TextEditingController(text: c.stbId ?? "");
    _gtplIdController = TextEditingController(text: c.gtplId ?? "");
    _areaController = TextEditingController(text: c.area);
    _balanceController = TextEditingController(text: c.balanceAmount.toInt().toString());
    _selectedExpiryDate = c.expiryDate;
    _loadAreas();
  }

  Future<void> _loadAreas() async {
    try {
      final snap = await FirebaseFirestore.instance.collection('areas').get();
      final Set<String> areaSet = {};
      for (var d in snap.docs) {
        final name = (d.data()['name'] ?? d.data()['areaName'] ?? d.id).toString().trim();
        if (name.isNotEmpty) areaSet.add(name);
      }
      final currentArea = widget.customer.area.trim();
      if (currentArea.isNotEmpty) {
        areaSet.add(currentArea);
      }
      final list = areaSet.toList()..sort();
      if (mounted) {
        setState(() {
          _availableAreas = list;
          _isLoadingAreas = false;
          if (_areaController.text.trim().isEmpty && list.isNotEmpty) {
            _areaController.text = list.first;
          }
        });
      }
    } catch (e) {
      debugPrint("Error loading areas: $e");
      if (mounted) {
        setState(() => _isLoadingAreas = false);
      }
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _mobileController.dispose();
    _customerIdController.dispose();
    _stbIdController.dispose();
    _gtplIdController.dispose();
    _areaController.dispose();
    _balanceController.dispose();
    super.dispose();
  }

  Future<void> _pickExpiryDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedExpiryDate ?? now,
      firstDate: DateTime(now.year - 3),
      lastDate: DateTime(now.year + 5),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.primary,
              onPrimary: Colors.white,
              onSurface: AppColors.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() => _selectedExpiryDate = picked);
    }
  }

  Future<void> _saveCustomer() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Customer name is required"),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final double newBalance = double.tryParse(_balanceController.text.trim()) ?? widget.customer.balanceAmount;

      final updateData = <String, dynamic>{
        'name': name,
        'mobile': _mobileController.text.trim(),
        'customerId': _customerIdController.text.trim(),
        'stbId': _stbIdController.text.trim(),
        'gtplId': _gtplIdController.text.trim(),
        'area': _areaController.text.trim(),
        'balanceAmount': newBalance,
        'updatedAt': FieldValue.serverTimestamp(),
      };

      if (_selectedExpiryDate != null) {
        updateData['expiryDate'] = Timestamp.fromDate(_selectedExpiryDate!);
      }

      await FirebaseFirestore.instance
          .collection('customers')
          .doc(widget.customer.id)
          .update(updateData);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Customer details updated successfully! ✅"),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Failed to update: $e"),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.customer;
    final initials = c.name.trim().isNotEmpty
        ? c.name.trim().split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join().toUpperCase()
        : "CU";
    final isExpired = _selectedExpiryDate != null && _selectedExpiryDate!.isBefore(DateTime.now());

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "Customer Details",
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            ),
            Text(
              "ID: ${c.displayId} • ${c.name}",
              style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.normal),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: TextButton.icon(
              onPressed: _isSubmitting ? null : _saveCustomer,
              icon: _isSubmitting
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                    )
                  : const Icon(Icons.check_rounded, color: AppColors.primary, size: 20),
              label: const Text(
                "Save",
                style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 15),
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header Status Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.border),
                  boxShadow: AppColors.cardShadow,
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 26,
                      backgroundColor: AppColors.primaryBg,
                      child: Text(
                        initials,
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            c.name,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            "ID: ${c.displayId} • ${c.mobile}",
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: isExpired ? AppColors.dangerBg : AppColors.successBg,
                        border: Border.all(color: isExpired ? AppColors.dangerBorder : AppColors.successBorder),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        isExpired ? "EXPIRED" : "ACTIVE",
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          color: isExpired ? AppColors.danger : AppColors.success,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),

              // Section 1: Personal & Contact
              _buildSectionCard(
                title: "Personal & Contact Info",
                icon: Icons.person_rounded,
                children: [
                  _buildTextField(
                    label: "Customer Name",
                    controller: _nameController,
                    icon: Icons.person_outline,
                    hint: "Enter full name",
                  ),
                  const SizedBox(height: 14),
                  _buildTextField(
                    label: "Mobile Number",
                    controller: _mobileController,
                    icon: Icons.phone_outlined,
                    hint: "10-digit mobile number",
                    keyboardType: TextInputType.phone,
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // Section 2: Box & Connection Info
              _buildSectionCard(
                title: "Box & Connection Info",
                icon: Icons.tv_rounded,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _buildTextField(
                          label: "Customer ID",
                          controller: _customerIdController,
                          icon: Icons.badge_outlined,
                          hint: "e.g. 640",
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildAreaDropdown(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  _buildTextField(
                    label: "STB ID (Set Top Box Number)",
                    controller: _stbIdController,
                    icon: Icons.live_tv_outlined,
                    hint: "Enter or scan full STB ID",
                    onScan: () async {
                      final code = await BarcodeScannerModal.scan(
                        context,
                        title: "Scan STB Barcode",
                      );
                      if (code != null && code.isNotEmpty) {
                        setState(() => _stbIdController.text = code);
                      }
                    },
                  ),
                  const SizedBox(height: 14),
                  _buildTextField(
                    label: "STB VC Number (Smart Card)",
                    controller: _gtplIdController,
                    icon: Icons.sim_card_outlined,
                    hint: "Enter or scan full VC Number",
                    onScan: () async {
                      final code = await BarcodeScannerModal.scan(
                        context,
                        title: "Scan VC Barcode",
                      );
                      if (code != null && code.isNotEmpty) {
                        setState(() => _gtplIdController.text = code);
                      }
                    },
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // Section 3: Billing & Subscription
              _buildSectionCard(
                title: "Billing & Expiry",
                icon: Icons.currency_rupee_rounded,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: _buildTextField(
                          label: "Due Balance (₹)",
                          controller: _balanceController,
                          icon: Icons.currency_rupee,
                          hint: "0",
                          keyboardType: TextInputType.number,
                          textColor: AppColors.danger,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              "Expiry Date",
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textSecondary,
                              ),
                            ),
                            const SizedBox(height: 6),
                            InkWell(
                              onTap: _pickExpiryDate,
                              borderRadius: BorderRadius.circular(14),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceSecondary,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: AppColors.border),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.calendar_today_rounded, size: 18, color: AppColors.primary),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        _selectedExpiryDate != null
                                            ? DateFormat('dd MMM yyyy').format(_selectedExpiryDate!)
                                            : "Select Date",
                                        style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                          color: _selectedExpiryDate != null ? AppColors.textPrimary : AppColors.textMuted,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 28),

              // Save Changes Button
              SizedBox(
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: _isSubmitting ? null : _saveCustomer,
                  icon: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                        )
                      : const Icon(Icons.save_rounded, size: 20),
                  label: Text(
                    _isSubmitting ? "Saving Changes..." : "Save Customer Details",
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 3,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionCard({
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: const BoxDecoration(
                  color: AppColors.primaryBg,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 16, color: AppColors.primary),
              ),
              const SizedBox(width: 10),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }

  Widget _buildAreaDropdown() {
    final currentValue = _areaController.text.trim();
    final items = _availableAreas.isEmpty
        ? (currentValue.isNotEmpty ? [currentValue] : ['MAIN ROAD'])
        : _availableAreas;

    final selectedValue = items.contains(currentValue)
        ? currentValue
        : (items.isNotEmpty ? items.first : null);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          "Area / Line",
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          height: 52,
          decoration: BoxDecoration(
            color: AppColors.surfaceSecondary,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 10),
          alignment: Alignment.center,
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: selectedValue,
              isExpanded: true,
              icon: _isLoadingAreas
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.arrow_drop_down_rounded, color: AppColors.primary, size: 26),
              items: items.map((area) {
                return DropdownMenuItem<String>(
                  value: area,
                  child: Row(
                    children: [
                      const Icon(Icons.location_on_outlined, size: 16, color: AppColors.textMuted),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          area,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
              onChanged: (newVal) {
                if (newVal != null) {
                  setState(() {
                    _areaController.text = newVal;
                  });
                }
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTextField({
    required String label,
    required TextEditingController controller,
    required IconData icon,
    String? hint,
    TextInputType? keyboardType,
    Color? textColor,
    VoidCallback? onScan,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          style: TextStyle(
            color: textColor ?? AppColors.textPrimary,
            fontWeight: FontWeight.w600,
            fontSize: 15,
            letterSpacing: 0.5,
          ),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13, letterSpacing: 0),
            prefixIcon: Icon(icon, color: AppColors.textMuted, size: 20),
            suffixIcon: onScan != null
                ? IconButton(
                    icon: const Icon(
                      Icons.qr_code_scanner_rounded,
                      color: AppColors.primary,
                      size: 24,
                    ),
                    tooltip: "Scan Barcode from Box",
                    onPressed: onScan,
                  )
                : null,
            filled: true,
            fillColor: AppColors.surfaceSecondary,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}

