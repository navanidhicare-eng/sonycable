import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/models.dart';
import '../theme/app_theme.dart';

class MyCollectionsScreen extends StatelessWidget {
  final String operatorName;
  final String operatorUid;
  final VoidCallback? onOpenDrawer;

  const MyCollectionsScreen({
    super.key,
    required this.operatorName,
    required this.operatorUid,
    this.onOpenDrawer,
  });

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat('#,##,###');

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: onOpenDrawer != null
            ? IconButton(
                icon: const Icon(Icons.menu_rounded, color: AppColors.textPrimary),
                onPressed: onOpenDrawer,
              )
            : null,
        title: const Text(
          "My Collections History",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.textPrimary),
        ),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('payments')
            .where('collectedBy', isEqualTo: operatorUid)
            .snapshots(),
        builder: (context, snapshot) {
          final allPayments = snapshot.hasData
              ? snapshot.data!.docs.map((d) => PaymentModel.fromFirestore(d)).toList()
              : <PaymentModel>[];

          allPayments.sort((a, b) => b.collectionDate.compareTo(a.collectionDate));

          final now = DateTime.now();
          final todayStart = DateTime(now.year, now.month, now.day);
          final todaysList = allPayments.where((p) => p.collectionDate.isAfter(todayStart)).toList();
          final todaysTotal = todaysList.fold<double>(0.0, (sum, p) => sum + p.amount);
          final totalAllTime = allPayments.fold<double>(0.0, (sum, p) => sum + p.amount);

          return Column(
            children: [
              // Summary Cards
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(bottom: BorderSide(color: AppColors.border)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.primaryBg,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.primaryBorder),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text("Today's Total", style: TextStyle(color: AppColors.primaryDark, fontSize: 11, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text(
                              "₹${currency.format(todaysTotal.toInt())}",
                              style: const TextStyle(color: AppColors.primaryDark, fontSize: 20, fontWeight: FontWeight.w900),
                            ),
                            Text("${todaysList.length} transactions", style: TextStyle(color: AppColors.primaryDark.withOpacity(0.7), fontSize: 10)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.successBg,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.successBorder),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text("Total All Time", style: TextStyle(color: AppColors.success, fontSize: 11, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text(
                              "₹${currency.format(totalAllTime.toInt())}",
                              style: const TextStyle(color: AppColors.success, fontSize: 20, fontWeight: FontWeight.w900),
                            ),
                            Text("${allPayments.length} transactions", style: TextStyle(color: AppColors.success.withOpacity(0.7), fontSize: 10)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Payments List
              Expanded(
                child: allPayments.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.receipt_long_outlined, size: 48, color: AppColors.textMuted),
                            const SizedBox(height: 12),
                            const Text("No collections recorded yet", style: TextStyle(color: AppColors.textMuted)),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: allPayments.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final payment = allPayments[index];
                          final timeStr = DateFormat('dd MMM yyyy, hh:mm a').format(payment.collectionDate);

                          return Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: AppColors.border),
                              boxShadow: AppColors.cardShadow,
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: const BoxDecoration(
                                    color: AppColors.primaryBg,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(Icons.currency_rupee, color: AppColors.primary, size: 18),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        payment.customerName,
                                        style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        "$timeStr • ${payment.method}",
                                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                                      ),
                                    ],
                                  ),
                                ),
                                Text(
                                  "₹${currency.format(payment.amount.toInt())}",
                                  style: const TextStyle(
                                    color: AppColors.success,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 16,
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}
