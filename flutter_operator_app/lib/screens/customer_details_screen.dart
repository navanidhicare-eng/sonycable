import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/customer.dart';
import '../models/models.dart';
import '../services/whatsapp_service.dart';
import '../theme/app_theme.dart';
import '../widgets/action_modals.dart';
import 'customer_ledger_screen.dart';

class CustomerDetailsScreen extends StatefulWidget {
  final Customer customer;
  final String operatorName;
  final String operatorUid;
  final List<Customer> allCustomers;
  final List<CablePackage> packages;

  const CustomerDetailsScreen({
    super.key,
    required this.customer,
    required this.operatorName,
    required this.operatorUid,
    required this.allCustomers,
    required this.packages,
  });

  @override
  State<CustomerDetailsScreen> createState() => _CustomerDetailsScreenState();
}

class _CustomerDetailsScreenState extends State<CustomerDetailsScreen> {
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DocumentSnapshot>(
      stream: FirebaseFirestore.instance
          .collection('customers')
          .doc(widget.customer.id)
          .snapshots(),
      builder: (context, snapshot) {
        final cust = snapshot.hasData && snapshot.data!.exists
            ? Customer.fromFirestore(snapshot.data!)
            : widget.customer;

        final currency = NumberFormat('#,##,###');
        final expStr = cust.expiryDate != null
            ? DateFormat('dd MMM yyyy').format(cust.expiryDate!)
            : 'No date';
        final isExpired = cust.expiryDate != null && cust.expiryDate!.isBefore(DateTime.now());

        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            backgroundColor: Colors.white,
            elevation: 0,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
              onPressed: () => Navigator.pop(context),
            ),
            title: const Text(
              "Customer Profile",
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.textPrimary),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.call_outlined, color: AppColors.textPrimary),
                tooltip: "Call Customer",
                onPressed: () => WhatsAppService.makeCall(cust.mobile),
              ),
              IconButton(
                icon: const Icon(Icons.chat_bubble_outline_rounded, color: Color(0xFF16A34A)),
                tooltip: "WhatsApp",
                onPressed: () {
                  final msg = WhatsAppService.getReminderMessage(
                    customerName: cust.name,
                    customerId: cust.displayId,
                    customerDocId: cust.id,
                    expiryDate: cust.expiryDate,
                    balanceAmount: cust.balanceAmount,
                  );
                  WhatsAppService.sendWhatsApp(mobile: cust.mobile, message: msg);
                },
              ),
              IconButton(
                icon: const Icon(Icons.edit_outlined, color: AppColors.primary),
                tooltip: "Edit Info",
                onPressed: () => ActionModals.showEditCustomerModal(context, customer: cust),
              ),
            ],
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Customer Hero Identity Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.border),
                    boxShadow: AppColors.cardShadow,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          CircleAvatar(
                            radius: 28,
                            backgroundColor: cust.balanceAmount > 0 ? const Color(0xFFFEF2F2) : const Color(0xFFF0FDF4),
                            child: Text(
                              cust.name.isNotEmpty ? cust.name[0].toUpperCase() : 'C',
                              style: TextStyle(
                                color: cust.balanceAmount > 0 ? AppColors.danger : const Color(0xFF16A34A),
                                fontWeight: FontWeight.bold,
                                fontSize: 24,
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  cust.name,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 18,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: AppColors.surfaceSecondary,
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(color: AppColors.border),
                                      ),
                                      child: Text(
                                        "ID: ${cust.displayId}",
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: isExpired ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        isExpired ? "EXPIRED" : "ACTIVE",
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w900,
                                          color: isExpired ? AppColors.danger : const Color(0xFF16A34A),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    const Icon(Icons.phone_outlined, size: 14, color: AppColors.textSecondary),
                                    const SizedBox(width: 4),
                                    Text(
                                      cust.mobile,
                                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.w600),
                                    ),
                                  ],
                                ),
                                if (cust.area.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textMuted),
                                      const SizedBox(width: 4),
                                      Text(
                                        cust.area,
                                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // 2. Financial Overview: Due Balance & Expiry
                Row(
                  children: [
                    // Due Balance Card
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: cust.balanceAmount > 0 ? const Color(0xFFFFF1F2) : const Color(0xFFF0FDF4),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: cust.balanceAmount > 0 ? const Color(0xFFFECDD3) : const Color(0xFFBBF7D0),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  cust.balanceAmount > 0 ? "Due Balance" : "Account Status",
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: cust.balanceAmount > 0 ? const Color(0xFF9F1239) : const Color(0xFF166534),
                                  ),
                                ),
                                Icon(
                                  Icons.currency_rupee_rounded,
                                  size: 16,
                                  color: cust.balanceAmount > 0 ? const Color(0xFF9F1239) : const Color(0xFF166534),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              "₹${currency.format(cust.balanceAmount.toInt())}",
                              style: TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                                color: cust.balanceAmount > 0 ? AppColors.danger : const Color(0xFF166534),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              cust.balanceAmount > 0 ? "Pending Payment" : "All Clear",
                              style: TextStyle(
                                fontSize: 11,
                                color: cust.balanceAmount > 0 ? const Color(0xFFBE123C) : const Color(0xFF15803D),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Expiry Date Card
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isExpired ? const Color(0xFFFEF2F2) : const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isExpired ? const Color(0xFFFECACA) : const Color(0xFFBFDBFE),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  "Expiry Date",
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: isExpired ? AppColors.danger : const Color(0xFF1E40AF),
                                  ),
                                ),
                                Icon(
                                  Icons.calendar_today_rounded,
                                  size: 15,
                                  color: isExpired ? AppColors.danger : const Color(0xFF1E40AF),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              expStr,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w900,
                                color: isExpired ? AppColors.danger : const Color(0xFF1E40AF),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              isExpired ? "Package Expired" : "Valid Subscription",
                              style: TextStyle(
                                fontSize: 11,
                                color: isExpired ? AppColors.danger : const Color(0xFF3B82F6),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // 3. Box & Technical Info Card
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
                          Icon(Icons.tv_rounded, color: AppColors.primary, size: 20),
                          SizedBox(width: 8),
                          Text(
                            "Box & Connection Details",
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      _buildInfoRow("STB ID (Set Top Box):", cust.stbId?.isNotEmpty == true ? cust.stbId! : "Not Assigned"),
                      const Divider(height: 18),
                      _buildInfoRow("STB VC Number (Smart Card):", cust.gtplId?.isNotEmpty == true ? cust.gtplId! : "Not Assigned"),
                      const Divider(height: 18),
                      _buildInfoRow("Assigned Area / Line:", cust.area.isNotEmpty ? cust.area : "Not Set"),
                      if (cust.lastRechargeDate != null) ...[
                        const Divider(height: 18),
                        _buildInfoRow(
                          "Last Recharged:",
                          DateFormat('dd MMM yyyy, hh:mm a').format(cust.lastRechargeDate!),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // 4. Quick Action Hub (Full Buttons)
                const Text(
                  "ACTIONS & SERVICES",
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.1,
                    color: AppColors.textMuted,
                  ),
                ),
                const SizedBox(height: 10),

                _buildActionButton(
                  title: "Recharge Package",
                  subtitle: "Renew subscription & extend expiry date",
                  icon: Icons.credit_card_rounded,
                  iconColor: const Color(0xFF16A34A),
                  bgColor: const Color(0xFFF0FDF4),
                  borderColor: const Color(0xFFBBF7D0),
                  onTap: () {
                    ActionModals.showRechargeModal(
                      context,
                      allCustomers: widget.allCustomers,
                      packages: widget.packages,
                      operatorName: widget.operatorName,
                      operatorUid: widget.operatorUid,
                      preSelectedCustomer: cust,
                    );
                  },
                ),
                const SizedBox(height: 10),

                _buildActionButton(
                  title: "Collect Due Payment",
                  subtitle: "Record cash / PhonePe payment & generate receipt",
                  icon: Icons.currency_rupee_rounded,
                  iconColor: AppColors.primary,
                  bgColor: AppColors.primaryBg,
                  borderColor: AppColors.primaryBorder,
                  onTap: () {
                    ActionModals.showCollectModal(
                      context,
                      allCustomers: widget.allCustomers,
                      operatorName: widget.operatorName,
                      operatorUid: widget.operatorUid,
                      preSelectedCustomer: cust,
                    );
                  },
                ),
                const SizedBox(height: 10),

                _buildActionButton(
                  title: "Customer Ledger / Passbook",
                  subtitle: "View complete payment & recharge statement history",
                  icon: Icons.menu_book_rounded,
                  iconColor: const Color(0xFF2563EB),
                  bgColor: const Color(0xFFEFF6FF),
                  borderColor: const Color(0xFFBFDBFE),
                  onTap: () {
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

                _buildActionButton(
                  title: "+ Extra Due / Service Charge",
                  subtitle: "Add wire repair, remote, or technician charges",
                  icon: Icons.add_circle_outline_rounded,
                  iconColor: const Color(0xFFD97706),
                  bgColor: const Color(0xFFFEFCE8),
                  borderColor: const Color(0xFFFEF08A),
                  onTap: () {
                    ActionModals.showExtraDueModal(
                      context,
                      allCustomers: widget.allCustomers,
                      operatorName: widget.operatorName,
                      operatorUid: widget.operatorUid,
                      preSelectedCustomer: cust,
                    );
                  },
                ),
                const SizedBox(height: 10),

                _buildActionButton(
                  title: "Edit Customer Details",
                  subtitle: "Change STB ID, VC Number, Area/Line, Mobile, Expiry",
                  icon: Icons.edit_note_rounded,
                  iconColor: const Color(0xFF7C3AED),
                  bgColor: const Color(0xFFF5F3FF),
                  borderColor: const Color(0xFFDDD6FE),
                  onTap: () {
                    ActionModals.showEditCustomerModal(context, customer: cust);
                  },
                ),
                const SizedBox(height: 10),

                _buildActionButton(
                  title: "Register Complaint",
                  subtitle: "Log cable cut, no signal, or box glitch issue",
                  icon: Icons.support_agent_rounded,
                  iconColor: const Color(0xFFDC2626),
                  bgColor: const Color(0xFFFEF2F2),
                  borderColor: const Color(0xFFFECACA),
                  onTap: () {
                    ActionModals.showComplaintModal(
                      context,
                      allCustomers: widget.allCustomers,
                      operatorName: widget.operatorName,
                      operatorUid: widget.operatorUid,
                      preSelectedCustomer: cust,
                    );
                  },
                ),
              ],
            ),
          ),
          bottomSheet: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  offset: const Offset(0, -3),
                  blurRadius: 10,
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => WhatsAppService.makeCall(cust.mobile),
                    icon: const Icon(Icons.call_rounded, size: 18),
                    label: const Text("Call Customer", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF334155),
                      side: const BorderSide(color: Color(0xFFCBD5E1)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () {
                      final msg = WhatsAppService.getReminderMessage(
                        customerName: cust.name,
                        customerId: cust.displayId,
                        customerDocId: cust.id,
                        expiryDate: cust.expiryDate,
                        balanceAmount: cust.balanceAmount,
                      );
                      WhatsAppService.sendWhatsApp(mobile: cust.mobile, message: msg);
                    },
                    icon: const Icon(Icons.chat_bubble_rounded, size: 18),
                    label: const Text("WhatsApp", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
        const SizedBox(width: 10),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildActionButton({
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
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: borderColor),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: borderColor),
              ),
              child: Icon(icon, color: iconColor, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                      color: iconColor,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 11.5,
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
