import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/customer.dart';
import '../models/models.dart';
import '../services/whatsapp_service.dart';
import '../theme/app_theme.dart';
import '../widgets/action_modals.dart';
import 'edit_customer_screen.dart';

class RemindersScreen extends StatefulWidget {
  final String operatorName;
  final String operatorUid;
  final VoidCallback? onOpenDrawer;

  const RemindersScreen({
    super.key,
    required this.operatorName,
    required this.operatorUid,
    this.onOpenDrawer,
  });

  @override
  State<RemindersScreen> createState() => _RemindersScreenState();
}

class _RemindersScreenState extends State<RemindersScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

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
          "Recharge Reminders",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.textPrimary),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textMuted,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
          tabs: const [
            Tab(text: "Expired"),
            Tab(text: "Today / 1D"),
            Tab(text: "In 3 Days"),
            Tab(text: "In 7 Days"),
          ],
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

              final now = DateTime.now();

              // Categorize
              final expiredList = allCustomers.where((c) {
                if (c.expiryDate == null) return false;
                return c.expiryDate!.isBefore(now);
              }).toList();

              final in1DayList = allCustomers.where((c) {
                if (c.expiryDate == null) return false;
                final diff = c.expiryDate!.difference(now).inDays;
                return diff >= 0 && diff <= 1;
              }).toList();

              final in3DaysList = allCustomers.where((c) {
                if (c.expiryDate == null) return false;
                final diff = c.expiryDate!.difference(now).inDays;
                return diff > 1 && diff <= 3;
              }).toList();

              final in7DaysList = allCustomers.where((c) {
                if (c.expiryDate == null) return false;
                final diff = c.expiryDate!.difference(now).inDays;
                return diff > 3 && diff <= 7;
              }).toList();

              return TabBarView(
                controller: _tabController,
                children: [
                  _buildCustomerReminderList(expiredList, allCustomers, packages, "Expired"),
                  _buildCustomerReminderList(in1DayList, allCustomers, packages, "Expires Today / Tomorrow"),
                  _buildCustomerReminderList(in3DaysList, allCustomers, packages, "Expires in 3 Days"),
                  _buildCustomerReminderList(in7DaysList, allCustomers, packages, "Expires in 7 Days"),
                ],
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildCustomerReminderList(
    List<Customer> list,
    List<Customer> allCustomers,
    List<CablePackage> packages,
    String categoryName,
  ) {
    if (list.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle_outline, size: 48, color: AppColors.success),
            const SizedBox(height: 12),
            Text(
              "No customers in '$categoryName'",
              style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: list.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final cust = list[index];
        final expStr = cust.expiryDate != null ? DateFormat('dd MMM yyyy').format(cust.expiryDate!) : 'No date';
        final isExpired = cust.expiryDate != null && cust.expiryDate!.isBefore(DateTime.now());

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
            boxShadow: AppColors.cardShadow,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              InkWell(
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => EditCustomerScreen(customer: cust)),
                ),
                borderRadius: BorderRadius.circular(10),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            cust.name,
                            style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            "ID: ${cust.displayId} • ${cust.mobile}",
                            style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                          ),
                          if (cust.area.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(cust.area, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                          ],
                        ],
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: isExpired ? AppColors.dangerBg : AppColors.primaryBg,
                            border: Border.all(color: isExpired ? AppColors.dangerBorder : AppColors.primaryBorder),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            expStr,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: isExpired ? AppColors.danger : AppColors.primary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Icon(Icons.arrow_forward_ios_rounded, size: 12, color: AppColors.textMuted),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  // Call Button
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.call, size: 14),
                      label: const Text("Call", style: TextStyle(fontSize: 12)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textSecondary,
                        side: const BorderSide(color: AppColors.border),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () => WhatsAppService.makeCall(cust.mobile),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // WhatsApp Reminder Button
                  Expanded(
                    flex: 2,
                    child: ElevatedButton.icon(
                      icon: const Icon(Icons.chat_bubble_outline, size: 15),
                      label: const Text("WhatsApp", style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF25D366),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
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
                  ),
                  const SizedBox(width: 8),

                  // Edit Button
                  InkWell(
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => EditCustomerScreen(customer: cust)),
                    ),
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primaryBg,
                        border: Border.all(color: AppColors.primaryBorder),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.edit_rounded, color: AppColors.primary, size: 18),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Quick Recharge
                  InkWell(
                    onTap: () {
                      ActionModals.showRechargeModal(
                        context,
                        allCustomers: allCustomers,
                        packages: packages,
                        operatorName: widget.operatorName,
                        operatorUid: widget.operatorUid,
                        preSelectedCustomer: cust,
                      );
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        border: Border.all(color: const Color(0xFFBBF7D0)),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.credit_card_rounded, color: Color(0xFF16A34A), size: 18),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
