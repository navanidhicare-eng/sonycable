import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../services/sound_service.dart';
import '../theme/app_theme.dart';
import '../widgets/barcode_scanner_modal.dart';

class AddCustomerScreen extends StatefulWidget {
  final String operatorName;
  final String operatorUid;
  final String? adminId;

  const AddCustomerScreen({
    super.key,
    required this.operatorName,
    required this.operatorUid,
    this.adminId,
  });

  @override
  State<AddCustomerScreen> createState() => _AddCustomerScreenState();
}

class _AddCustomerScreenState extends State<AddCustomerScreen> {
  final _formKey = GlobalKey<FormState>();

  final _nameController = TextEditingController();
  final _mobileController = TextEditingController();
  final _stbController = TextEditingController();
  final _customerIdController = TextEditingController();
  final _gtplIdController = TextEditingController();
  final _balanceController = TextEditingController(text: "0");
  final _customAreaController = TextEditingController();

  String _customerType = "CABLE";
  String? _selectedArea;
  bool _isCustomArea = false;
  CablePackage? _selectedPackage;

  bool _setCustomDates = false;
  DateTime? _lastRechargeDate;
  DateTime? _expiryDate;

  bool _isLoadingAreas = true;
  List<String> _availableAreas = [];
  List<CablePackage> _availablePackages = [];
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadAreasAndPackages();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _mobileController.dispose();
    _stbController.dispose();
    _customerIdController.dispose();
    _gtplIdController.dispose();
    _balanceController.dispose();
    _customAreaController.dispose();
    super.dispose();
  }

  Future<void> _loadAreasAndPackages() async {
    try {
      final areasSnap = await FirebaseFirestore.instance
          .collection('areas')
          .where('operatorUid', isEqualTo: widget.operatorUid)
          .get();
      final Set<String> areaSet = {};
      for (var d in areasSnap.docs) {
        final name = (d.data()['name'] ?? d.data()['areaName'] ?? d.id).toString().trim();
        if (name.isNotEmpty) areaSet.add(name);
      }

      final packagesSnap = await FirebaseFirestore.instance
          .collection('packages')
          .where('operatorUid', isEqualTo: widget.operatorUid)
          .get();
      final pkgList = packagesSnap.docs.map((d) => CablePackage.fromFirestore(d)).toList();

      if (mounted) {
        setState(() {
          _availableAreas = areaSet.toList()..sort();
          if (_availableAreas.isNotEmpty) {
            _selectedArea = _availableAreas.first;
          }
          _availablePackages = pkgList;
          _isLoadingAreas = false;
        });
      }
    } catch (e) {
      debugPrint("Error loading areas/packages: $e");
      if (mounted) setState(() => _isLoadingAreas = false);
    }
  }

  Future<void> _scanBarcode() async {
    if (kIsWeb) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Barcode camera scan is optimized for Android mobile. Please enter STB number manually on Web."),
          backgroundColor: AppColors.info,
        ),
      );
      return;
    }

    final code = await BarcodeScannerModal.scan(context, title: "Scan STB Barcode");
    if (code != null && code.trim().isNotEmpty) {
      setState(() {
        _stbController.text = code.trim();
        if (_customerIdController.text.trim().isEmpty) {
          _customerIdController.text = code.trim();
        }
      });
    }
  }

  Future<void> _pickDate({required bool isRechargeDate}) async {
    final now = DateTime.now();
    final initial = isRechargeDate
        ? (_lastRechargeDate ?? now)
        : (_expiryDate ?? now.add(const Duration(days: 30)));
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(now.year - 2),
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
      setState(() {
        if (isRechargeDate) {
          _lastRechargeDate = picked;
          _expiryDate = picked.add(const Duration(days: 30));
        } else {
          _expiryDate = picked;
        }
      });
    }
  }

  Future<void> _submitCustomer() async {
    if (!_formKey.currentState!.validate()) return;

    final area = _isCustomArea ? _customAreaController.text.trim() : (_selectedArea ?? "");
    if (area.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Please select or enter an Area / Line"), backgroundColor: AppColors.danger),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final name = _nameController.text.trim();
      final mobile = _mobileController.text.trim();
      final stbId = _stbController.text.trim();
      final customerId = _customerIdController.text.trim().isNotEmpty
          ? _customerIdController.text.trim()
          : stbId;
      final gtplId = _gtplIdController.text.trim();
      final balance = double.tryParse(_balanceController.text.trim()) ?? 0.0;

      final targetAdminId = (widget.adminId != null && widget.adminId!.isNotEmpty)
          ? widget.adminId!
          : widget.operatorUid;

      // Duplicate Check
      final dupCheck = await FirebaseFirestore.instance
          .collection('customers')
          .where('customerId', isEqualTo: customerId)
          .limit(1)
          .get();

      if (dupCheck.docs.isNotEmpty) {
        if (mounted) {
          setState(() => _isSubmitting = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text("A customer with Customer ID '$customerId' already exists!"),
              backgroundColor: AppColors.danger,
            ),
          );
        }
        return;
      }

      // Add to Firestore
      final newDocRef = FirebaseFirestore.instance.collection('customers').doc();
      await newDocRef.set({
        'name': name,
        'mobile': mobile,
        'stbId': stbId,
        'customerId': customerId,
        'gtplId': gtplId.isNotEmpty ? gtplId : null,
        'area': area,
        'balanceAmount': balance,
        'customerType': _customerType,
        'packageName': _selectedPackage?.name,
        'packageAmount': _selectedPackage?.price,
        'lastRechargeDate': _setCustomDates && _lastRechargeDate != null ? Timestamp.fromDate(_lastRechargeDate!) : null,
        'expiryDate': _setCustomDates && _expiryDate != null ? Timestamp.fromDate(_expiryDate!) : null,
        'userId': targetAdminId,
        'adminId': targetAdminId,
        'operatorUid': widget.operatorUid,
        'operatorName': widget.operatorName,
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });

      // Also ensure the custom area is persisted to areas collection if new
      if (_isCustomArea && area.isNotEmpty) {
        try {
          await FirebaseFirestore.instance.collection('areas').add({
            'name': area,
            'operatorUid': widget.operatorUid,
            'operatorName': widget.operatorName,
            'createdAt': FieldValue.serverTimestamp(),
          });
        } catch (_) {}
      }

      SoundService.playSuccessSound();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Customer '$name' added successfully! ✅"),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      debugPrint("Error saving customer: $e");
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Failed to save: $e"), backgroundColor: AppColors.danger),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd MMM yyyy');

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          "Add New Customer",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.textPrimary),
        ),
      ),
      body: _isLoadingAreas
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                children: [
                  // Customer Type Toggle
                  _buildSectionHeader("CUSTOMER TYPE"),
                  Container(
                    margin: const EdgeInsets.only(top: 8, bottom: 16),
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => _customerType = "CABLE"),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              decoration: BoxDecoration(
                                color: _customerType == "CABLE" ? AppColors.primary : Colors.transparent,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.tv_rounded,
                                    size: 16,
                                    color: _customerType == "CABLE" ? Colors.white : AppColors.textSecondary,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    "Cable TV",
                                    style: TextStyle(
                                      color: _customerType == "CABLE" ? Colors.white : AppColors.textSecondary,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => _customerType = "DTH"),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              decoration: BoxDecoration(
                                color: _customerType == "DTH" ? AppColors.primary : Colors.transparent,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.satellite_alt_rounded,
                                    size: 16,
                                    color: _customerType == "DTH" ? Colors.white : AppColors.textSecondary,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    "DTH",
                                    style: TextStyle(
                                      color: _customerType == "DTH" ? Colors.white : AppColors.textSecondary,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Basic Details Card
                  _buildSectionHeader("PERSONAL DETAILS"),
                  Container(
                    margin: const EdgeInsets.only(top: 8, bottom: 16),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                      boxShadow: AppColors.cardShadow,
                    ),
                    child: Column(
                      children: [
                        TextFormField(
                          controller: _nameController,
                          textCapitalization: TextCapitalization.words,
                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                          decoration: _buildInputDecoration(
                            label: "Customer Name *",
                            hint: "Enter customer full name",
                            prefixIcon: Icons.person_outline_rounded,
                          ),
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) return "Customer name is required";
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _mobileController,
                          keyboardType: TextInputType.phone,
                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                          decoration: _buildInputDecoration(
                            label: "Mobile Number *",
                            hint: "10-digit mobile number",
                            prefixIcon: Icons.phone_android_rounded,
                          ),
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) return "Mobile number is required";
                            if (val.trim().length < 10) return "Enter a valid 10-digit mobile number";
                            return null;
                          },
                        ),
                      ],
                    ),
                  ),

                  // Hardware & IDs Card
                  _buildSectionHeader("STB & CONNECTION DETAILS"),
                  Container(
                    margin: const EdgeInsets.only(top: 8, bottom: 16),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                      boxShadow: AppColors.cardShadow,
                    ),
                    child: Column(
                      children: [
                        TextFormField(
                          controller: _stbController,
                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                          decoration: InputDecoration(
                            labelText: "STB / VC Number *",
                            labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                            hintText: "Enter or scan STB VC Number",
                            hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                            prefixIcon: const Icon(Icons.confirmation_number_outlined, color: AppColors.primary, size: 20),
                            suffixIcon: IconButton(
                              icon: const Icon(Icons.qr_code_scanner_rounded, color: AppColors.primary),
                              tooltip: "Scan Barcode",
                              onPressed: _scanBarcode,
                            ),
                            filled: true,
                            fillColor: AppColors.inputBg,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(color: AppColors.border),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                            ),
                          ),
                          onChanged: (val) {
                            if (_customerIdController.text.trim().isEmpty) {
                              _customerIdController.text = val.trim();
                            }
                          },
                          validator: (val) {
                            if (val == null || val.trim().isEmpty) return "STB VC Number is required";
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _customerIdController,
                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                          decoration: _buildInputDecoration(
                            label: "Customer ID (Optional)",
                            hint: "Defaults to STB number if empty",
                            prefixIcon: Icons.badge_outlined,
                          ),
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: _gtplIdController,
                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                          decoration: _buildInputDecoration(
                            label: "GTPL / NXT ID (Optional)",
                            hint: "e.g. 2643662455",
                            prefixIcon: Icons.tag_rounded,
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Area / Line Selection Card
                  _buildSectionHeader("AREA / LINE"),
                  Container(
                    margin: const EdgeInsets.only(top: 8, bottom: 16),
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
                        if (!_isCustomArea && _availableAreas.isNotEmpty) ...[
                          DropdownButtonFormField<String>(
                            initialValue: _selectedArea,
                            decoration: _buildInputDecoration(
                              label: "Select Line / Area *",
                              hint: "Choose area",
                              prefixIcon: Icons.location_on_outlined,
                            ),
                            items: _availableAreas.map((area) {
                              return DropdownMenuItem(
                                value: area,
                                child: Text(area, style: const TextStyle(color: AppColors.textPrimary, fontSize: 13.5)),
                              );
                            }).toList(),
                            onChanged: (val) => setState(() => _selectedArea = val),
                          ),
                          const SizedBox(height: 8),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton.icon(
                              onPressed: () => setState(() => _isCustomArea = true),
                              icon: const Icon(Icons.add, size: 16, color: AppColors.primary),
                              label: const Text(
                                "+ Enter New Custom Area",
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary),
                              ),
                            ),
                          ),
                        ] else ...[
                          TextFormField(
                            controller: _customAreaController,
                            style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                            decoration: _buildInputDecoration(
                              label: "Area / Line Name *",
                              hint: "e.g. LINE-10, MAIN ROAD",
                              prefixIcon: Icons.edit_location_alt_outlined,
                            ),
                            validator: (val) {
                              if (_isCustomArea && (val == null || val.trim().isEmpty)) {
                                return "Area name is required";
                              }
                              return null;
                            },
                          ),
                          if (_availableAreas.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Align(
                              alignment: Alignment.centerRight,
                              child: TextButton(
                                onPressed: () => setState(() => _isCustomArea = false),
                                child: const Text(
                                  "Back to Existing Areas",
                                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ],
                    ),
                  ),

                  // Billing & Dates Card
                  _buildSectionHeader("BILLING & SUBSCRIPTION"),
                  Container(
                    margin: const EdgeInsets.only(top: 8, bottom: 24),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                      boxShadow: AppColors.cardShadow,
                    ),
                    child: Column(
                      children: [
                        if (_availablePackages.isNotEmpty) ...[
                          DropdownButtonFormField<CablePackage>(
                            initialValue: _selectedPackage,
                            decoration: _buildInputDecoration(
                              label: "Select Package (Optional)",
                              hint: "Choose a package",
                              prefixIcon: Icons.layers_outlined,
                            ),
                            items: _availablePackages.map((pkg) {
                              return DropdownMenuItem(
                                value: pkg,
                                child: Text(
                                  "${pkg.name} — ₹${pkg.price.toInt()}",
                                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 13.5),
                                ),
                              );
                            }).toList(),
                            onChanged: (pkg) => setState(() => _selectedPackage = pkg),
                          ),
                          const SizedBox(height: 14),
                        ],
                        TextFormField(
                          controller: _balanceController,
                          keyboardType: TextInputType.number,
                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                          decoration: _buildInputDecoration(
                            label: "Opening Due / Balance (₹)",
                            hint: "0",
                            prefixIcon: Icons.currency_rupee_rounded,
                          ),
                        ),
                        const SizedBox(height: 14),
                        // Existing Recharge Toggle
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: const [
                                  Text("Already Recharged?", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary)),
                                  Text("Turn ON only if migrating an active pack", style: TextStyle(color: AppColors.textMuted, fontSize: 10.5)),
                                ],
                              ),
                            ),
                            Switch.adaptive(
                              value: _setCustomDates,
                              activeColor: AppColors.primary,
                              onChanged: (val) {
                                setState(() {
                                  _setCustomDates = val;
                                  if (val && _lastRechargeDate == null) {
                                    _lastRechargeDate = DateTime.now();
                                    _expiryDate = DateTime.now().add(const Duration(days: 30));
                                  }
                                });
                              },
                            ),
                          ],
                        ),
                        if (_setCustomDates) ...[
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: InkWell(
                                  onTap: () => _pickDate(isRechargeDate: true),
                                  borderRadius: BorderRadius.circular(10),
                                  child: Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: AppColors.inputBg,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: AppColors.border),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Text("Last Recharge", style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                                        const SizedBox(height: 4),
                                        Row(
                                          children: [
                                            const Icon(Icons.calendar_today_rounded, size: 14, color: AppColors.primary),
                                            const SizedBox(width: 6),
                                            Text(
                                              _lastRechargeDate != null ? dateFormat.format(_lastRechargeDate!) : "Select",
                                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textPrimary),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: InkWell(
                                  onTap: () => _pickDate(isRechargeDate: false),
                                  borderRadius: BorderRadius.circular(10),
                                  child: Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: AppColors.inputBg,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: AppColors.border),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Text("Expiry Date", style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
                                        const SizedBox(height: 4),
                                        Row(
                                          children: [
                                            const Icon(Icons.event_available_rounded, size: 14, color: Color(0xFF16A34A)),
                                            const SizedBox(width: 6),
                                            Text(
                                              _expiryDate != null ? dateFormat.format(_expiryDate!) : "Select",
                                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textPrimary),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),

                  // Submit Button
                  SizedBox(
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _isSubmitting ? null : _submitCustomer,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        elevation: 3,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _isSubmitting
                          ? const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.2)),
                                SizedBox(width: 12),
                                Text("Saving Customer...", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                              ],
                            )
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.person_add_alt_1_rounded, size: 20),
                                SizedBox(width: 8),
                                Text("Save & Register Customer", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                              ],
                            ),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w900,
        letterSpacing: 0.8,
        color: AppColors.textSecondary,
      ),
    );
  }

  InputDecoration _buildInputDecoration({
    required String label,
    required String hint,
    required IconData prefixIcon,
  }) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
      hintText: hint,
      hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
      prefixIcon: Icon(prefixIcon, color: AppColors.primary, size: 20),
      filled: true,
      fillColor: AppColors.inputBg,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.danger),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
      ),
    );
  }
}
