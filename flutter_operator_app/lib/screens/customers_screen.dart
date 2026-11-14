import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/customer.dart';
import '../models/models.dart';
import '../services/whatsapp_service.dart';
import '../theme/app_theme.dart';
import '../widgets/action_modals.dart';
import 'customer_ledger_screen.dart';

class CustomersScreen extends StatefulWidget {
  final String operatorName;
  final String operatorUid;
  final VoidCallback? onOpenDrawer;

  const CustomersScreen({
    super.key,
    required this.operatorName,
    required this.operatorUid,
    this.onOpenDrawer,
  });

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  String _searchQuery = "";
  bool _onlyWithDue = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: widget.onOpenDrawer != null
            ? IconButton(
                icon: const Icon(Icons.menu_rounded, color: AppColors.textPrimary),
                onPressed: widget.onOpenDrawer,
              )
            : null,
        title: const Text(
          "Customers Directory",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.textPrimary),
        ),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance.collection('customers').snapshots(),
        builder: (context, custSnap) {
          return StreamBuilder<QuerySnapshot>(
            stream: FirebaseFirestore.instance.collection('packages').snapshots(),
            builder: (context, pkgSnap) {
              final allCustomers = custSnap.hasData
                  ? custSnap.data!.docs.map((d) => Customer.fromFirestore(d)).toList()
                  : <Customer>[];

              final packages = pkgSnap.hasData
                  ? pkgSnap.data!.docs.map((d) => CablePackage.fromFirestore(d)).toList()
                  : <CablePackage>[];

              final filtered = allCustomers.where((c) {
                final q = _searchQuery.toLowerCase();
                final matchesSearch = c.name.toLowerCase().contains(q) ||
                    c.customerId.toLowerCase().contains(q) ||
                    c.mobile.contains(q) ||
                    (c.stbId != null && c.stbId!.toLowerCase().contains(q)) ||
                    c.area.toLowerCase().contains(q);

                final matchesDue = !_onlyWithDue || c.balanceAmount > 0;
                return matchesSearch && matchesDue;
              }).toList();

              return Column(
                children: [
                  // Search & Filter Header
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      border: Border(bottom: BorderSide(color: AppColors.border)),
                    ),
                    child: Column(
                      children: [
                        TextField(
                          style: const TextStyle(color: AppColors.textPrimary),
                          decoration: InputDecoration(
                            hintText: "Search Name, STB ID, Mobile, Area...",
                            hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                            prefixIcon: const Icon(Icons.search, color: AppColors.textMuted, size: 20),
                            suffixIcon: _searchQuery.isNotEmpty
                                ? IconButton(
                                    icon: const Icon(Icons.clear, color: AppColors.textMuted, size: 18),
                                    onPressed: () => setState(() => _searchQuery = ""),
                                  )
                                : null,
                            filled: true,
                            fillColor: AppColors.inputBg,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: AppColors.border),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: AppColors.border),
                            ),
                          ),
                          onChanged: (val) => setState(() => _searchQuery = val),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            FilterChip(
                              label: const Text("Only With Due"),
                              selected: _onlyWithDue,
                              selectedColor: AppColors.primary,
                              backgroundColor: AppColors.surfaceSecondary,
                              labelStyle: TextStyle(
                                color: _onlyWithDue ? Colors.white : AppColors.textSecondary,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                              onSelected: (val) => setState(() => _onlyWithDue = val),
                            ),
                            const Spacer(),
                            Text(
                              "${filtered.length} Customers",
                              style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Customer List
                  Expanded(
                    child: filtered.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.person_search_outlined, size: 48, color: AppColors.textMuted),
                                const SizedBox(height: 12),
                                const Text(
                                  "No customers found",
                                  style: TextStyle(color: AppColors.textMuted),
                                ),
                              ],
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: filtered.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 12),
                            itemBuilder: (context, index) {
                              final cust = filtered[index];
                              return _buildCustomerCard(
                                context,
                                cust: cust,
                                allCustomers: allCustomers,
                                packages: packages,
                              );
                            },
                          ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildCustomerCard(
    BuildContext context, {
    required Customer cust,
    required List<Customer> allCustomers,
    required List<CablePackage> packages,
  }) {
    final currency = NumberFormat('#,##,###');
    final expStr = cust.expiryDate != null ? DateFormat('dd MMM yyyy').format(cust.expiryDate!) : 'No date';
    final isExpired = cust.expiryDate != null && cust.expiryDate!.isBefore(DateTime.now());

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.cardShadow,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _showCustomerActionSheet(
            context,
            cust: cust,
            allCustomers: allCustomers,
            packages: packages,
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Row: Avatar, Name & ID, Due Badge
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: cust.balanceAmount > 0 ? const Color(0xFFFEF2F2) : const Color(0xFFF0FDF4),
                      child: Text(
                        cust.name.isNotEmpty ? cust.name[0].toUpperCase() : 'C',
                        style: TextStyle(
                          color: cust.balanceAmount > 0 ? AppColors.danger : const Color(0xFF16A34A),
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            cust.name,
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              Text(
                                "ID: ${cust.displayId}",
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              if (cust.area.isNotEmpty) ...[
                                const Text(" • ", style: TextStyle(color: AppColors.textMuted)),
                                const Icon(Icons.location_on_outlined, size: 12, color: AppColors.textMuted),
                                const SizedBox(width: 2),
                                Flexible(
                                  child: Text(
                                    cust.area,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            cust.mobile,
                            style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          "₹${currency.format(cust.balanceAmount.toInt())}",
                          style: TextStyle(
                            color: cust.balanceAmount > 0 ? AppColors.danger : AppColors.success,
                            fontWeight: FontWeight.w900,
                            fontSize: 17,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: cust.balanceAmount > 0 ? const Color(0xFFFEF2F2) : const Color(0xFFF0FDF4),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: cust.balanceAmount > 0 ? const Color(0xFFFECACA) : const Color(0xFFBBF7D0),
                            ),
                          ),
                          child: Text(
                            cust.balanceAmount > 0 ? "Due Balance" : "No Due",
                            style: TextStyle(
                              color: cust.balanceAmount > 0 ? AppColors.danger : AppColors.success,
                              fontSize: 9.5,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Bottom Status & Quick Contact Bar
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceSecondary,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        isExpired ? Icons.cancel_outlined : Icons.check_circle_outline,
                        size: 14,
                        color: isExpired ? AppColors.danger : AppColors.success,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        "Expiry: $expStr",
                        style: TextStyle(
                          fontSize: 11,
                          color: isExpired ? AppColors.danger : AppColors.textSecondary,
                          fontWeight: isExpired ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: isExpired ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          isExpired ? "EXPIRED" : "ACTIVE",
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            color: isExpired ? AppColors.danger : const Color(0xFF16A34A),
                          ),
                        ),
                      ),
                      const Spacer(),

                      // 1-Tap Quick Call
                      InkWell(
                        onTap: () => WhatsAppService.makeCall(cust.mobile),
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            border: Border.all(color: AppColors.border),
                          ),
                          child: const Icon(Icons.call_outlined, size: 14, color: AppColors.textPrimary),
                        ),
                      ),
                      const SizedBox(width: 6),

                      // 1-Tap WhatsApp
                      InkWell(
                        onTap: () {
                          final msg = WhatsAppService.getReminderMessage(
                            customerName: cust.name,
                            customerId: cust.displayId,
                            customerDocId: cust.id,
                            expiryDate: cust.expiryDate,
                            balanceAmount: cust.balanceAmount,
                          );
                          WhatsAppService.sendWhatsApp(mobile: cust.mobile, message: msg);
                        },
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDF4),
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(0xFFBBF7D0)),
                          ),
                          child: const Icon(Icons.chat_bubble_rounded, size: 14, color: Color(0xFF16A34A)),
                        ),
                      ),
                      const SizedBox(width: 8),

                      // Actions chevron
                      const Icon(Icons.chevron_right_rounded, size: 18, color: AppColors.textMuted),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showCustomerActionSheet(
    BuildContext context, {
    required Customer cust,
    required List<Customer> allCustomers,
    required List<CablePackage> packages,
  }) {
    final currency = NumberFormat('#,##,###');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top Drag Handle
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: const Color(0xFFE2E8F0),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Customer Profile Banner
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceSecondary,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 24,
                          backgroundColor: cust.balanceAmount > 0 ? const Color(0xFFFEF2F2) : const Color(0xFFF0FDF4),
                          child: Text(
                            cust.name.isNotEmpty ? cust.name[0].toUpperCase() : 'C',
                            style: TextStyle(
                              color: cust.balanceAmount > 0 ? AppColors.danger : const Color(0xFF16A34A),
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                cust.name,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.textPrimary),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                "ID: ${cust.displayId} • ${cust.mobile}",
                                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                              ),
                              if (cust.area.isNotEmpty)
                                Text(
                                  "📍 ${cust.area}",
                                  style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                                ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              "₹${currency.format(cust.balanceAmount.toInt())}",
                              style: TextStyle(
                                color: cust.balanceAmount > 0 ? AppColors.danger : AppColors.success,
                                fontWeight: FontWeight.w900,
                                fontSize: 18,
                              ),
                            ),
                            Text(
                              cust.balanceAmount > 0 ? "Due Balance" : "No Due",
                              style: TextStyle(
                                color: cust.balanceAmount > 0 ? AppColors.danger : AppColors.success,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Action Buttons List
                  _buildActionSheetTile(
                    title: "Recharge Package",
                    subtitle: "Renew subscription & extend expiry date",
                    icon: Icons.credit_card_rounded,
                    iconColor: const Color(0xFF16A34A),
                    bgColor: const Color(0xFFF0FDF4),
                    borderColor: const Color(0xFFBBF7D0),
                    onTap: () {
                      Navigator.pop(ctx);
                      ActionModals.showRechargeModal(
                        context,
                        allCustomers: allCustomers,
                        packages: packages,
                        operatorName: widget.operatorName,
                        operatorUid: widget.operatorUid,
                        preSelectedCustomer: cust,
                      );
                    },
                  ),
                  const SizedBox(height: 10),

                  _buildActionSheetTile(
                    title: "Collect Due Payment",
                    subtitle: "Record cash / PhonePe payment & generate receipt",
                    icon: Icons.currency_rupee_rounded,
                    iconColor: AppColors.primary,
                    bgColor: AppColors.primaryBg,
                    borderColor: AppColors.primaryBorder,
                    onTap: () {
                      Navigator.pop(ctx);
                      ActionModals.showCollectModal(
                        context,
                        allCustomers: allCustomers,
                        operatorName: widget.operatorName,
                        operatorUid: widget.operatorUid,
                        preSelectedCustomer: cust,
                      );
                    },
                  ),
                  const SizedBox(height: 10),

                  _buildActionSheetTile(
                    title: "Customer Ledger / Passbook",
                    subtitle: "View full recharge & payment transaction history",
                    icon: Icons.menu_book_rounded,
                    iconColor: const Color(0xFF2563EB),
                    bgColor: const Color(0xFFEFF6FF),
                    borderColor: const Color(0xFFBFDBFE),
                    onTap: () {
                      Navigator.pop(ctx);
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => CustomerLedgerScreen(
                            initialCustomer: cust,
                            operatorName: widget.operatorName,
                            operatorUid: widget.operatorUid,
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 10),

                  _buildActionSheetTile(
                    title: "Edit Customer Details",
                    subtitle: "Change STB ID, VC Number, Area/Line, Mobile, Expiry",
                    icon: Icons.edit_note_rounded,
                    iconColor: const Color(0xFF7C3AED),
                    bgColor: const Color(0xFFF5F3FF),
                    borderColor: const Color(0xFFDDD6FE),
                    onTap: () {
                      Navigator.pop(ctx);
                      ActionModals.showEditCustomerModal(context, customer: cust);
                    },
                  ),
                  const SizedBox(height: 10),

                  _buildActionSheetTile(
                    title: "+ Extra Due / Service Charge",
                    subtitle: "Add wire repair, remote, or technician charges",
                    icon: Icons.add_circle_outline_rounded,
                    iconColor: const Color(0xFFD97706),
                    bgColor: const Color(0xFFFEFCE8),
                    borderColor: const Color(0xFFFEF08A),
                    onTap: () {
                      Navigator.pop(ctx);
                      ActionModals.showExtraDueModal(
                        context,
                        allCustomers: allCustomers,
                        operatorName: widget.operatorName,
                        operatorUid: widget.operatorUid,
                        preSelectedCustomer: cust,
                      );
                    },
                  ),
                  const SizedBox(height: 10),

                  _buildActionSheetTile(
                    title: "Register Complaint",
                    subtitle: "Log cable cut, no signal, or box glitch issue",
                    icon: Icons.support_agent_rounded,
                    iconColor: const Color(0xFFDC2626),
                    bgColor: const Color(0xFFFEF2F2),
                    borderColor: const Color(0xFFFECACA),
                    onTap: () {
                      Navigator.pop(ctx);
                      ActionModals.showComplaintModal(
                        context,
                        allCustomers: allCustomers,
                        operatorName: widget.operatorName,
                        operatorUid: widget.operatorUid,
                        preSelectedCustomer: cust,
                      );
                    },
                  ),
                  const SizedBox(height: 14),

                  // Call & WhatsApp row at bottom of sheet
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            Navigator.pop(ctx);
                            WhatsAppService.makeCall(cust.mobile);
                          },
                          icon: const Icon(Icons.call_rounded, size: 16),
                          label: const Text("Call Customer", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF334155),
                            side: const BorderSide(color: Color(0xFFCBD5E1)),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            Navigator.pop(ctx);
                            final msg = WhatsAppService.getReminderMessage(
                              customerName: cust.name,
                              customerId: cust.displayId,
                              customerDocId: cust.id,
                              expiryDate: cust.expiryDate,
                              balanceAmount: cust.balanceAmount,
                            );
                            WhatsAppService.sendWhatsApp(mobile: cust.mobile, message: msg);
                          },
                          icon: const Icon(Icons.chat_bubble_rounded, size: 16),
                          label: const Text("WhatsApp", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF16A34A),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
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
    );
  }

  Widget _buildActionSheetTile({
    required String title,
    required String subtitle,
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
    required Color borderColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderColor),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: borderColor),
              ),
              child: Icon(icon, color: iconColor, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      color: iconColor,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios_rounded, color: iconColor.withValues(alpha: 0.6), size: 14),
          ],
        ),
      ),
    );
  }
}
