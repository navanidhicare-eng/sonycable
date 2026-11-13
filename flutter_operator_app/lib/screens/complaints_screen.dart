import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/customer.dart';
import '../models/models.dart';
import '../services/whatsapp_service.dart';
import '../theme/app_theme.dart';
import '../widgets/action_modals.dart';

class ComplaintsScreen extends StatefulWidget {
  final String operatorName;
  final String operatorUid;
  final VoidCallback? onOpenDrawer;

  const ComplaintsScreen({
    super.key,
    required this.operatorName,
    required this.operatorUid,
    this.onOpenDrawer,
  });

  @override
  State<ComplaintsScreen> createState() => _ComplaintsScreenState();
}

class _ComplaintsScreenState extends State<ComplaintsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
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
          "Customer Complaints",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.textPrimary),
        ),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textMuted,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          tabs: const [
            Tab(text: "Pending Issues"),
            Tab(text: "Resolved"),
          ],
        ),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('complaints')
            .orderBy('createdAt', descending: true)
            .snapshots(),
        builder: (context, snapshot) {
          final allComplaints = snapshot.hasData
              ? snapshot.data!.docs.map((d) => ComplaintModel.fromFirestore(d)).toList()
              : <ComplaintModel>[];

          final pending = allComplaints.where((c) => c.status.toLowerCase() == 'pending').toList();
          final resolved = allComplaints.where((c) => c.status.toLowerCase() == 'resolved').toList();

          return TabBarView(
            controller: _tabController,
            children: [
              _buildComplaintList(pending, isPending: true),
              _buildComplaintList(resolved, isPending: false),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text("New Complaint", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: () async {
          final custSnap = await FirebaseFirestore.instance.collection('customers').get();
          final allCustomers = custSnap.docs.map((d) => Customer.fromFirestore(d)).toList();

          if (context.mounted) {
            ActionModals.showComplaintModal(
              context,
              allCustomers: allCustomers,
              operatorName: widget.operatorName,
              operatorUid: widget.operatorUid,
            );
          }
        },
      ),
    );
  }

  Widget _buildComplaintList(List<ComplaintModel> list, {required bool isPending}) {
    if (list.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isPending ? Icons.thumb_up_alt_outlined : Icons.inbox_outlined,
              size: 48,
              color: AppColors.textMuted,
            ),
            const SizedBox(height: 12),
            Text(
              isPending ? "No pending complaints! Great job! 🎉" : "No resolved complaints yet",
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
        final comp = list[index];
        final dateStr = DateFormat('dd MMM yyyy, hh:mm a').format(comp.createdAt);

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isPending ? AppColors.warningBorder : AppColors.successBorder,
            ),
            boxShadow: AppColors.cardShadow,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      comp.customerName,
                      style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: isPending ? AppColors.warningBg : AppColors.successBg,
                      border: Border.all(color: isPending ? AppColors.warningBorder : AppColors.successBorder),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      comp.status.toUpperCase(),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: isPending ? AppColors.warning : AppColors.success,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                "ID: ${comp.customerId} • ${comp.customerMobile}",
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
              ),
              if (comp.customerAddress != null && comp.customerAddress!.isNotEmpty) ...[
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(Icons.location_on_outlined, size: 12, color: AppColors.textMuted),
                    const SizedBox(width: 4),
                    Text(comp.customerAddress!, style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
                  ],
                ),
              ],
              const SizedBox(height: 10),

              // Complaint description box
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.surfaceSecondary,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  comp.complaintText,
                  style: const TextStyle(color: AppColors.textPrimary, fontSize: 13, height: 1.3),
                ),
              ),
              const SizedBox(height: 10),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    dateStr,
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 10),
                  ),
                  Row(
                    children: [
                      // Call button
                      if (comp.customerMobile.isNotEmpty)
                        IconButton(
                          icon: const Icon(Icons.call, color: AppColors.textSecondary, size: 18),
                          onPressed: () => WhatsAppService.makeCall(comp.customerMobile),
                        ),

                      // WhatsApp message button
                      if (comp.customerMobile.isNotEmpty)
                        IconButton(
                          icon: const Icon(Icons.chat_bubble_outline, color: Color(0xFF25D366), size: 18),
                          onPressed: () {
                            final msg = '''*Sony Cable Network - కంప్లైంట్ అప్‌డేట్* ⚠️
నమస్కారం ${comp.customerName} గారు,
మీ సమస్య (${comp.complaintText}) పరిశీలనలో ఉంది.
త్వరలోనే మా టెక్నీషియన్ మీ వద్దకు వచ్చి సమస్యను పరిష్కరిస్తారు.''';
                            WhatsAppService.sendWhatsApp(mobile: comp.customerMobile, message: msg);
                          },
                        ),

                      // Resolve button
                      if (isPending)
                        ElevatedButton.icon(
                          icon: const Icon(Icons.check, size: 14),
                          label: const Text("Solve", style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF10B981),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          onPressed: () async {
                            await FirebaseFirestore.instance
                                .collection('complaints')
                                .doc(comp.id)
                                .update({'status': 'Resolved'});

                            if (comp.customerMobile.isNotEmpty) {
                              final resolvedMsg = '''*Sony Cable Network - కంప్లైంట్ పరిష్కరించబడింది* ✅
నమస్కారం ${comp.customerName} గారు,
మీరు నమోదు చేసిన సమస్య (${comp.complaintText}) విజయవంతంగా పరిష్కరించబడింది.

ధన్యవాదాలు! - Sony Cable Network''';
                              WhatsAppService.sendWhatsApp(mobile: comp.customerMobile, message: resolvedMsg);
                            }
                          },
                        ),
                    ],
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
