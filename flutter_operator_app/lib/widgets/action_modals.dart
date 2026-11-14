import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/customer.dart';
import '../models/models.dart';
import '../services/sound_service.dart';
import '../services/whatsapp_service.dart';
import '../theme/app_theme.dart';
import '../screens/edit_customer_screen.dart';
import 'success_dialog.dart';

class ActionModals {
  // Helper: Customer Picker Modal
  static Future<Customer?> pickCustomer(
    BuildContext context,
    List<Customer> allCustomers,
  ) async {
    return showModalBottomSheet<Customer>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        String query = "";
        return StatefulBuilder(
          builder: (context, setModalState) {
            final filtered = allCustomers.where((c) {
              final q = query.toLowerCase();
              return c.name.toLowerCase().contains(q) ||
                  c.customerId.toLowerCase().contains(q) ||
                  c.mobile.contains(q) ||
                  (c.stbId != null && c.stbId!.toLowerCase().contains(q));
            }).toList();

            return Container(
              height: MediaQuery.of(context).size.height * 0.75,
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        "Select Customer",
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: AppColors.textSecondary),
                        onPressed: () => Navigator.pop(context),
                      )
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    autofocus: true,
                    style: const TextStyle(color: AppColors.textPrimary),
                    decoration: InputDecoration(
                      hintText: "Search by Name, STB ID, Mobile...",
                      hintStyle: const TextStyle(color: AppColors.textMuted),
                      prefixIcon: const Icon(Icons.search, color: AppColors.textMuted),
                      filled: true,
                      fillColor: AppColors.surfaceSecondary,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                    ),
                    onChanged: (val) {
                      setModalState(() => query = val);
                    },
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: filtered.isEmpty
                        ? Center(
                            child: Text(
                              "No customers found matching '$query'",
                              style: TextStyle(color: Colors.white.withOpacity(0.4)),
                            ),
                          )
                        : ListView.separated(
                            itemCount: filtered.length,
                            separatorBuilder: (_, __) => const Divider(color: AppColors.border),
                            itemBuilder: (context, index) {
                              final cust = filtered[index];
                              return ListTile(
                                contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                leading: CircleAvatar(
                                  backgroundColor: AppColors.primaryBg,
                                  child: Text(
                                    cust.name.isNotEmpty ? cust.name[0].toUpperCase() : 'C',
                                    style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
                                  ),
                                ),
                                title: Text(
                                  cust.name,
                                  style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600),
                                ),
                                subtitle: Text(
                                  "ID: ${cust.displayId} • ${cust.mobile}",
                                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                                ),
                                trailing: Text(
                                  "₹${cust.balanceAmount.toInt()}",
                                  style: TextStyle(
                                    color: cust.balanceAmount > 0 ? AppColors.danger : AppColors.success,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                onTap: () => Navigator.pop(context, cust),
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // Helper: Live Customer Selector with ID Input & Auto-retrieved Details
  static Widget _buildCustomerSelector({
    required BuildContext context,
    required TextEditingController controller,
    required Customer? selectedCustomer,
    required List<Customer> suggestions,
    required List<Customer> allCustomers,
    required void Function(Customer?) onSelect,
    required void Function(List<Customer>) onSuggestions,
  }) {
    final isExpired = selectedCustomer?.expiryDate != null &&
        selectedCustomer!.expiryDate!.isBefore(DateTime.now());

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                keyboardType: TextInputType.text,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
                decoration: InputDecoration(
                  hintText: "Enter Customer ID (e.g. 438, 001)...",
                  hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                  prefixIcon: const Icon(Icons.badge_outlined, color: AppColors.primary, size: 20),
                  suffixIcon: controller.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear_rounded, size: 18, color: AppColors.textMuted),
                          onPressed: () {
                            controller.clear();
                            onSelect(null);
                            onSuggestions([]);
                          },
                        )
                      : null,
                  filled: true,
                  fillColor: AppColors.surfaceSecondary,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
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
                    borderSide: const BorderSide(color: AppColors.primary, width: 2),
                  ),
                ),
                onChanged: (val) {
                  final q = val.trim().toLowerCase();
                  if (q.isEmpty) {
                    onSelect(null);
                    onSuggestions([]);
                    return;
                  }

                  // 1. Exact match by displayId, customerId, stbId, or mobile
                  final exact = allCustomers.where((c) {
                    return c.displayId.toLowerCase() == q ||
                        c.customerId.toLowerCase() == q ||
                        (c.stbId != null && c.stbId!.toLowerCase() == q) ||
                        c.mobile.toLowerCase() == q;
                  }).toList();

                  if (exact.isNotEmpty) {
                    onSelect(exact.first);
                    onSuggestions([]);
                  } else {
                    // 2. Partial matches for suggestions
                    final matches = allCustomers.where((c) {
                      return c.displayId.toLowerCase().contains(q) ||
                          c.customerId.toLowerCase().contains(q) ||
                          c.name.toLowerCase().contains(q) ||
                          c.mobile.contains(q) ||
                          (c.stbId != null && c.stbId!.toLowerCase().contains(q));
                    }).take(5).toList();

                    onSuggestions(matches);
                    if (selectedCustomer != null) {
                      onSelect(null);
                    }
                  }
                },
              ),
            ),
            const SizedBox(width: 8),
            InkWell(
              onTap: () async {
                final picked = await pickCustomer(context, allCustomers);
                if (picked != null) {
                  controller.text = picked.displayId;
                  onSelect(picked);
                  onSuggestions([]);
                }
              },
              borderRadius: BorderRadius.circular(14),
              child: Container(
                height: 44,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: AppColors.primaryBg,
                  border: Border.all(color: AppColors.primaryBorder),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.list_alt_rounded, color: AppColors.primary, size: 18),
                    SizedBox(width: 4),
                    Text(
                      "List",
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),

        // Live Suggestions List when typing
        if (selectedCustomer == null && suggestions.isNotEmpty) ...[
          const SizedBox(height: 6),
          Container(
            constraints: const BoxConstraints(maxHeight: 180),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
              boxShadow: AppColors.cardShadow,
            ),
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: suggestions.length,
              separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.border),
              itemBuilder: (context, idx) {
                final s = suggestions[idx];
                return ListTile(
                  dense: true,
                  visualDensity: VisualDensity.compact,
                  leading: CircleAvatar(
                    radius: 14,
                    backgroundColor: AppColors.primaryBg,
                    child: Text(
                      s.name.isNotEmpty ? s.name[0].toUpperCase() : 'C',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary),
                    ),
                  ),
                  title: Text(
                    "${s.name} (ID: ${s.displayId})",
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  subtitle: Text(
                    "${s.mobile} • ${s.area.isNotEmpty ? s.area : 'No area'}",
                    style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                  ),
                  trailing: const Icon(Icons.touch_app_rounded, size: 16, color: AppColors.primary),
                  onTap: () {
                    controller.text = s.displayId;
                    onSelect(s);
                    onSuggestions([]);
                  },
                );
              },
            ),
          ),
        ],

        // Selected Customer Details Card
        if (selectedCustomer != null) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.5)),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF10B981).withValues(alpha: 0.08),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 16,
                            backgroundColor: const Color(0xFFECFDF5),
                            child: Text(
                              selectedCustomer.name.isNotEmpty ? selectedCustomer.name[0].toUpperCase() : 'C',
                              style: const TextStyle(color: Color(0xFF059669), fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  selectedCustomer.name,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  "ID: ${selectedCustomer.displayId} • ${selectedCustomer.mobile}",
                                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: isExpired ? AppColors.dangerBg : AppColors.successBg,
                        border: Border.all(color: isExpired ? AppColors.dangerBorder : AppColors.successBorder),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        isExpired ? "EXPIRED" : "ACTIVE",
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: isExpired ? AppColors.danger : AppColors.success,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Divider(height: 1, color: AppColors.border),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text("Area / Line", style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
                        Text(
                          selectedCustomer.area.isNotEmpty ? selectedCustomer.area : "N/A",
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text("Current Expiry", style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
                        Text(
                          selectedCustomer.expiryDate != null
                              ? DateFormat('dd MMM yyyy').format(selectedCustomer.expiryDate!)
                              : "No date",
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: isExpired ? AppColors.danger : AppColors.textPrimary,
                          ),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const Text("Due Balance", style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
                        Text(
                          "₹${selectedCustomer.balanceAmount.toInt()}",
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: selectedCustomer.balanceAmount > 0 ? AppColors.danger : AppColors.success,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  // 1. RECHARGE MODAL
  static Future<void> showRechargeModal(
    BuildContext context, {
    required List<Customer> allCustomers,
    required List<CablePackage> packages,
    required String operatorName,
    required String operatorUid,
    Customer? preSelectedCustomer,
  }) async {
    final effectivePackages = packages.isNotEmpty
        ? packages
        : [
            CablePackage(id: "pkg-1", name: "Sambaralu Telugu", price: 350.0, threeMonthPrice: 1050.0, sixMonthPrice: 2100.0, twelveMonthPrice: 4200.0),
            CablePackage(id: "pkg-2", name: "Sambaralu Telugu HD", price: 450.0, threeMonthPrice: 1350.0, sixMonthPrice: 2700.0, twelveMonthPrice: 5400.0),
            CablePackage(id: "pkg-3", name: "Basic Cable Pack", price: 250.0, threeMonthPrice: 750.0, sixMonthPrice: 1500.0, twelveMonthPrice: 3000.0),
          ];

    Customer? selectedCustomer = preSelectedCustomer;
    CablePackage? selectedPackage = effectivePackages.first;
    int selectedMonths = 1;
    bool isSubmitting = false;
    final idSearchController = TextEditingController(
      text: preSelectedCustomer != null ? preSelectedCustomer.displayId : "",
    );
    List<Customer> suggestions = [];

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            double totalAmount;
            if (selectedPackage != null) {
              if (selectedMonths == 3 && selectedPackage!.threeMonthPrice != null && selectedPackage!.threeMonthPrice! > 0) {
                totalAmount = selectedPackage!.threeMonthPrice!;
              } else if (selectedMonths == 6 && selectedPackage!.sixMonthPrice != null && selectedPackage!.sixMonthPrice! > 0) {
                totalAmount = selectedPackage!.sixMonthPrice!;
              } else if (selectedMonths == 12 && selectedPackage!.twelveMonthPrice != null && selectedPackage!.twelveMonthPrice! > 0) {
                totalAmount = selectedPackage!.twelveMonthPrice!;
              } else {
                totalAmount = selectedPackage!.price * selectedMonths;
              }
            } else {
              totalAmount = 250.0 * selectedMonths;
            }

            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.credit_card_rounded, color: Color(0xFF10B981), size: 22),
                            SizedBox(width: 8),
                            Text(
                              "Customer Recharge",
                              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                            ),
                          ],
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, color: AppColors.textSecondary),
                          onPressed: () => Navigator.pop(context),
                        )
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Customer Selector with Direct ID Input
                    const Text("Customer", style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    _buildCustomerSelector(
                      context: context,
                      controller: idSearchController,
                      selectedCustomer: selectedCustomer,
                      suggestions: suggestions,
                      allCustomers: allCustomers,
                      onSelect: (c) {
                        setModalState(() {
                          selectedCustomer = c;
                          suggestions = [];
                        });
                      },
                      onSuggestions: (sList) {
                        setModalState(() => suggestions = sList);
                      },
                    ),
                    const SizedBox(height: 16),

                    // Package Selection
                    const Text("Package", style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceSecondary,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<CablePackage>(
                          value: selectedPackage,
                          dropdownColor: Colors.white,
                          isExpanded: true,
                          items: effectivePackages.map((pkg) {
                            return DropdownMenuItem<CablePackage>(
                              value: pkg,
                              child: Text(
                                "${pkg.name} — ₹${pkg.price.toInt()}/month",
                                style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            );
                          }).toList(),
                          onChanged: (pkg) {
                            if (pkg != null) setModalState(() => selectedPackage = pkg);
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Months validity
                    const Text("Validity Period", style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    Row(
                      children: [1, 3, 6, 12].map((m) {
                        final isSelected = selectedMonths == m;
                        return Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: ChoiceChip(
                              label: Text("$m Mo"),
                              selected: isSelected,
                              selectedColor: const Color(0xFF10B981),
                              backgroundColor: const Color(0xFFF8FAFC),
                              side: BorderSide(
                                color: isSelected ? const Color(0xFF10B981) : const Color(0xFFCBD5E1),
                                width: 1.2,
                              ),
                              labelStyle: TextStyle(
                                color: isSelected ? Colors.white : const Color(0xFF334155),
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                              onSelected: (_) {
                                setModalState(() => selectedMonths = m);
                              },
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 20),

                    // Summary Breakdown Box (Old Balance + Recharge Amount = New Total Due)
                    Builder(builder: (_) {
                      final double oldBal = selectedCustomer?.balanceAmount ?? 0.0;
                      final double newTotalDue = oldBal + totalAmount;
                      final currency = NumberFormat('#,##,###');

                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FDF4),
                          border: Border.all(color: const Color(0xFF86EFAC)),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Column(
                          children: [
                            // 1. Recharge Amount Row
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Text(
                                  "Recharge Amount:",
                                  style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                                ),
                                Text(
                                  "₹${totalAmount.toInt()}",
                                  style: const TextStyle(
                                    color: Color(0xFF059669),
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),

                            // MSO Cost & Margin Row
                            Builder(builder: (_) {
                              final msoPerMo = selectedPackage?.effectiveMsoAmount ?? (totalAmount / selectedMonths * 0.70);
                              final msoTotal = (msoPerMo * selectedMonths).roundToDouble();
                              final margin = totalAmount - msoTotal;

                              return Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text(
                                      "MSO Cost:",
                                      style: TextStyle(color: Color(0xFFB45309), fontSize: 12, fontWeight: FontWeight.w500),
                                    ),
                                    Text(
                                      "₹${msoTotal.toInt()}  (Margin: +₹${margin.toInt()})",
                                      style: const TextStyle(
                                        color: Color(0xFFB45309),
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }),

                            if (selectedCustomer != null) ...[
                              const SizedBox(height: 6),
                              // 2. Old Due Balance Row
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    "Previous Due:",
                                    style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                                  ),
                                  Text(
                                    oldBal < 0
                                        ? "-₹${currency.format(oldBal.abs().toInt())} (Adv)"
                                        : (oldBal == 0
                                            ? "₹0"
                                            : "₹${currency.format(oldBal.toInt())}"),
                                    style: TextStyle(
                                      color: oldBal > 0 ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                              const Padding(
                                padding: EdgeInsets.symmetric(vertical: 8),
                                child: Divider(height: 1, color: Color(0xFFBBF7D0)),
                              ),
                              // 3. New Total Due Row
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    "New Total Due:",
                                    style: TextStyle(
                                      color: AppColors.textPrimary,
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  Text(
                                    newTotalDue < 0
                                        ? "-₹${currency.format(newTotalDue.abs().toInt())} (Adv)"
                                        : "₹${currency.format(newTotalDue.toInt())}",
                                    style: TextStyle(
                                      color: newTotalDue > 0
                                          ? const Color(0xFFB91C1C)
                                          : const Color(0xFF059669),
                                      fontSize: 22,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      );
                    }),
                    const SizedBox(height: 20),

                    // Submit & WhatsApp Button
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.check_circle_rounded, size: 20),
                        label: isSubmitting
                            ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                            : const Text("Recharge", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981),
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: const Color(0xFFE2E8F0),
                          disabledForegroundColor: const Color(0xFF94A3B8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        onPressed: (isSubmitting || selectedCustomer == null)
                            ? null
                            : () async {
                                setModalState(() => isSubmitting = true);
                                try {
                                  final now = DateTime.now();
                                  final currentExp = selectedCustomer!.expiryDate ?? now;
                                  final baseStart = currentExp.isAfter(now) ? currentExp : now;
                                  final newExpiry = baseStart.add(Duration(days: 30 * selectedMonths));
                                  final newBalance = selectedCustomer!.balanceAmount + totalAmount;

                                  // 1. Update Customer document in Firestore (expiry & new balance due)
                                  await FirebaseFirestore.instance
                                      .collection('customers')
                                      .doc(selectedCustomer!.id)
                                      .update({
                                    'expiryDate': Timestamp.fromDate(newExpiry),
                                    'lastRechargeDate': Timestamp.fromDate(now),
                                    'balanceAmount': newBalance,
                                  });

                                  final double msoPerMo = selectedPackage?.effectiveMsoAmount ?? (totalAmount / selectedMonths * 0.70);
                                  final double msoTotal = (msoPerMo * selectedMonths).roundToDouble();
                                  final double profitMargin = totalAmount - msoTotal;

                                  // 2. Record in 'recharges' collection
                                  await FirebaseFirestore.instance.collection('recharges').add({
                                    'customerId': selectedCustomer!.id,
                                    'customerName': selectedCustomer!.name,
                                    'packageId': selectedPackage?.id ?? '',
                                    'packageName': selectedPackage?.name ?? 'Standard Package',
                                    'amount': totalAmount,
                                    'msoCost': msoTotal,
                                    'profitMargin': profitMargin,
                                    'months': selectedMonths,
                                    'rechargeDate': Timestamp.fromDate(now),
                                    'rechargedBy': operatorUid,
                                    'rechargedByName': operatorName,
                                    'adminId': selectedCustomer!.adminId,
                                    'type': 'Recharge',
                                    'paymentReceived': false,
                                  });

                                  if (context.mounted) {
                                    Navigator.pop(context);

                                    // Play PhonePe success chime
                                    SoundService.playSuccessSound();

                                    // Show PhonePe-style Success Popup
                                    PaymentSuccessDialog.show(
                                      context,
                                      customer: selectedCustomer!,
                                      amountPaid: totalAmount,
                                      paymentMethod: "Billed to Due",
                                      remainingBalance: newBalance,
                                      previousBalance: selectedCustomer!.balanceAmount,
                                      operatorName: operatorName,
                                      packageName: selectedPackage?.name,
                                      isRecharge: true,
                                    );
                                  }
                                } catch (e) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red),
                                  );
                                }
                              },
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  // 2. COLLECT PAYMENT MODAL
  static Future<void> showCollectModal(
    BuildContext context, {
    required List<Customer> allCustomers,
    required String operatorName,
    required String operatorUid,
    Customer? preSelectedCustomer,
  }) async {
    Customer? selectedCustomer = preSelectedCustomer;
    final amountController = TextEditingController();
    final idSearchController = TextEditingController(
      text: preSelectedCustomer != null ? preSelectedCustomer.displayId : "",
    );
    List<Customer> suggestions = [];
    String paymentMethod = "Cash";
    bool isSubmitting = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.currency_rupee, color: Color(0xFFEA580C), size: 22),
                            SizedBox(width: 8),
                            Text(
                              "Collect Bill Payment",
                              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                            ),
                          ],
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, color: AppColors.textSecondary),
                          onPressed: () => Navigator.pop(context),
                        )
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Customer Selector with Direct ID Input
                    const Text("Customer", style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    _buildCustomerSelector(
                      context: context,
                      controller: idSearchController,
                      selectedCustomer: selectedCustomer,
                      suggestions: suggestions,
                      allCustomers: allCustomers,
                      onSelect: (c) {
                        setModalState(() {
                          selectedCustomer = c;
                          suggestions = [];
                        });
                      },
                      onSuggestions: (sList) {
                        setModalState(() => suggestions = sList);
                      },
                    ),
                    const SizedBox(height: 16),

                    // Amount to Collect
                    const Text("Amount Collected (₹)", style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    TextField(
                      controller: amountController,
                      keyboardType: TextInputType.number,
                      onChanged: (val) => setModalState(() {}),
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold),
                      decoration: InputDecoration(
                        hintText: "Enter amount",
                        hintStyle: const TextStyle(color: AppColors.textMuted),
                        prefixIcon: const Icon(Icons.currency_rupee, color: AppColors.textMuted),
                        filled: true,
                        fillColor: AppColors.surfaceSecondary,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.border)),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.border)),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.primary, width: 2)),
                      ),
                    ),

                    // Live Remaining / Advance Balance Box
                    Builder(
                      builder: (context) {
                        final enteredAmount = double.tryParse(amountController.text.trim()) ?? 0.0;
                        if (selectedCustomer == null || amountController.text.trim().isEmpty) {
                          return const SizedBox.shrink();
                        }

                        final remainingBalance = selectedCustomer!.balanceAmount - enteredAmount;

                        return Container(
                          margin: const EdgeInsets.only(top: 10),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: remainingBalance < 0
                                ? const Color(0xFFEFF6FF)
                                : remainingBalance == 0
                                    ? const Color(0xFFF0FDF4)
                                    : const Color(0xFFFFF7ED),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: remainingBalance < 0
                                  ? const Color(0xFFBFDBFE)
                                  : remainingBalance == 0
                                      ? const Color(0xFFBBF7D0)
                                      : const Color(0xFFFFEDD5),
                              width: 1.2,
                            ),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Icon(
                                    remainingBalance < 0
                                        ? Icons.account_balance_wallet_outlined
                                        : remainingBalance == 0
                                            ? Icons.check_circle_outline_rounded
                                            : Icons.pending_actions_rounded,
                                    size: 20,
                                    color: remainingBalance < 0
                                        ? const Color(0xFF2563EB)
                                        : remainingBalance == 0
                                            ? const Color(0xFF16A34A)
                                            : const Color(0xFFEA580C),
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    remainingBalance < 0
                                        ? "Advance Balance (-):"
                                        : remainingBalance == 0
                                            ? "Balance Cleared:"
                                            : "Remaining Due Balance:",
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: remainingBalance < 0
                                          ? const Color(0xFF1E40AF)
                                          : remainingBalance == 0
                                              ? const Color(0xFF166534)
                                              : const Color(0xFF9A3412),
                                    ),
                                  ),
                                ],
                              ),
                              Text(
                                remainingBalance < 0
                                    ? "-₹${(-remainingBalance).toInt()}"
                                    : "₹${remainingBalance.toInt()}",
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w900,
                                  color: remainingBalance < 0
                                      ? const Color(0xFF2563EB)
                                      : remainingBalance == 0
                                          ? const Color(0xFF16A34A)
                                          : const Color(0xFFEA580C),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 16),

                    // Payment Method
                    const Text("Payment Method", style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    Row(
                      children: ["Cash", "PhonePe"].map((method) {
                        final isSel = paymentMethod == method;
                        return Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: ChoiceChip(
                              label: Text(method),
                              selected: isSel,
                              selectedColor: const Color(0xFFEA580C),
                              backgroundColor: const Color(0xFFF8FAFC),
                              side: BorderSide(
                                color: isSel ? const Color(0xFFEA580C) : const Color(0xFFCBD5E1),
                                width: 1.2,
                              ),
                              labelStyle: TextStyle(
                                color: isSel ? Colors.white : const Color(0xFF334155),
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                              onSelected: (_) => setModalState(() => paymentMethod = method),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 24),

                    // Submit & WhatsApp Button
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.check_circle_rounded, size: 20),
                        label: isSubmitting
                            ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                            : const Text("Collect", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFEA580C),
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: const Color(0xFFE2E8F0),
                          disabledForegroundColor: const Color(0xFF94A3B8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        onPressed: (isSubmitting || selectedCustomer == null)
                            ? null
                            : () async {
                                final amount = double.tryParse(amountController.text) ?? 0.0;
                                if (amount <= 0) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text("Please enter a valid amount")),
                                  );
                                  return;
                                }

                                setModalState(() => isSubmitting = true);
                                try {
                                  final now = DateTime.now();
                                  final newBalance = selectedCustomer!.balanceAmount - amount;

                                  // Update Customer Balance
                                  await FirebaseFirestore.instance
                                      .collection('customers')
                                      .doc(selectedCustomer!.id)
                                      .update({'balanceAmount': newBalance});

                                  // Record payment
                                  await FirebaseFirestore.instance.collection('payments').add({
                                    'customerId': selectedCustomer!.id,
                                    'customerName': selectedCustomer!.name,
                                    'amount': amount,
                                    'method': paymentMethod,
                                    'collectedBy': operatorUid,
                                    'collectionDate': Timestamp.fromDate(now),
                                    'adminId': selectedCustomer!.adminId,
                                  });

                                  if (context.mounted) {
                                    Navigator.pop(context);

                                    // Play PhonePe success chime
                                    SoundService.playSuccessSound();

                                    // Show PhonePe-style Success Popup
                                    PaymentSuccessDialog.show(
                                      context,
                                      customer: selectedCustomer!,
                                      amountPaid: amount,
                                      paymentMethod: paymentMethod,
                                      remainingBalance: newBalance,
                                      previousBalance: selectedCustomer!.balanceAmount,
                                      operatorName: operatorName,
                                    );
                                  }
                                } catch (e) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red),
                                  );
                                }
                              },
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  // 3. + EXTRA DUE MODAL (Service Charge)
  static Future<void> showExtraDueModal(
    BuildContext context, {
    required List<Customer> allCustomers,
    required String operatorName,
    required String operatorUid,
    Customer? preSelectedCustomer,
  }) async {
    Customer? selectedCustomer = preSelectedCustomer;
    String selectedReason = "Wire Repair";
    final amountController = TextEditingController(text: "200");
    final idSearchController = TextEditingController(
      text: preSelectedCustomer != null ? preSelectedCustomer.displayId : "",
    );
    List<Customer> suggestions = [];
    bool isSubmitting = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.add_circle_outline, color: Colors.amber, size: 22),
                            SizedBox(width: 8),
                            Text(
                              "Add Extra Due / Service Charge",
                              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                            ),
                          ],
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, color: AppColors.textSecondary),
                          onPressed: () => Navigator.pop(context),
                        )
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Customer Selector with Direct ID Input
                    const Text("Customer", style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    _buildCustomerSelector(
                      context: context,
                      controller: idSearchController,
                      selectedCustomer: selectedCustomer,
                      suggestions: suggestions,
                      allCustomers: allCustomers,
                      onSelect: (c) {
                        setModalState(() {
                          selectedCustomer = c;
                          suggestions = [];
                        });
                      },
                      onSuggestions: (sList) {
                        setModalState(() => suggestions = sList);
                      },
                    ),
                    const SizedBox(height: 16),

                    // Service Reason
                    const Text("Reason for Extra Due", style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: ["Wire Repair", "Replace STB", "STB Shift", "Connector", "New Remote", "Technician Visit"].map((r) {
                        final isSel = selectedReason == r;
                        return ChoiceChip(
                          label: Text(r),
                          selected: isSel,
                          selectedColor: const Color(0xFFD97706),
                          backgroundColor: const Color(0xFFF8FAFC),
                          side: BorderSide(
                            color: isSel ? const Color(0xFFD97706) : const Color(0xFFCBD5E1),
                            width: 1.2,
                          ),
                          labelStyle: TextStyle(
                            color: isSel ? Colors.white : const Color(0xFF334155),
                            fontWeight: FontWeight.bold,
                            fontSize: 11,
                          ),
                          onSelected: (_) => setModalState(() => selectedReason = r),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 16),

                    // Amount
                    const Text("Charge Amount (₹)", style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    TextField(
                      controller: amountController,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(color: AppColors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold),
                      decoration: InputDecoration(
                        hintText: "Enter amount",
                        hintStyle: const TextStyle(color: AppColors.textMuted),
                        prefixIcon: const Icon(Icons.currency_rupee, color: AppColors.textMuted),
                        filled: true,
                        fillColor: AppColors.surfaceSecondary,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.border)),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.border)),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFD97706), width: 2)),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Submit & WhatsApp Button
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.add_task, size: 18),
                        label: isSubmitting
                            ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                            : const Text("Add Due & Send WhatsApp Alert", style: TextStyle(fontWeight: FontWeight.bold)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFD97706),
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: const Color(0xFFE2E8F0),
                          disabledForegroundColor: const Color(0xFF94A3B8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        onPressed: (isSubmitting || selectedCustomer == null)
                            ? null
                            : () async {
                                final amount = double.tryParse(amountController.text) ?? 0.0;
                                if (amount <= 0) return;

                                setModalState(() => isSubmitting = true);
                                try {
                                  final now = DateTime.now();
                                  final newTotal = selectedCustomer!.balanceAmount + amount;

                                  // 1. Update customer's total due balance
                                  await FirebaseFirestore.instance
                                      .collection('customers')
                                      .doc(selectedCustomer!.id)
                                      .update({
                                    'balanceAmount': newTotal,
                                    'updatedAt': FieldValue.serverTimestamp(),
                                  });

                                  // 2. Record in 'recharges' collection so it appears in Ledger & Passbook!
                                  await FirebaseFirestore.instance.collection('recharges').add({
                                    'customerId': selectedCustomer!.id,
                                    'customerName': selectedCustomer!.name,
                                    'amount': amount,
                                    'msoCost': 0.0, // Extra due is 100% operator service revenue
                                    'profitMargin': amount,
                                    'packageName': "Service Charge - $selectedReason",
                                    'isExtraDue': true,
                                    'reason': selectedReason,
                                    'rechargeDate': Timestamp.fromDate(now),
                                    'rechargedBy': operatorUid,
                                    'rechargedByName': operatorName,
                                    'adminId': selectedCustomer!.adminId,
                                    'type': 'Extra Due',
                                    'paymentReceived': false,
                                  });

                                  if (context.mounted) {
                                    Navigator.pop(context);

                                    // Play success chime
                                    SoundService.playSuccessSound();

                                    // Show PhonePe-style Success Popup
                                    PaymentSuccessDialog.show(
                                      context,
                                      customer: selectedCustomer!,
                                      amountPaid: amount,
                                      paymentMethod: "Added to Due ($selectedReason)",
                                      remainingBalance: newTotal,
                                      previousBalance: selectedCustomer!.balanceAmount,
                                      operatorName: operatorName,
                                      packageName: "Service: $selectedReason",
                                      isRecharge: false,
                                    );
                                  }

                                  final msg = WhatsAppService.getExtraDueReceiptMessage(
                                    customerName: selectedCustomer!.name,
                                    customerId: selectedCustomer!.displayId,
                                    customerDocId: selectedCustomer!.id,
                                    reason: selectedReason,
                                    amount: amount,
                                    newTotalBalance: newTotal,
                                    operatorName: operatorName,
                                  );

                                  await WhatsAppService.sendWhatsApp(
                                    mobile: selectedCustomer!.mobile,
                                    message: msg,
                                  );
                                } catch (e) {
                                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Error: $e")));
                                }
                              },
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  // 4. COMPLAINT REGISTRATION MODAL
  static Future<void> showComplaintModal(
    BuildContext context, {
    required List<Customer> allCustomers,
    required String operatorName,
    required String operatorUid,
    Customer? preSelectedCustomer,
  }) async {
    Customer? selectedCustomer = preSelectedCustomer;
    String selectedIssue = "No Signal / Blue Screen";
    final detailsController = TextEditingController();
    final idSearchController = TextEditingController(
      text: preSelectedCustomer != null ? preSelectedCustomer.displayId : "",
    );
    List<Customer> suggestions = [];
    bool isSubmitting = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.message_outlined, color: Color(0xFFFB7185), size: 22),
                            SizedBox(width: 8),
                            Text(
                              "Register Customer Complaint",
                              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                            ),
                          ],
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, color: AppColors.textSecondary),
                          onPressed: () => Navigator.pop(context),
                        )
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Customer Selector with Direct ID Input
                    const Text("Customer", style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    _buildCustomerSelector(
                      context: context,
                      controller: idSearchController,
                      selectedCustomer: selectedCustomer,
                      suggestions: suggestions,
                      allCustomers: allCustomers,
                      onSelect: (c) {
                        setModalState(() {
                          selectedCustomer = c;
                          suggestions = [];
                        });
                      },
                      onSuggestions: (sList) {
                        setModalState(() => suggestions = sList);
                      },
                    ),
                    if (selectedCustomer != null) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FDF4),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFBBF7D0)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 16),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                "${selectedCustomer!.name} (ID: ${selectedCustomer!.displayId}) • ${selectedCustomer!.area}",
                                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF166534)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),

                    // Common Issues
                    const Text("Common Issues", style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        "No Signal / Blue Screen",
                        "Wire Cut / Fiber Damage",
                        "Remote Not Working",
                        "Box Not Powering ON",
                        "Audio / Picture Glitch",
                        "STB Relocation",
                        "Replace STB",
                      ].map((issue) {
                        final isSel = selectedIssue == issue;
                        return ChoiceChip(
                          label: Text(issue),
                          selected: isSel,
                          selectedColor: const Color(0xFFDC2626),
                          backgroundColor: const Color(0xFFF8FAFC),
                          side: BorderSide(
                            color: isSel ? const Color(0xFFDC2626) : const Color(0xFFCBD5E1),
                            width: 1.2,
                          ),
                          labelStyle: TextStyle(
                            color: isSel ? Colors.white : const Color(0xFF334155),
                            fontWeight: FontWeight.bold,
                            fontSize: 11.5,
                          ),
                          onSelected: (_) => setModalState(() => selectedIssue = issue),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 16),

                    // Additional details
                    const Text("Notes / Description (Optional)", style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    TextField(
                      controller: detailsController,
                      maxLines: 2,
                      style: const TextStyle(color: AppColors.textPrimary),
                      decoration: InputDecoration(
                        hintText: "Add landmark or specific customer comment...",
                        hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                        filled: true,
                        fillColor: AppColors.surfaceSecondary,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.border)),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.border)),
                        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFDC2626), width: 2)),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Submit & WhatsApp Button
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.send_rounded, size: 18),
                        label: isSubmitting
                            ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                            : const Text("Register & Send WhatsApp Alert", style: TextStyle(fontWeight: FontWeight.bold)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFDC2626),
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: const Color(0xFFE2E8F0),
                          disabledForegroundColor: const Color(0xFF94A3B8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        onPressed: isSubmitting
                            ? null
                            : () async {
                                if (selectedCustomer == null) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text("Please select a Customer first!"),
                                      backgroundColor: AppColors.danger,
                                    ),
                                  );
                                  return;
                                }

                                setModalState(() => isSubmitting = true);
                                try {
                                  final fullIssue = detailsController.text.trim().isNotEmpty
                                      ? "$selectedIssue (${detailsController.text.trim()})"
                                      : selectedIssue;

                                  final docRef = await FirebaseFirestore.instance.collection('complaints').add({
                                    'customerId': selectedCustomer!.id,
                                    'customerName': selectedCustomer!.name,
                                    'customerMobile': selectedCustomer!.mobile,
                                    'customerAddress': selectedCustomer!.area,
                                    'complaint': fullIssue,
                                    'status': 'Pending',
                                    'createdAt': Timestamp.now(),
                                    'registeredBy': operatorUid,
                                    'adminId': selectedCustomer!.adminId,
                                  });

                                  if (context.mounted) {
                                    Navigator.pop(context);

                                    // Play PhonePe success chime
                                    SoundService.playSuccessSound();

                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text("Complaint for ${selectedCustomer!.name} registered successfully! ✅"),
                                        backgroundColor: AppColors.success,
                                      ),
                                    );
                                  }

                                  final msg = WhatsAppService.getComplaintRegisteredMessage(
                                    customerName: selectedCustomer!.name,
                                    customerId: selectedCustomer!.displayId,
                                    complaintText: fullIssue,
                                    complaintId: docRef.id,
                                  );

                                  await WhatsAppService.sendWhatsApp(
                                    mobile: selectedCustomer!.mobile,
                                    message: msg,
                                  );
                                } catch (e) {
                                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Error: $e")));
                                }
                              },
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  // 5. EDIT CUSTOMER DETAILS (FULL SCREEN PAGE)
  static Future<void> showEditCustomerModal(
    BuildContext context, {
    required Customer customer,
  }) async {
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => EditCustomerScreen(customer: customer),
      ),
    );
  }
}
