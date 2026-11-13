import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/customer.dart';
import '../models/models.dart';
import '../services/auth_service.dart';
import '../services/whatsapp_service.dart';
import '../theme/app_theme.dart';
import '../widgets/action_modals.dart';
import 'customers_screen.dart';
import 'complaints_screen.dart';
import 'reminders_screen.dart';
import 'my_collections_screen.dart';
import 'customer_ledger_screen.dart';
import 'recharge_expenses_screen.dart';
import '../services/update_service.dart';

class DashboardScreen extends StatefulWidget {
  final AuthService authService;
  const DashboardScreen({super.key, required this.authService});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  int _currentTabIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      UpdateService.checkOnStartup(context);
    });
  }

  Future<void> _openQuickAction(BuildContext context, int actionType) async {
    Navigator.of(context).pop(); // close drawer

    final operator = widget.authService.currentOperator;
    final operatorName = operator?.name ?? "Operator";
    final operatorUid = widget.authService.currentUser?.uid ?? "";

    final custSnap = await FirebaseFirestore.instance.collection('customers').get();
    final pkgSnap = await FirebaseFirestore.instance.collection('packages').get();

    final allCustomers = custSnap.docs.map((d) => Customer.fromFirestore(d)).toList();
    final packages = pkgSnap.docs.map((d) => CablePackage.fromFirestore(d)).toList();

    if (!context.mounted) return;

    if (actionType == 0) {
      ActionModals.showRechargeModal(
        context,
        operatorName: operatorName,
        operatorUid: operatorUid,
        allCustomers: allCustomers,
        packages: packages,
      );
    } else if (actionType == 1) {
      ActionModals.showCollectModal(
        context,
        operatorName: operatorName,
        operatorUid: operatorUid,
        allCustomers: allCustomers,
      );
    } else if (actionType == 2) {
      ActionModals.showExtraDueModal(
        context,
        operatorName: operatorName,
        operatorUid: operatorUid,
        allCustomers: allCustomers,
      );
    } else if (actionType == 3) {
      ActionModals.showComplaintModal(
        context,
        operatorName: operatorName,
        operatorUid: operatorUid,
        allCustomers: allCustomers,
      );
    }
  }

  void _confirmLogout(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: AppColors.border),
        ),
        title: const Row(
          children: [
            Icon(Icons.logout_rounded, color: AppColors.primary),
            SizedBox(width: 8),
            Text(
              "Sign Out",
              style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ],
        ),
        content: const Text(
          "Are you sure you want to sign out from Sony Cable Operator app?",
          style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Cancel", style: TextStyle(color: AppColors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.of(context).pop(); // close drawer
              widget.authService.logout();
            },
            child: const Text("Logout", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildDrawerItem({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isActive = false,
    Color? iconColor,
    Widget? trailing,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(
        color: isActive ? AppColors.primaryBg : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        border: isActive
            ? Border.all(color: AppColors.primaryBorder)
            : Border.all(color: Colors.transparent),
      ),
      child: ListTile(
        dense: true,
        leading: Container(
          padding: const EdgeInsets.all(7),
          decoration: BoxDecoration(
            color: isActive
                ? AppColors.primary
                : (iconColor != null ? iconColor.withOpacity(0.12) : AppColors.surfaceSecondary),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            icon,
            size: 18,
            color: isActive ? Colors.white : (iconColor ?? AppColors.textSecondary),
          ),
        ),
        title: Text(
          label,
          style: TextStyle(
            color: isActive ? AppColors.primaryDark : AppColors.textPrimary,
            fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
            fontSize: 13.5,
          ),
        ),
        trailing: trailing,
        onTap: onTap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Widget _buildSidebarDrawer(BuildContext context, OperatorModel? operator) {
    final operatorName = operator?.name ?? "Prasad";
    final operatorMobile = operator?.mobile.isNotEmpty == true ? operator!.mobile : "9010737882";
    final areasCount = operator?.areas.length ?? 0;

    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.fromLTRB(16, 16, 12, 16),
              decoration: const BoxDecoration(
                color: AppColors.primaryBg,
                border: Border(bottom: BorderSide(color: AppColors.primaryBorder)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(13),
                      boxShadow: AppColors.orangeShadow,
                    ),
                    child: Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(13),
                          child: Image.asset(
                            'assets/images/app_icon.png',
                            width: 44,
                            height: 44,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const Icon(Icons.tv_rounded, color: Colors.white, size: 24),
                          ),
                        ),
                        Positioned(
                          top: 2,
                          right: 2,
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: Color(0xFF10B981),
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Navanidhi Digital",
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w900,
                            fontSize: 15,
                            letterSpacing: -0.3,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          "Sony Cable Network",
                          style: TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.bold,
                            fontSize: 11,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),

            // Operator Profile Box
            Container(
              margin: const EdgeInsets.all(12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
                boxShadow: AppColors.cardShadow,
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: AppColors.primary,
                    child: Text(
                      operatorName.isNotEmpty ? operatorName[0].toUpperCase() : "P",
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                operatorName,
                                style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFF10B981).withOpacity(0.15),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text(
                                "ACTIVE",
                                style: TextStyle(
                                  color: Color(0xFF059669),
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          "📱 $operatorMobile",
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                        ),
                        if (areasCount > 0)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              "📍 $areasCount Assigned Lines",
                              style: const TextStyle(
                                color: AppColors.primary,
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Scrollable Menu Items
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 4),
                children: [
                  // Overview Section
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
                    child: Row(
                      children: [
                        Container(
                          width: 4,
                          height: 12,
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Text(
                          "OVERVIEW",
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.2,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _buildDrawerItem(
                    icon: Icons.dashboard_rounded,
                    label: "Dashboard",
                    isActive: _currentTabIndex == 0,
                    onTap: () {
                      Navigator.pop(context);
                      setState(() => _currentTabIndex = 0);
                    },
                  ),

                  const SizedBox(height: 10),

                  // Operations & Services
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
                    child: Row(
                      children: [
                        Container(
                          width: 4,
                          height: 12,
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Text(
                          "OPERATIONS & SERVICES",
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.2,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _buildDrawerItem(
                    icon: Icons.people_alt_rounded,
                    label: "Customers Directory",
                    isActive: _currentTabIndex == 1,
                    onTap: () {
                      Navigator.pop(context);
                      setState(() => _currentTabIndex = 1);
                    },
                  ),
                  _buildDrawerItem(
                    icon: Icons.notifications_active_rounded,
                    label: "Recharge Reminders",
                    isActive: _currentTabIndex == 2,
                    onTap: () {
                      Navigator.pop(context);
                      setState(() => _currentTabIndex = 2);
                    },
                  ),
                  _buildDrawerItem(
                    icon: Icons.message_rounded,
                    label: "Customer Complaints",
                    isActive: _currentTabIndex == 3,
                    onTap: () {
                      Navigator.pop(context);
                      setState(() => _currentTabIndex = 3);
                    },
                  ),
                  _buildDrawerItem(
                    icon: Icons.history_rounded,
                    label: "My Collections History",
                    isActive: _currentTabIndex == 4,
                    onTap: () {
                      Navigator.pop(context);
                      setState(() => _currentTabIndex = 4);
                    },
                  ),
                  _buildDrawerItem(
                    icon: Icons.menu_book_rounded,
                    label: "Customer Ledger / Passbook",
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => CustomerLedgerScreen(
                            operatorName: operatorName,
                            operatorUid: widget.authService.currentUser?.uid ?? "",
                          ),
                        ),
                      );
                    },
                  ),
                  _buildDrawerItem(
                    icon: Icons.query_stats_rounded,
                    label: "Recharge Expenses & Profit",
                    iconColor: const Color(0xFFD97706),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => RechargeExpensesScreen(
                            operatorName: operatorName,
                            operatorUid: widget.authService.currentUser?.uid ?? "",
                          ),
                        ),
                      );
                    },
                  ),
                  _buildDrawerItem(
                    icon: Icons.system_update_rounded,
                    label: "Check for Updates",
                    iconColor: const Color(0xFF10B981),
                    onTap: () {
                      Navigator.pop(context);
                      UpdateService.checkManually(context);
                    },
                  ),

                  const SizedBox(height: 10),

                  // Quick Modals Actions
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
                    child: Row(
                      children: [
                        Container(
                          width: 4,
                          height: 12,
                          decoration: BoxDecoration(
                            color: const Color(0xFF10B981),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Text(
                          "QUICK ACTIONS",
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.2,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _buildDrawerItem(
                    icon: Icons.credit_card_rounded,
                    label: "Recharge Package",
                    iconColor: const Color(0xFF10B981),
                    onTap: () => _openQuickAction(context, 0),
                  ),
                  _buildDrawerItem(
                    icon: Icons.currency_rupee_rounded,
                    label: "Collect Due Payment",
                    iconColor: AppColors.primary,
                    onTap: () => _openQuickAction(context, 1),
                  ),
                  _buildDrawerItem(
                    icon: Icons.add_circle_outline_rounded,
                    label: "+ Extra Due",
                    iconColor: const Color(0xFFD97706),
                    onTap: () => _openQuickAction(context, 2),
                  ),
                  _buildDrawerItem(
                    icon: Icons.rate_review_rounded,
                    label: "Register Complaint",
                    iconColor: const Color(0xFFE11D48),
                    onTap: () => _openQuickAction(context, 3),
                  ),
                ],
              ),
            ),

            // Footer Logout
            Container(
              padding: const EdgeInsets.all(14),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: InkWell(
                onTap: () => _confirmLogout(context),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFECACA)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.logout_rounded, color: Color(0xFFDC2626), size: 18),
                          SizedBox(width: 10),
                          Text(
                            "Logout",
                            style: TextStyle(
                              color: Color(0xFF991B1B),
                              fontWeight: FontWeight.bold,
                              fontSize: 13.5,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDC2626),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          "EXIT",
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.5,
                          ),
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
    );
  }

  @override
  Widget build(BuildContext context) {
    final operator = widget.authService.currentOperator;
    final operatorName = operator?.name ?? "Operator";
    final operatorUid = widget.authService.currentUser?.uid ?? "";

    final screens = [
      _DashboardHomeTab(
        operatorName: operatorName,
        operatorUid: operatorUid,
        operator: operator,
        onOpenDrawer: () => _scaffoldKey.currentState?.openDrawer(),
        onNavigateToTab: (index) => setState(() => _currentTabIndex = index),
      ),
      CustomersScreen(
        operatorName: operatorName,
        operatorUid: operatorUid,
        onOpenDrawer: () => _scaffoldKey.currentState?.openDrawer(),
      ),
      RemindersScreen(
        operatorName: operatorName,
        operatorUid: operatorUid,
        onOpenDrawer: () => _scaffoldKey.currentState?.openDrawer(),
      ),
      ComplaintsScreen(
        operatorName: operatorName,
        operatorUid: operatorUid,
        onOpenDrawer: () => _scaffoldKey.currentState?.openDrawer(),
      ),
      MyCollectionsScreen(
        operatorName: operatorName,
        operatorUid: operatorUid,
        onOpenDrawer: () => _scaffoldKey.currentState?.openDrawer(),
      ),
    ];

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: AppColors.background,
      drawer: _buildSidebarDrawer(context, operator),
      body: IndexedStack(
        index: _currentTabIndex,
        children: screens,
      ),
      bottomNavigationBar: _buildBottomNavBar(),
    );
  }

  Widget _buildBottomNavBar() {
    final navItems = [
      {'icon': Icons.dashboard_rounded, 'label': 'Dashboard'},
      {'icon': Icons.people_alt_rounded, 'label': 'Customers'},
      {'icon': Icons.notifications_active_rounded, 'label': 'Reminders'},
      {'icon': Icons.message_rounded, 'label': 'Complaints'},
      {'icon': Icons.history_rounded, 'label': 'Collections'},
    ];

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(
          top: BorderSide(color: Color(0xFFE2E8F0), width: 1.5),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 10,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: List.generate(navItems.length, (index) {
              final isSelected = _currentTabIndex == index;
              final item = navItems[index];

              return InkWell(
                onTap: () => setState(() => _currentTabIndex = index),
                borderRadius: BorderRadius.circular(14),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.primaryBg : Colors.transparent,
                    borderRadius: BorderRadius.circular(14),
                    border: isSelected ? Border.all(color: AppColors.primaryBorder) : null,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        item['icon'] as IconData,
                        color: isSelected ? AppColors.primary : const Color(0xFF475569),
                        size: 22,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        item['label'] as String,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                          color: isSelected ? AppColors.primary : const Color(0xFF475569),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}

class _DashboardHomeTab extends StatelessWidget {
  final String operatorName;
  final String operatorUid;
  final OperatorModel? operator;
  final VoidCallback onOpenDrawer;
  final Function(int) onNavigateToTab;

  const _DashboardHomeTab({
    required this.operatorName,
    required this.operatorUid,
    required this.operator,
    required this.onOpenDrawer,
    required this.onNavigateToTab,
  });

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance.collection('customers').snapshots(),
      builder: (context, custSnapshot) {
        return StreamBuilder<QuerySnapshot>(
          stream: FirebaseFirestore.instance.collection('payments').snapshots(),
          builder: (context, paymentsSnapshot) {
            return StreamBuilder<QuerySnapshot>(
              stream: FirebaseFirestore.instance.collection('complaints').snapshots(),
              builder: (context, complaintsSnapshot) {
                return StreamBuilder<QuerySnapshot>(
                  stream: FirebaseFirestore.instance.collection('packages').snapshots(),
                  builder: (context, packagesSnapshot) {
                    final allCustomers = custSnapshot.hasData
                        ? custSnapshot.data!.docs.map((d) => Customer.fromFirestore(d)).toList()
                        : <Customer>[];

                    final allPayments = paymentsSnapshot.hasData
                        ? paymentsSnapshot.data!.docs.map((d) => PaymentModel.fromFirestore(d)).toList()
                        : <PaymentModel>[];

                    final allComplaints = complaintsSnapshot.hasData
                        ? complaintsSnapshot.data!.docs.map((d) => ComplaintModel.fromFirestore(d)).toList()
                        : <ComplaintModel>[];

                    final allPackages = packagesSnapshot.hasData
                        ? packagesSnapshot.data!.docs.map((d) => CablePackage.fromFirestore(d)).toList()
                        : <CablePackage>[];

                    // Compute KPIs
                    final totalOutstanding = allCustomers.fold<double>(
                      0.0,
                      (sum, c) => sum + (c.balanceAmount > 0 ? c.balanceAmount : 0),
                    );

                    final pendingComplaints = allComplaints.where((c) => c.status.toLowerCase() == 'pending').length;

                    // Today's Collection by this operator
                    final now = DateTime.now();
                    final todayStart = DateTime(now.year, now.month, now.day);
                    final todaysCollection = allPayments
                        .where((p) =>
                            p.collectedBy == operatorUid &&
                            p.collectionDate.isAfter(todayStart))
                        .fold<double>(0.0, (sum, p) => sum + p.amount);

                    // Operator total cash collected in hand
                    final myTotalCollection = allPayments
                        .where((p) => p.collectedBy == operatorUid)
                        .fold<double>(0.0, (sum, p) => sum + p.amount);

                    final today = DateTime(now.year, now.month, now.day);

                    // Expiring in next 3 days (today to next 3 days, excluding already expired)
                    final expiringCustomers = allCustomers.where((c) {
                      if (c.expiryDate == null) return false;
                      final expDate = DateTime(c.expiryDate!.year, c.expiryDate!.month, c.expiryDate!.day);
                      final diff = expDate.difference(today).inDays;
                      return diff >= 0 && diff <= 3;
                    }).toList();

                    expiringCustomers.sort((a, b) {
                      final aExp = a.expiryDate ?? DateTime.now();
                      final bExp = b.expiryDate ?? DateTime.now();
                      return aExp.compareTo(bExp);
                    });

                    final currency = NumberFormat('#,##,###');

                    return SafeArea(
                      child: RefreshIndicator(
                        onRefresh: () async {},
                        color: const Color(0xFFE11D48),
                        backgroundColor: const Color(0xFF191217),
                        child: SingleChildScrollView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Top App Bar
                              _buildTopBar(context),
                              const SizedBox(height: 16),

                              // 4 Key Metric Cards
                              Row(
                                children: [
                                  Expanded(
                                    child: _buildMetricCard(
                                      title: "Total Outstanding",
                                      value: "₹${currency.format(totalOutstanding.toInt())}",
                                      subtitle: "Total Due Balance",
                                      icon: Icons.currency_rupee,
                                      bgColor: const Color(0xFFFFF1F2),
                                      textColor: const Color(0xFF9F1239),
                                      borderColor: const Color(0xFFFECDD3),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: _buildMetricCard(
                                      title: "Pending Complaints",
                                      value: "$pendingComplaints",
                                      subtitle: "Pending Complaints",
                                      icon: Icons.warning_amber_rounded,
                                      bgColor: const Color(0xFFFEFCE8),
                                      textColor: const Color(0xFF854D0E),
                                      borderColor: const Color(0xFFFEF08A),
                                      onTap: () => onNavigateToTab(3),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: _buildMetricCard(
                                      title: "Today's Collection",
                                      value: "₹${currency.format(todaysCollection.toInt())}",
                                      subtitle: "Today's Collection",
                                      icon: Icons.currency_rupee,
                                      bgColor: const Color(0xFFEFF6FF),
                                      textColor: const Color(0xFF1E40AF),
                                      borderColor: const Color(0xFFBFDBFE),
                                      onTap: () => onNavigateToTab(4),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: _buildMetricCard(
                                      title: "Collection Wallet",
                                      value: "₹${currency.format(myTotalCollection.toInt())}",
                                      subtitle: "Total Cash Collected",
                                      icon: Icons.account_balance_wallet_outlined,
                                      bgColor: const Color(0xFFF0FDF4),
                                      textColor: const Color(0xFF166534),
                                      borderColor: const Color(0xFFBBF7D0),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 20),

                              // Quick Actions (4 Actions)
                              _buildQuickActions(
                                context,
                                allCustomers: allCustomers,
                                packages: allPackages,
                              ),
                              const SizedBox(height: 24),

                              // Expiring Boxes Section
                              _buildExpiringBoxesSection(
                                context,
                                expiringCustomers: expiringCustomers,
                                allCustomers: allCustomers,
                                packages: allPackages,
                              ),
                              const SizedBox(height: 24),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            );
          },
        );
      },
    );
  }

  Widget _buildTopBar(BuildContext context) {
    return Row(
      children: [
        // Hamburger Drawer Button
        InkWell(
          onTap: onOpenDrawer,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
              boxShadow: AppColors.cardShadow,
            ),
            child: const Icon(Icons.menu_rounded, color: AppColors.textPrimary, size: 23),
          ),
        ),
        const SizedBox(width: 10),
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.primary, AppColors.primaryDark],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(12),
            boxShadow: AppColors.orangeShadow,
          ),
          child: const Icon(Icons.tv_rounded, color: Colors.white, size: 22),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text(
                    "Sony Cable Network",
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primaryBg,
                      border: Border.all(color: AppColors.primaryBorder),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.shield_outlined, size: 10, color: AppColors.primary),
                        SizedBox(width: 3),
                        Text(
                          "Cable Operator",
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                "Welcome, $operatorName!",
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color bgColor,
    required Color textColor,
    required Color borderColor,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: borderColor),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
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
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: textColor.withOpacity(0.85)),
                  ),
                ),
                Icon(icon, size: 16, color: textColor.withOpacity(0.7)),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: textColor,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 10, color: textColor.withOpacity(0.7)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActions(
    BuildContext context, {
    required List<Customer> allCustomers,
    required List<CablePackage> packages,
  }) {
    return Container(
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
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                "QUICK ACTIONS",
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.8,
                  color: AppColors.textSecondary,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primaryBg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.primaryBorder),
                ),
                child: const Text(
                  "4 ACTIONS",
                  style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: AppColors.primary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              // 1. Recharge
              Expanded(
                child: _buildActionBtn(
                  label: "Recharge",
                  icon: Icons.credit_card_rounded,
                  iconColor: const Color(0xFF16A34A),
                  bgColor: const Color(0xFFF0FDF4),
                  borderColor: const Color(0xFFBBF7D0),
                  onTap: () {
                    ActionModals.showRechargeModal(
                      context,
                      allCustomers: allCustomers,
                      packages: packages,
                      operatorName: operatorName,
                      operatorUid: operatorUid,
                    );
                  },
                ),
              ),
              const SizedBox(width: 8),

              // 2. Collect
              Expanded(
                child: _buildActionBtn(
                  label: "Collect",
                  icon: Icons.currency_rupee,
                  iconColor: AppColors.primary,
                  bgColor: AppColors.primaryBg,
                  borderColor: AppColors.primaryBorder,
                  onTap: () {
                    ActionModals.showCollectModal(
                      context,
                      allCustomers: allCustomers,
                      operatorName: operatorName,
                      operatorUid: operatorUid,
                    );
                  },
                ),
              ),
              const SizedBox(width: 8),

              // 3. + Extra Due
              Expanded(
                child: _buildActionBtn(
                  label: "+ Extra Due",
                  icon: Icons.add_circle_outline_rounded,
                  iconColor: const Color(0xFFD97706),
                  bgColor: const Color(0xFFFEFCE8),
                  borderColor: const Color(0xFFFEF08A),
                  onTap: () {
                    ActionModals.showExtraDueModal(
                      context,
                      allCustomers: allCustomers,
                      operatorName: operatorName,
                      operatorUid: operatorUid,
                    );
                  },
                ),
              ),
              const SizedBox(width: 8),

              // 4. Complaint Reg.
              Expanded(
                child: _buildActionBtn(
                  label: "Complaint Reg.",
                  icon: Icons.message_outlined,
                  iconColor: const Color(0xFFDC2626),
                  bgColor: const Color(0xFFFEF2F2),
                  borderColor: const Color(0xFFFECACA),
                  onTap: () {
                    ActionModals.showComplaintModal(
                      context,
                      allCustomers: allCustomers,
                      operatorName: operatorName,
                      operatorUid: operatorUid,
                    );
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionBtn({
    required String label,
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
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: borderColor),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: iconColor, size: 24),
            const SizedBox(height: 6),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: iconColor,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildExpiringBoxesSection(
    BuildContext context, {
    required List<Customer> expiringCustomers,
    required List<Customer> allCustomers,
    required List<CablePackage> packages,
  }) {
    final count = expiringCustomers.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(
                    color: AppColors.primaryBg,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.access_time_rounded, color: AppColors.primary, size: 18),
                ),
                const SizedBox(width: 8),
                const Text(
                  "Expiring Boxes (Next 3 Days)",
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    "$count Boxes",
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ),
              ],
            ),
            TextButton.icon(
              onPressed: () => onNavigateToTab(2), // go to reminders tab
              icon: const Text("View All", style: TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.bold)),
              label: const Icon(Icons.arrow_forward, color: AppColors.primary, size: 14),
              style: TextButton.styleFrom(padding: EdgeInsets.zero),
            ),
          ],
        ),
        const SizedBox(height: 10),

        if (expiringCustomers.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
              boxShadow: AppColors.cardShadow,
            ),
            child: const Center(
              child: Text(
                "No boxes expiring in the next 3 days! 🎉",
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
            ),
          )
        else
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: expiringCustomers.take(5).length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final cust = expiringCustomers[index];
              return _buildExpiringCard(
                context,
                cust: cust,
                allCustomers: allCustomers,
                packages: packages,
              );
            },
          ),
      ],
    );
  }

  Widget _buildExpiringCard(
    BuildContext context, {
    required Customer cust,
    required List<Customer> allCustomers,
    required List<CablePackage> packages,
  }) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final expDate = cust.expiryDate != null
        ? DateTime(cust.expiryDate!.year, cust.expiryDate!.month, cust.expiryDate!.day)
        : null;
    final diff = expDate != null ? expDate.difference(today).inDays : 0;

    String badgeText;
    Color badgeColor;
    if (diff < 0) {
      badgeText = "Expired";
      badgeColor = AppColors.danger;
    } else if (diff == 0) {
      badgeText = "Today";
      badgeColor = AppColors.warning;
    } else if (diff == 1) {
      badgeText = "Tomorrow";
      badgeColor = AppColors.primary;
    } else {
      badgeText = "in $diff Days";
      badgeColor = AppColors.primary;
    }

    // Initials
    final initials = cust.name.trim().isNotEmpty
        ? cust.name.trim().split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join().toUpperCase()
        : "CU";

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.cardShadow,
      ),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
        leading: CircleAvatar(
          radius: 20,
          backgroundColor: AppColors.primaryBg,
          child: Text(
            initials,
            style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 12),
          ),
        ),
        title: Text(
          cust.name,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
        ),
        subtitle: Row(
          children: [
            Text(
              "ID: ${cust.displayId}",
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            if (cust.area.isNotEmpty) ...[
              const SizedBox(width: 6),
              const Icon(Icons.location_on_outlined, size: 12, color: AppColors.textMuted),
              Text(
                cust.area,
                style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
              ),
            ],
          ],
        ),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: badgeColor.withOpacity(0.12),
            border: Border.all(color: badgeColor.withOpacity(0.35)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            badgeText,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: badgeColor),
          ),
        ),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            child: Row(
              children: [
                // Call
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.call, size: 16),
                    label: const Text("Call", style: TextStyle(fontSize: 12)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.textSecondary,
                      side: const BorderSide(color: AppColors.border),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () => WhatsAppService.makeCall(cust.mobile),
                  ),
                ),
                const SizedBox(width: 8),

                // WhatsApp Reminder
                Expanded(
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.chat_bubble_outline, size: 16),
                    label: const Text("WhatsApp", style: TextStyle(fontSize: 12)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF25D366),
                      foregroundColor: Colors.white,
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

                // Quick Recharge / Collect
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () {
                      ActionModals.showRechargeModal(
                        context,
                        allCustomers: allCustomers,
                        packages: packages,
                        operatorName: operatorName,
                        operatorUid: operatorUid,
                        preSelectedCustomer: cust,
                      );
                    },
                    child: const Text("Recharge", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
