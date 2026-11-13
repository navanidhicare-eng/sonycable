import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/models.dart';
import '../models/customer.dart';
import '../theme/app_theme.dart';
import '../services/sound_service.dart';

class RechargeExpensesScreen extends StatefulWidget {
  final String operatorName;
  final String operatorUid;
  final VoidCallback? onOpenDrawer;

  const RechargeExpensesScreen({
    super.key,
    required this.operatorName,
    required this.operatorUid,
    this.onOpenDrawer,
  });

  @override
  State<RechargeExpensesScreen> createState() => _RechargeExpensesScreenState();
}

class _RechargeExpensesScreenState extends State<RechargeExpensesScreen> with SingleTickerProviderStateMixin {
  late DateTime _selectedMonth;
  late TabController _tabController;
  final TextEditingController _searchController = TextEditingController();
  String _selectedArea = "All";
  String _searchQuery = "";

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _selectedMonth = DateTime(now.year, now.month, 1);
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _previousMonth() {
    setState(() {
      _selectedMonth = DateTime(_selectedMonth.year, _selectedMonth.month - 1, 1);
    });
  }

  void _nextMonth() {
    setState(() {
      _selectedMonth = DateTime(_selectedMonth.year, _selectedMonth.month + 1, 1);
    });
  }

  void _currentMonth() {
    final now = DateTime.now();
    setState(() {
      _selectedMonth = DateTime(now.year, now.month, 1);
    });
  }

  // Manage Package MSO Rates Modal (Operator easily updates rates anytime)
  Future<void> _showManageMsoRatesModal(BuildContext context, List<CablePackage> packages) async {
    final Map<String, TextEditingController> controllers = {};
    for (final pkg in packages) {
      controllers[pkg.id] = TextEditingController(
        text: pkg.msoAmount > 0 ? pkg.msoAmount.toInt().toString() : pkg.effectiveMsoAmount.toInt().toString(),
      );
    }

    bool isSaving = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          return Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(ctx).size.height * 0.85,
            ),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 20,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.tune_rounded, color: Color(0xFFD97706), size: 22),
                        SizedBox(width: 8),
                        Text(
                          "Package MSO Wholesale Rates",
                          style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  "Configure the wholesale cost deducted by MSO for each package. Update anytime tariffs change.",
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
                const SizedBox(height: 16),

                // Package Rate List
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: packages.length,
                    separatorBuilder: (ctx, i) => const SizedBox(height: 12),
                    itemBuilder: (_, index) {
                      final pkg = packages[index];
                      final ctrl = controllers[pkg.id]!;

                      return Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceSecondary,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    pkg.name,
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    "Customer Price: ₹${pkg.price.toInt()}/month",
                                    style: const TextStyle(fontSize: 12, color: Color(0xFF059669), fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                const Text(
                                  "MSO Cost",
                                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFFB45309)),
                                ),
                                const SizedBox(height: 4),
                                SizedBox(
                                  width: 100,
                                  height: 38,
                                  child: TextField(
                                    controller: ctrl,
                                    keyboardType: TextInputType.number,
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFFB45309)),
                                    decoration: InputDecoration(
                                      prefixText: "₹",
                                      prefixStyle: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFB45309)),
                                      filled: true,
                                      fillColor: Colors.white,
                                      isDense: true,
                                      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(8),
                                        borderSide: const BorderSide(color: Color(0xFFF59E0B)),
                                      ),
                                      focusedBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(8),
                                        borderSide: const BorderSide(color: Color(0xFFD97706), width: 2),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 16),

                // Save Button
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFD97706),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    icon: isSaving
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Icon(Icons.check_circle_rounded, size: 20),
                    label: Text(
                      isSaving ? "Saving Rates..." : "Save MSO Rates",
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                    onPressed: isSaving
                        ? null
                        : () async {
                            setSheetState(() => isSaving = true);
                            try {
                              for (final pkg in packages) {
                                final text = controllers[pkg.id]?.text.trim() ?? "";
                                final double newMso = double.tryParse(text) ?? pkg.effectiveMsoAmount;
                                await FirebaseFirestore.instance.collection('packages').doc(pkg.id).set({
                                  'msoAmount': newMso,
                                }, SetOptions(merge: true));
                              }

                              if (context.mounted) {
                                Navigator.pop(ctx);
                                SoundService.playSuccessSound();
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text("MSO rates updated successfully!"),
                                    backgroundColor: Color(0xFF059669),
                                  ),
                                );
                              }
                            } catch (e) {
                              setSheetState(() => isSaving = false);
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text("Error: $e"), backgroundColor: Colors.red),
                                );
                              }
                            }
                          },
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  // Share Monthly Summary to WhatsApp
  void _shareMonthlyReport({
    required double totalMsoCost,
    required double totalBilled,
    required double totalCollected,
    required double netProfit,
    required int rechargeCount,
    required int paymentCount,
  }) {
    final monthName = DateFormat('MMMM yyyy').format(_selectedMonth);
    final currency = NumberFormat('#,##,###');

    final msg = "*Sony Cable Network - Monthly Statement*\n"
        "*Month*: $monthName\n"
        "----------------------------------\n"
        "• *Total Recharges*: $rechargeCount\n"
        "• *Customer Billed Total*: ₹${currency.format(totalBilled.toInt())}\n"
        "• *MSO Recharge Cost*: ₹${currency.format(totalMsoCost.toInt())}\n"
        "• *Expected Margin*: ₹${currency.format((totalBilled - totalMsoCost).toInt())}\n"
        "----------------------------------\n"
        "• *Collections Received*: ₹${currency.format(totalCollected.toInt())} ($paymentCount Payments)\n"
        "• *Net Cash in Hand (Profit)*: ₹${currency.format(netProfit.toInt())}\n"
        "----------------------------------\n"
        "*Operator*: ${widget.operatorName}\n"
        "*Helpline*: 9010737882";

    final encoded = Uri.encodeComponent(msg);
    final url = Uri.parse("https://wa.me/?text=$encoded");
    launchUrl(url, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat('#,##,###');
    final monthLabel = DateFormat('MMMM yyyy').format(_selectedMonth);
    final startOfMonth = DateTime(_selectedMonth.year, _selectedMonth.month, 1);
    final endOfMonth = DateTime(_selectedMonth.year, _selectedMonth.month + 1, 0, 23, 59, 59);

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
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Recharge Expenses & Profit",
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: AppColors.textPrimary),
            ),
            Text(
              "Monthly Recharge Outflow & Profit Analysis",
              style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance.collection('packages').snapshots(),
        builder: (context, pkgSnap) {
          final packages = pkgSnap.hasData
              ? pkgSnap.data!.docs.map((d) => CablePackage.fromFirestore(d)).toList()
              : <CablePackage>[];

          final packageMap = {for (final p in packages) p.id: p};

          return StreamBuilder<QuerySnapshot>(
            stream: FirebaseFirestore.instance
                .collection('recharges')
                .where('rechargeDate', isGreaterThanOrEqualTo: Timestamp.fromDate(startOfMonth))
                .where('rechargeDate', isLessThanOrEqualTo: Timestamp.fromDate(endOfMonth))
                .snapshots(),
            builder: (context, rechargeSnap) {
              return StreamBuilder<QuerySnapshot>(
                stream: FirebaseFirestore.instance
                    .collection('payments')
                    .where('collectionDate', isGreaterThanOrEqualTo: Timestamp.fromDate(startOfMonth))
                    .where('collectionDate', isLessThanOrEqualTo: Timestamp.fromDate(endOfMonth))
                    .snapshots(),
                builder: (context, paymentSnap) {
                  return StreamBuilder<QuerySnapshot>(
                    stream: FirebaseFirestore.instance.collection('customers').snapshots(),
                    builder: (context, custSnap) {
                      final allCustomers = custSnap.hasData
                          ? custSnap.data!.docs.map((d) => Customer.fromFirestore(d)).toList()
                          : <Customer>[];
                      final customerMap = {for (final c in allCustomers) c.id: c};

                      // Parse Recharges
                      final recharges = rechargeSnap.hasData
                          ? rechargeSnap.data!.docs
                              .map((d) => RechargeRecord.fromFirestore(d, packageMap: packageMap))
                              .toList()
                          : <RechargeRecord>[];

                      recharges.sort((a, b) => b.rechargeDate.compareTo(a.rechargeDate));

                      // Parse Payments
                      final payments = paymentSnap.hasData
                          ? paymentSnap.data!.docs.map((d) => PaymentModel.fromFirestore(d)).toList()
                          : <PaymentModel>[];

                      payments.sort((a, b) => b.collectionDate.compareTo(a.collectionDate));

                      // Financial Calculations for Selected Month
                      final totalBilled = recharges.fold<double>(0.0, (acc, r) => acc + r.amount);
                      final totalMsoCost = recharges.fold<double>(0.0, (acc, r) => acc + r.msoCost);
                      final expectedMargin = totalBilled - totalMsoCost;
                      final totalCollected = payments.fold<double>(0.0, (acc, p) => acc + p.amount);
                      final netCashInHand = totalCollected - totalMsoCost;

                      // Area list for filter
                      final areaSet = <String>{"All"};
                      for (final c in allCustomers) {
                        if (c.area.isNotEmpty) areaSet.add(c.area);
                      }
                      final areaList = areaSet.toList()..sort();

                      // Filtered recharges
                      final filteredRecharges = recharges.where((r) {
                        final cust = customerMap[r.customerId];
                        final area = cust?.area ?? "";
                        if (_selectedArea != "All" && area != _selectedArea) return false;

                        if (_searchQuery.isNotEmpty) {
                          final q = _searchQuery.toLowerCase();
                          final matchesName = r.customerName.toLowerCase().contains(q);
                          final matchesId = cust?.displayId.toLowerCase().contains(q) ?? false;
                          final matchesPkg = r.packageName.toLowerCase().contains(q);
                          if (!matchesName && !matchesId && !matchesPkg) return false;
                        }
                        return true;
                      }).toList();

                      // Filtered payments
                      final filteredPayments = payments.where((p) {
                        final cust = customerMap[p.customerId];
                        final area = cust?.area ?? "";
                        if (_selectedArea != "All" && area != _selectedArea) return false;

                        if (_searchQuery.isNotEmpty) {
                          final q = _searchQuery.toLowerCase();
                          final matchesName = p.customerName.toLowerCase().contains(q);
                          final matchesId = cust?.displayId.toLowerCase().contains(q) ?? false;
                          if (!matchesName && !matchesId) return false;
                        }
                        return true;
                      }).toList();

                      return Column(
                        children: [
                          // 1. Month Navigation Header & MSO Rates Button
                          Container(
                            color: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                            child: Row(
                              children: [
                                // Month Switcher
                                Container(
                                  decoration: BoxDecoration(
                                    color: AppColors.surfaceSecondary,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      IconButton(
                                        icon: const Icon(Icons.chevron_left_rounded, size: 22),
                                        padding: EdgeInsets.zero,
                                        constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                                        onPressed: _previousMonth,
                                      ),
                                      InkWell(
                                        onTap: _currentMonth,
                                        child: Padding(
                                          padding: const EdgeInsets.symmetric(horizontal: 8),
                                          child: Text(
                                            monthLabel,
                                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
                                          ),
                                        ),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.chevron_right_rounded, size: 22),
                                        padding: EdgeInsets.zero,
                                        constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                                        onPressed: _nextMonth,
                                      ),
                                    ],
                                  ),
                                ),
                                const Spacer(),
                                // Manage MSO Rates Button
                                ElevatedButton.icon(
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFFFEF3C7),
                                    foregroundColor: const Color(0xFF92400E),
                                    elevation: 0,
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      side: const BorderSide(color: Color(0xFFFDE68A)),
                                    ),
                                  ),
                                  icon: const Icon(Icons.tune_rounded, size: 16, color: Color(0xFFD97706)),
                                  label: const Text(
                                    "MSO Rates",
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                                  ),
                                  onPressed: () => _showManageMsoRatesModal(context, packages),
                                ),
                                const SizedBox(width: 6),
                                // WhatsApp Share Button
                                IconButton(
                                  icon: const Icon(Icons.share_rounded, color: Color(0xFF16A34A), size: 20),
                                  tooltip: "Share Monthly Report",
                                  onPressed: () => _shareMonthlyReport(
                                    totalMsoCost: totalMsoCost,
                                    totalBilled: totalBilled,
                                    totalCollected: totalCollected,
                                    netProfit: netCashInHand,
                                    rechargeCount: recharges.length,
                                    paymentCount: payments.length,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // 2. High-Level Financial Summary Cards (2x2 Grid)
                          Container(
                            color: Colors.white,
                            padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
                            child: Column(
                              children: [
                                Row(
                                  children: [
                                    // Card 1: Total MSO Recharge Expense
                                    Expanded(
                                      child: Container(
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFFFFBEB),
                                          borderRadius: BorderRadius.circular(14),
                                          border: Border.all(color: const Color(0xFFFDE68A)),
                                        ),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            const Row(
                                              children: [
                                                Icon(Icons.outbox_rounded, color: Color(0xFFD97706), size: 14),
                                                SizedBox(width: 4),
                                                Flexible(
                                                  child: Text(
                                                    "MSO Expense",
                                                    style: TextStyle(color: Color(0xFF92400E), fontSize: 11, fontWeight: FontWeight.bold),
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              "₹${currency.format(totalMsoCost.toInt())}",
                                              style: const TextStyle(color: Color(0xFF92400E), fontSize: 18, fontWeight: FontWeight.w900),
                                            ),
                                            Text("${recharges.length} Recharges", style: const TextStyle(color: Color(0xFFB45309), fontSize: 10)),
                                          ],
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    // Card 2: Total Collections Received
                                    Expanded(
                                      child: Container(
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFF0FDF4),
                                          borderRadius: BorderRadius.circular(14),
                                          border: Border.all(color: const Color(0xFFBBF7D0)),
                                        ),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            const Row(
                                              children: [
                                                Icon(Icons.account_balance_wallet_rounded, color: Color(0xFF16A34A), size: 14),
                                                SizedBox(width: 4),
                                                Flexible(
                                                  child: Text(
                                                    "Collections",
                                                    style: TextStyle(color: Color(0xFF166534), fontSize: 11, fontWeight: FontWeight.bold),
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              "₹${currency.format(totalCollected.toInt())}",
                                              style: const TextStyle(color: Color(0xFF166534), fontSize: 18, fontWeight: FontWeight.w900),
                                            ),
                                            Text("${payments.length} Payments", style: const TextStyle(color: Color(0xFF15803D), fontSize: 10)),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    // Card 3: Net Cash In Hand (Profit)
                                    Expanded(
                                      child: Container(
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: netCashInHand >= 0 ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2),
                                          borderRadius: BorderRadius.circular(14),
                                          border: Border.all(
                                            color: netCashInHand >= 0 ? const Color(0xFF6EE7B7) : const Color(0xFFFCA5A5),
                                          ),
                                        ),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Icon(
                                                  netCashInHand >= 0 ? Icons.trending_up_rounded : Icons.trending_down_rounded,
                                                  color: netCashInHand >= 0 ? const Color(0xFF059669) : const Color(0xFFDC2626),
                                                  size: 14,
                                                ),
                                                const SizedBox(width: 4),
                                                const Flexible(
                                                  child: Text(
                                                    "Net In-Hand Profit",
                                                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              "${netCashInHand >= 0 ? '+' : '-'}₹${currency.format(netCashInHand.abs().toInt())}",
                                              style: TextStyle(
                                                color: netCashInHand >= 0 ? const Color(0xFF047857) : const Color(0xFFB91C1C),
                                                fontSize: 18,
                                                fontWeight: FontWeight.w900,
                                              ),
                                            ),
                                            const Text("Collections - MSO Cost", style: TextStyle(color: AppColors.textMuted, fontSize: 10)),
                                          ],
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    // Card 4: Total Customer Billed & Margin
                                    Expanded(
                                      child: Container(
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFF8FAFC),
                                          borderRadius: BorderRadius.circular(14),
                                          border: Border.all(color: const Color(0xFFE2E8F0)),
                                        ),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            const Row(
                                              children: [
                                                Icon(Icons.receipt_long_rounded, color: Color(0xFF64748B), size: 14),
                                                SizedBox(width: 4),
                                                Flexible(
                                                  child: Text(
                                                    "Customer Billed",
                                                    style: TextStyle(color: Color(0xFF334155), fontSize: 11, fontWeight: FontWeight.bold),
                                                    maxLines: 1,
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              "₹${currency.format(totalBilled.toInt())}",
                                              style: const TextStyle(color: Color(0xFF1E293B), fontSize: 18, fontWeight: FontWeight.w900),
                                            ),
                                            Text("Margin: +₹${currency.format(expectedMargin.toInt())}", style: const TextStyle(color: Color(0xFF059669), fontSize: 10, fontWeight: FontWeight.bold)),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),

                          // 3. Search Bar & Area Filter
                          Container(
                            color: Colors.white,
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                            child: Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: _searchController,
                                    style: const TextStyle(fontSize: 13),
                                    decoration: InputDecoration(
                                      hintText: "Search customer name, ID...",
                                      hintStyle: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                                      prefixIcon: const Icon(Icons.search, size: 18, color: AppColors.textMuted),
                                      suffixIcon: _searchQuery.isNotEmpty
                                          ? IconButton(
                                              icon: const Icon(Icons.clear, size: 16),
                                              onPressed: () {
                                                _searchController.clear();
                                                setState(() => _searchQuery = "");
                                              },
                                            )
                                          : null,
                                      filled: true,
                                      fillColor: AppColors.surfaceSecondary,
                                      isDense: true,
                                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppColors.border)),
                                    ),
                                    onChanged: (v) => setState(() => _searchQuery = v.trim()),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10),
                                  decoration: BoxDecoration(
                                    color: AppColors.surfaceSecondary,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: DropdownButtonHideUnderline(
                                    child: DropdownButton<String>(
                                      value: _selectedArea,
                                      isDense: true,
                                      items: areaList.map((a) {
                                        return DropdownMenuItem(
                                          value: a,
                                          child: Text(
                                            a == "All" ? "All Lines" : a,
                                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                                          ),
                                        );
                                      }).toList(),
                                      onChanged: (v) {
                                        if (v != null) setState(() => _selectedArea = v);
                                      },
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // 4. Tab Bar (Recharges | Collections | Summary)
                          Container(
                            color: Colors.white,
                            child: TabBar(
                              controller: _tabController,
                              labelColor: const Color(0xFFD97706),
                              unselectedLabelColor: AppColors.textSecondary,
                              indicatorColor: const Color(0xFFD97706),
                              indicatorWeight: 3,
                              tabs: [
                                Tab(text: "Recharges (${filteredRecharges.length})"),
                                Tab(text: "Collections (${filteredPayments.length})"),
                                const Tab(text: "P&L Summary"),
                              ],
                            ),
                          ),

                          // 5. Tab Views
                          Expanded(
                            child: TabBarView(
                              controller: _tabController,
                              children: [
                                // Tab 1: Recharges List
                                filteredRecharges.isEmpty
                                    ? _buildEmptyView("No recharges recorded for this month.")
                                    : ListView.separated(
                                        padding: const EdgeInsets.all(12),
                                        itemCount: filteredRecharges.length,
                                        separatorBuilder: (ctx, i) => const SizedBox(height: 8),
                                        itemBuilder: (_, index) {
                                          final r = filteredRecharges[index];
                                          final cust = customerMap[r.customerId];

                                          return Container(
                                            padding: const EdgeInsets.all(12),
                                            decoration: BoxDecoration(
                                              color: Colors.white,
                                              borderRadius: BorderRadius.circular(14),
                                              border: Border.all(color: AppColors.border),
                                            ),
                                            child: Row(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                CircleAvatar(
                                                  radius: 18,
                                                  backgroundColor: const Color(0xFFFFFBEB),
                                                  child: const Icon(Icons.tv_rounded, color: Color(0xFFD97706), size: 18),
                                                ),
                                                const SizedBox(width: 10),
                                                Expanded(
                                                  child: Column(
                                                    crossAxisAlignment: CrossAxisAlignment.start,
                                                    children: [
                                                      Text(
                                                        r.customerName,
                                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                                                      ),
                                                      const SizedBox(height: 2),
                                                      Text(
                                                        "ID: ${cust?.displayId ?? r.customerId} • ${cust?.area ?? ''}",
                                                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                                      ),
                                                      const SizedBox(height: 4),
                                                      Container(
                                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                        decoration: BoxDecoration(
                                                          color: AppColors.surfaceSecondary,
                                                          borderRadius: BorderRadius.circular(6),
                                                        ),
                                                        child: Text(
                                                          "${r.packageName} (${r.months} Mo)",
                                                          style: const TextStyle(fontSize: 11, color: AppColors.textPrimary, fontWeight: FontWeight.w600),
                                                        ),
                                                      ),
                                                      const SizedBox(height: 4),
                                                      Text(
                                                        DateFormat('dd-MM-yyyy hh:mm a').format(r.rechargeDate),
                                                        style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                                Column(
                                                  crossAxisAlignment: CrossAxisAlignment.end,
                                                  children: [
                                                    Text(
                                                      "MSO: -₹${r.msoCost.toInt()}",
                                                      style: const TextStyle(color: Color(0xFFB45309), fontWeight: FontWeight.bold, fontSize: 13),
                                                    ),
                                                    const SizedBox(height: 2),
                                                    Text(
                                                      "Billed: ₹${r.amount.toInt()}",
                                                      style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                                                    ),
                                                    const SizedBox(height: 2),
                                                    Text(
                                                      "Margin: +₹${r.profit.toInt()}",
                                                      style: const TextStyle(color: Color(0xFF059669), fontWeight: FontWeight.bold, fontSize: 11),
                                                    ),
                                                  ],
                                                ),
                                              ],
                                            ),
                                          );
                                        },
                                      ),

                                // Tab 2: Collections List
                                filteredPayments.isEmpty
                                    ? _buildEmptyView("No collections recorded for this month.")
                                    : ListView.separated(
                                        padding: const EdgeInsets.all(12),
                                        itemCount: filteredPayments.length,
                                        separatorBuilder: (ctx, i) => const SizedBox(height: 8),
                                        itemBuilder: (_, index) {
                                          final p = filteredPayments[index];
                                          final cust = customerMap[p.customerId];

                                          return Container(
                                            padding: const EdgeInsets.all(12),
                                            decoration: BoxDecoration(
                                              color: Colors.white,
                                              borderRadius: BorderRadius.circular(14),
                                              border: Border.all(color: AppColors.border),
                                            ),
                                            child: Row(
                                              children: [
                                                CircleAvatar(
                                                  radius: 18,
                                                  backgroundColor: const Color(0xFFECFDF5),
                                                  child: const Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 18),
                                                ),
                                                const SizedBox(width: 10),
                                                Expanded(
                                                  child: Column(
                                                    crossAxisAlignment: CrossAxisAlignment.start,
                                                    children: [
                                                      Text(
                                                        p.customerName,
                                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                                                      ),
                                                      Text(
                                                        "ID: ${cust?.displayId ?? p.customerId} • ${cust?.area ?? ''}",
                                                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                                      ),
                                                      Text(
                                                        "${p.method} • ${DateFormat('dd-MM-yyyy hh:mm a').format(p.collectionDate)}",
                                                        style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                                Text(
                                                  "+₹${p.amount.toInt()}",
                                                  style: const TextStyle(color: Color(0xFF059669), fontWeight: FontWeight.w900, fontSize: 16),
                                                ),
                                              ],
                                            ),
                                          );
                                        },
                                      ),

                                // Tab 3: Monthly P&L Summary
                                SingleChildScrollView(
                                  padding: const EdgeInsets.all(16),
                                  child: Container(
                                    padding: const EdgeInsets.all(18),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(color: AppColors.border),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          "Monthly Financial Statement ($monthLabel)",
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.textPrimary),
                                        ),
                                        const SizedBox(height: 14),
                                        _buildSummaryRow("Total Recharges (Billed)", "${recharges.length} Boxes"),
                                        _buildSummaryRow("Customer Billed Total", "₹${currency.format(totalBilled.toInt())}"),
                                        _buildSummaryRow("Total MSO Recharge Cost", "-₹${currency.format(totalMsoCost.toInt())}", valueColor: const Color(0xFFD97706)),
                                        _buildSummaryRow("Expected Business Margin", "₹${currency.format(expectedMargin.toInt())}", valueColor: const Color(0xFF059669)),
                                        const Divider(height: 24),
                                        _buildSummaryRow("Collections Received (Inflow)", "+₹${currency.format(totalCollected.toInt())}", valueColor: const Color(0xFF059669), isBold: true),
                                        _buildSummaryRow("Total MSO Cost (Outflow)", "-₹${currency.format(totalMsoCost.toInt())}", valueColor: const Color(0xFFDC2626), isBold: true),
                                        const Divider(height: 24),
                                        _buildSummaryRow(
                                          "Net Cash in Hand (Realized Profit)",
                                          "${netCashInHand >= 0 ? '+' : '-'}₹${currency.format(netCashInHand.abs().toInt())}",
                                          valueColor: netCashInHand >= 0 ? const Color(0xFF059669) : const Color(0xFFDC2626),
                                          isBold: true,
                                          fontSize: 17,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      );
                    },
                  );
                },
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {Color? valueColor, bool isBold = false, double fontSize = 13}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: Text(
              label,
              style: TextStyle(fontSize: fontSize, color: isBold ? AppColors.textPrimary : AppColors.textSecondary, fontWeight: isBold ? FontWeight.bold : FontWeight.normal),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: FontWeight.bold,
              color: valueColor ?? AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyView(String message) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.inbox_outlined, size: 48, color: AppColors.textMuted.withValues(alpha: 0.5)),
          const SizedBox(height: 12),
          Text(message, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        ],
      ),
    );
  }
}
