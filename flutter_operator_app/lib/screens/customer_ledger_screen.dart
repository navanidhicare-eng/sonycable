import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/customer.dart';
import '../services/whatsapp_service.dart';
import '../theme/app_theme.dart';

class CustomerLedgerScreen extends StatefulWidget {
  final Customer? initialCustomer;
  final String? initialCustomerId;
  final String operatorName;
  final String operatorUid;

  const CustomerLedgerScreen({
    super.key,
    this.initialCustomer,
    this.initialCustomerId,
    required this.operatorName,
    required this.operatorUid,
  });

  @override
  State<CustomerLedgerScreen> createState() => _CustomerLedgerScreenState();
}

class _LedgerEntry {
  final String id;
  final DateTime date;
  final String type; // 'Recharge' or 'Payment'
  final String title;
  final String? subtitle;
  final double amount;
  final double runningBalance;
  final String? method;

  _LedgerEntry({
    required this.id,
    required this.date,
    required this.type,
    required this.title,
    this.subtitle,
    required this.amount,
    required this.runningBalance,
    this.method,
  });
}

class _CustomerLedgerScreenState extends State<CustomerLedgerScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _searchCtrl = TextEditingController();

  Customer? _selectedCustomer;
  bool _isLoadingCustomer = false;
  String _selectedArea = 'All Areas';
  bool _onlyWithDue = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);

    if (widget.initialCustomer != null) {
      _selectedCustomer = widget.initialCustomer;
      _searchCtrl.text = widget.initialCustomer!.displayId;
    } else if (widget.initialCustomerId != null && widget.initialCustomerId!.isNotEmpty) {
      _searchCtrl.text = widget.initialCustomerId!;
      _loadCustomerById(widget.initialCustomerId!);
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadCustomerById(String queryStr) async {
    final q = queryStr.trim();
    if (q.isEmpty) return;

    setState(() => _isLoadingCustomer = true);
    try {
      // 1. Try by document ID
      final docSnap = await FirebaseFirestore.instance.collection('customers').doc(q).get();
      if (docSnap.exists) {
        setState(() {
          _selectedCustomer = Customer.fromFirestore(docSnap);
          _isLoadingCustomer = false;
        });
        return;
      }

      // 2. Try by customerId field
      final snap1 = await FirebaseFirestore.instance
          .collection('customers')
          .where('customerId', isEqualTo: q)
          .limit(1)
          .get();
      if (snap1.docs.isNotEmpty) {
        setState(() {
          _selectedCustomer = Customer.fromFirestore(snap1.docs.first);
          _isLoadingCustomer = false;
        });
        return;
      }

      // 3. Try integer format or mobile
      final snap2 = await FirebaseFirestore.instance
          .collection('customers')
          .where('mobile', isEqualTo: q)
          .limit(1)
          .get();
      if (snap2.docs.isNotEmpty) {
        setState(() {
          _selectedCustomer = Customer.fromFirestore(snap2.docs.first);
          _isLoadingCustomer = false;
        });
        return;
      }

      // If not found directly, show message
      setState(() => _isLoadingCustomer = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("No customer found for '$q'. Tap 'List' to select from all."),
            backgroundColor: Colors.red.shade600,
          ),
        );
      }
    } catch (e) {
      setState(() => _isLoadingCustomer = false);
    }
  }

  void _sharePassbookWhatsApp() async {
    if (_selectedCustomer == null) return;
    final c = _selectedCustomer!;
    final ledgerLink = '${WhatsAppService.publicBaseUrl}/passbook?id=${c.id}';

    final message = '''*Sony Cable Network - పాస్‌బుక్ లెడ్జర్*

నమస్కారం *${c.name}* గారు,
మీ సెట్-టాప్ బాక్స్ (ID: ${c.displayId}) కి సంబంధించిన పూర్తి రీఛార్జ్ మరియు చెల్లింపుల లెడ్జర్ రికార్డులను క్రింది లింక్ ద్వారా ఎప్పుడైనా చూసుకోవచ్చు:

పాస్‌బుక్ లెడ్జర్ లింక్:
$ledgerLink

ప్రస్తుత బకాయి స్థితి: ${c.balanceAmount > 0 ? "₹${c.balanceAmount.toInt()} బాకీ" : (c.balanceAmount < 0 ? "-₹${(-c.balanceAmount).toInt()} అడ్వాన్స్" : "₹0 (పూర్తిగా చెల్లించబడింది)")}

ధన్యవాదాలు!
*Sony Cable Network Support*
హెల్ప్‌లైన్: ${WhatsAppService.helpline}''';

    await WhatsAppService.sendWhatsApp(mobile: c.mobile, message: message);
  }

  void _copyPassbookLink() {
    if (_selectedCustomer == null) return;
    final link = '${WhatsAppService.publicBaseUrl}/passbook?id=${_selectedCustomer!.id}';
    Clipboard.setData(ClipboardData(text: link));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text("Passbook link copied to clipboard!"),
        backgroundColor: Color(0xFF10B981),
      ),
    );
  }

  void _openInBrowser() async {
    if (_selectedCustomer == null) return;
    final link = '${WhatsAppService.publicBaseUrl}/passbook?id=${_selectedCustomer!.id}';
    final url = Uri.parse(link);
    try {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance.collection('customers').snapshots(),
      builder: (context, custSnapshot) {
        final allCustomers = (custSnapshot.data?.docs ?? [])
            .map((d) => Customer.fromFirestore(d))
            .toList();

        // Keep _selectedCustomer up-to-date with live data if already selected
        if (_selectedCustomer != null) {
          final liveCust = allCustomers.firstWhere(
            (c) => c.id == _selectedCustomer!.id,
            orElse: () => _selectedCustomer!,
          );
          _selectedCustomer = liveCust;
        }

        return Scaffold(
          backgroundColor: AppColors.background,
          appBar: AppBar(
            elevation: 0,
            backgroundColor: Colors.white,
            foregroundColor: AppColors.textPrimary,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_rounded),
              onPressed: () {
                if (_selectedCustomer != null && widget.initialCustomer == null) {
                  setState(() {
                    _selectedCustomer = null;
                    _searchCtrl.clear();
                  });
                } else {
                  Navigator.pop(context);
                }
              },
            ),
            title: Text(
              _selectedCustomer == null
                  ? "Customer Ledger"
                  : _selectedCustomer!.name,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
            actions: [
              if (_selectedCustomer != null) ...[
                IconButton(
                  icon: const Icon(Icons.share_rounded, color: Color(0xFF25D366)),
                  tooltip: "Send WhatsApp Ledger",
                  onPressed: _sharePassbookWhatsApp,
                ),
                IconButton(
                  icon: const Icon(Icons.copy_rounded, color: AppColors.primary),
                  tooltip: "Copy Link",
                  onPressed: _copyPassbookLink,
                ),
                IconButton(
                  icon: const Icon(Icons.open_in_browser_rounded, color: Color(0xFF2563EB)),
                  tooltip: "Open in Browser",
                  onPressed: _openInBrowser,
                ),
              ],
            ],
          ),
          body: Column(
            children: [
              // 1. Search Bar & Area Filter Header (when no customer selected)
              if (_selectedCustomer == null)
                Container(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                  color: Colors.white,
                  child: Column(
                    children: [
                      Container(
                        height: 46,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: TextField(
                          controller: _searchCtrl,
                          keyboardType: TextInputType.text,
                          decoration: InputDecoration(
                            hintText: "Search Name, Customer ID, Mobile, Line...",
                            hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                            prefixIcon: const Icon(Icons.search_rounded, color: AppColors.primary, size: 22),
                            suffixIcon: _searchCtrl.text.isNotEmpty
                                ? IconButton(
                                    icon: const Icon(Icons.clear_rounded, size: 18),
                                    onPressed: () {
                                      _searchCtrl.clear();
                                      setState(() {});
                                    },
                                  )
                                : null,
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          ),
                          onChanged: (val) => setState(() {}),
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Area Filter & Only-With-Due Filters
                      Builder(builder: (_) {
                        final Set<String> areaSet = {};
                        for (var c in allCustomers) {
                          if (c.area.trim().isNotEmpty) {
                            areaSet.add(c.area.trim());
                          }
                        }
                        final areasList = ['All Areas', ...areaSet.toList()..sort()];

                        return Row(
                          children: [
                            // Area Dropdown
                            Expanded(
                              child: Container(
                                height: 36,
                                padding: const EdgeInsets.symmetric(horizontal: 10),
                                decoration: BoxDecoration(
                                  color: _selectedArea != 'All Areas'
                                      ? AppColors.primaryBg
                                      : const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: _selectedArea != 'All Areas'
                                        ? AppColors.primaryBorder
                                        : const Color(0xFFE2E8F0),
                                  ),
                                ),
                                child: DropdownButtonHideUnderline(
                                  child: DropdownButton<String>(
                                    value: areasList.contains(_selectedArea) ? _selectedArea : 'All Areas',
                                    isExpanded: true,
                                    icon: const Icon(Icons.arrow_drop_down, color: AppColors.primary, size: 20),
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.textPrimary,
                                    ),
                                    items: areasList.map((area) {
                                      return DropdownMenuItem<String>(
                                        value: area,
                                        child: Row(
                                          children: [
                                            Icon(
                                              area == 'All Areas'
                                                  ? Icons.map_rounded
                                                  : Icons.location_on_rounded,
                                              size: 14,
                                              color: AppColors.primary,
                                            ),
                                            const SizedBox(width: 6),
                                            Expanded(
                                              child: Text(
                                                area,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    }).toList(),
                                    onChanged: (val) {
                                      if (val != null) setState(() => _selectedArea = val);
                                    },
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),

                            // Only With Due Chip
                            FilterChip(
                              label: const Text("Only With Due"),
                              selected: _onlyWithDue,
                              selectedColor: AppColors.primary,
                              backgroundColor: const Color(0xFFF1F5F9),
                              labelStyle: TextStyle(
                                color: _onlyWithDue ? Colors.white : AppColors.textSecondary,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              side: BorderSide(
                                color: _onlyWithDue ? AppColors.primary : const Color(0xFFE2E8F0),
                              ),
                              onSelected: (val) => setState(() => _onlyWithDue = val),
                            ),
                          ],
                        );
                      }),
                    ],
                  ),
                )
              else
                // Switch / Change Customer Bar
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  color: const Color(0xFFF8FAFC),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.person_rounded, size: 16, color: AppColors.textSecondary),
                          const SizedBox(width: 6),
                          Text(
                            "ID: ${_selectedCustomer!.displayId} • ${_selectedCustomer!.area}",
                            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                      InkWell(
                        onTap: () {
                          setState(() {
                            _selectedCustomer = null;
                            _searchCtrl.clear();
                          });
                        },
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.primaryBg,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppColors.primaryBorder),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.swap_horiz_rounded, size: 15, color: AppColors.primary),
                              SizedBox(width: 4),
                              Text(
                                "Change Customer",
                                style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: AppColors.primary),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

              // 2. Direct Body View
              Expanded(
                child: _isLoadingCustomer
                    ? const Center(child: CircularProgressIndicator())
                    : _selectedCustomer == null
                        ? _buildDirectCustomerListView(allCustomers)
                        : _buildCustomerLedgerView(_selectedCustomer!),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildDirectCustomerListView(List<Customer> allCustomers) {
    final query = _searchCtrl.text.trim().toLowerCase();

    // 1. Filter by Area, Due, and Query
    final filtered = allCustomers.where((c) {
      if (_selectedArea != 'All Areas') {
        if (c.area.trim().toLowerCase() != _selectedArea.toLowerCase()) {
          return false;
        }
      }
      if (_onlyWithDue && c.balanceAmount <= 0) {
        return false;
      }
      if (query.isEmpty) return true;
      return c.name.toLowerCase().contains(query) ||
          c.displayId.toLowerCase().contains(query) ||
          c.mobile.contains(query) ||
          c.area.toLowerCase().contains(query);
    }).toList();

    // 2. Sort by Highest Balance First (యెక్కువ బ్యాలెన్స్ ఉన్నవారు పైన)
    filtered.sort((a, b) {
      final cmp = b.balanceAmount.compareTo(a.balanceAmount);
      if (cmp != 0) return cmp;
      return a.name.toLowerCase().compareTo(b.name.toLowerCase());
    });

    if (filtered.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.search_off_rounded, size: 54, color: AppColors.textMuted),
              const SizedBox(height: 12),
              Text(
                _selectedArea != 'All Areas'
                    ? "No customers found in '$_selectedArea'"
                    : "No customers found for '${_searchCtrl.text}'",
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 6),
              const Text(
                "Try clearing filters or searching another customer ID or mobile.",
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

    final currency = NumberFormat('#,##,###');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 10, 18, 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.sort_rounded, size: 14, color: Color(0xFFDC2626)),
                  const SizedBox(width: 4),
                  Text(
                    "HIGHEST DUE FIRST",
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                      color: Color(0xFFDC2626),
                    ),
                  ),
                ],
              ),
              Text(
                "${filtered.length} Customers",
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
            itemCount: filtered.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (ctx, idx) {
              final c = filtered[idx];
              final hasDue = c.balanceAmount > 0;
              final isAdv = c.balanceAmount < 0;

              return InkWell(
                onTap: () {
                  setState(() {
                    _selectedCustomer = c;
                    _searchCtrl.clear();
                  });
                },
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 22,
                        backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                        child: Text(
                          c.name.isNotEmpty ? c.name[0].toUpperCase() : '?',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              c.name,
                              style: const TextStyle(
                                fontSize: 14.5,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              "ID: ${c.displayId} • ${c.mobile}",
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: AppColors.textSecondary,
                              ),
                            ),
                            Text(
                              "Line: ${c.area.isNotEmpty ? c.area : 'N/A'}",
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            hasDue
                                ? "₹${currency.format(c.balanceAmount)}"
                                : (isAdv ? "-₹${currency.format(c.balanceAmount.abs())}" : "₹0"),
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: hasDue
                                  ? const Color(0xFFDC2626)
                                  : (isAdv ? const Color(0xFF2563EB) : const Color(0xFF16A34A)),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            hasDue ? "Due Balance" : (isAdv ? "Advance" : "No Due"),
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: hasDue
                                  ? const Color(0xFFDC2626)
                                  : (isAdv ? const Color(0xFF2563EB) : const Color(0xFF16A34A)),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 8),
                      const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 22),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildCustomerLedgerView(Customer c) {
    final currency = NumberFormat('#,##,###');

    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('recharges')
          .where('customerId', isEqualTo: c.id)
          .snapshots(),
      builder: (context, rechargeSnap) {
        return StreamBuilder<QuerySnapshot>(
          stream: FirebaseFirestore.instance
              .collection('payments')
              .where('customerId', isEqualTo: c.id)
              .snapshots(),
          builder: (context, paymentSnap) {
            final rechargesDocs = rechargeSnap.data?.docs ?? [];
            final paymentsDocs = paymentSnap.data?.docs ?? [];

            // Parse Raw Transactions
            final List<_LedgerEntry> rawEntries = [];
            double sumRecharges = 0;
            double sumPayments = 0;

            for (var d in rechargesDocs) {
              final data = d.data() as Map<String, dynamic>;
              final amt = (data['amount'] is num)
                  ? (data['amount'] as num).toDouble()
                  : (double.tryParse(data['amount']?.toString() ?? '0') ?? 0.0);
              sumRecharges += amt;

              DateTime date = DateTime.now();
              if (data['rechargeDate'] is Timestamp) {
                date = (data['rechargeDate'] as Timestamp).toDate();
              } else if (data['rechargeDate'] != null) {
                date = DateTime.tryParse(data['rechargeDate'].toString()) ?? DateTime.now();
              }

              final isExtra = data['isExtraDue'] == true ||
                  (data['packageName']?.toString().toLowerCase().contains('service charge') ?? false);
              final title = data['packageName']?.toString() ?? (isExtra ? 'Service Charge' : 'Package Recharge');

              rawEntries.add(_LedgerEntry(
                id: d.id,
                date: date,
                type: 'Recharge',
                title: title,
                subtitle: isExtra ? 'Extra Due / Service' : 'Cable Plan',
                amount: amt,
                runningBalance: 0,
              ));
            }

            for (var d in paymentsDocs) {
              final data = d.data() as Map<String, dynamic>;
              final amt = (data['amount'] is num)
                  ? (data['amount'] as num).toDouble()
                  : (double.tryParse(data['amount']?.toString() ?? '0') ?? 0.0);
              sumPayments += amt;

              DateTime date = DateTime.now();
              if (data['collectionDate'] is Timestamp) {
                date = (data['collectionDate'] as Timestamp).toDate();
              } else if (data['collectionDate'] != null) {
                date = DateTime.tryParse(data['collectionDate'].toString()) ?? DateTime.now();
              }

              final method = data['method']?.toString() ?? 'Cash';
              final op = data['collectedByName']?.toString() ?? 'Staff';

              rawEntries.add(_LedgerEntry(
                id: d.id,
                date: date,
                type: 'Payment',
                title: 'Payment Received',
                subtitle: 'Mode: $method • By $op',
                amount: amt,
                runningBalance: 0,
                method: method,
              ));
            }

            // Chronological Sort Ascending to compute running balance
            rawEntries.sort((a, b) => a.date.compareTo(b.date));

            final double targetBalance = c.balanceAmount;
            final double initialBal = targetBalance - (sumRecharges - sumPayments);
            double running = initialBal;

            final List<_LedgerEntry> computedEntries = [];
            for (var entry in rawEntries) {
              if (entry.type == 'Recharge') {
                running += entry.amount;
              } else {
                running -= entry.amount;
              }
              computedEntries.add(_LedgerEntry(
                id: entry.id,
                date: entry.date,
                type: entry.type,
                title: entry.title,
                subtitle: entry.subtitle,
                amount: entry.amount,
                runningBalance: running,
                method: entry.method,
              ));
            }

            // Sort Descending (Newest first) for UI display
            final passbookList = List<_LedgerEntry>.from(computedEntries.reversed);
            final rechargesList = passbookList.where((e) => e.type == 'Recharge').toList();
            final paymentsList = passbookList.where((e) => e.type == 'Payment').toList();

            return Column(
              children: [
                // Customer Profile & Balance Summary Card
                Container(
                  margin: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          CircleAvatar(
                            radius: 22,
                            backgroundColor: AppColors.primary.withValues(alpha: 0.12),
                            child: Text(
                              c.name.isNotEmpty ? c.name[0].toUpperCase() : '?',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  c.name,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w900,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  "ID: ${c.displayId} • ${c.mobile}",
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                                Text(
                                  "Line: ${c.area.isNotEmpty ? c.area : 'N/A'}",
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: AppColors.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          // Balance Display
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                c.balanceAmount > 0
                                    ? "₹${currency.format(c.balanceAmount)}"
                                    : (c.balanceAmount < 0
                                        ? "-₹${currency.format(c.balanceAmount.abs())}"
                                        : "₹0"),
                                style: TextStyle(
                                  fontSize: 19,
                                  fontWeight: FontWeight.w900,
                                  color: c.balanceAmount > 0
                                      ? const Color(0xFFDC2626)
                                      : (c.balanceAmount < 0
                                          ? const Color(0xFF2563EB)
                                          : const Color(0xFF16A34A)),
                                ),
                              ),
                              Text(
                                c.balanceAmount > 0
                                    ? "Due Balance"
                                    : (c.balanceAmount < 0 ? "Advance Balance" : "No Due (Clear)"),
                                style: TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.bold,
                                  color: c.balanceAmount > 0
                                      ? const Color(0xFFDC2626)
                                      : (c.balanceAmount < 0
                                          ? const Color(0xFF2563EB)
                                          : const Color(0xFF16A34A)),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Divider(height: 1),
                      const SizedBox(height: 10),

                      // Quick Stats and WhatsApp Action
                      Row(
                        children: [
                          Expanded(
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEF2F2),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text("Billed:", style: TextStyle(fontSize: 11, color: Color(0xFF991B1B))),
                                  Text(
                                    "₹${currency.format(sumRecharges)}",
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFFDC2626)),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0FDF4),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text("Paid:", style: TextStyle(fontSize: 11, color: Color(0xFF166534))),
                                  Text(
                                    "₹${currency.format(sumPayments)}",
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF16A34A)),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),

                      // Share Ledger Button
                      SizedBox(
                        width: double.infinity,
                        height: 38,
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.share_rounded, size: 16),
                          label: const Text(
                            "Send Passbook Link to Customer WhatsApp",
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF25D366),
                            foregroundColor: Colors.white,
                            elevation: 0,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          onPressed: _sharePassbookWhatsApp,
                        ),
                      ),
                    ],
                  ),
                ),

                // 3 Tabs
                Container(
                  color: Colors.white,
                  child: TabBar(
                    controller: _tabController,
                    labelColor: AppColors.primary,
                    unselectedLabelColor: AppColors.textMuted,
                    indicatorColor: AppColors.primary,
                    indicatorWeight: 3,
                    labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    tabs: [
                      Tab(text: "Passbook (${passbookList.length})"),
                      Tab(text: "Recharges (${rechargesList.length})"),
                      Tab(text: "Payments (${paymentsList.length})"),
                    ],
                  ),
                ),

                // Tab Views
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildPassbookTab(passbookList),
                      _buildRechargesTab(rechargesList),
                      _buildPaymentsTab(paymentsList),
                    ],
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildPassbookTab(List<_LedgerEntry> entries) {
    if (entries.isEmpty) {
      return const Center(child: Text("No transactions recorded yet."));
    }

    final currency = NumberFormat('#,##,###');
    final dateFormat = DateFormat('dd-MM-yyyy hh:mm a');

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: entries.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, idx) {
        final item = entries[idx];
        final isRecharge = item.type == 'Recharge';

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: isRecharge ? const Color(0xFFFEF2F2) : const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      isRecharge ? Icons.tv_rounded : Icons.check_circle_rounded,
                      color: isRecharge ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.title,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          dateFormat.format(item.date),
                          style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                        ),
                        if (item.subtitle != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            item.subtitle!,
                            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        isRecharge
                            ? "+₹${currency.format(item.amount)}"
                            : "-₹${currency.format(item.amount)}",
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: isRecharge ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: item.runningBalance > 0
                              ? const Color(0xFFFFFBEB)
                              : (item.runningBalance < 0
                                  ? const Color(0xFFEFF6FF)
                                  : const Color(0xFFF8FAFC)),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: item.runningBalance > 0
                                ? const Color(0xFFFDE68A)
                                : (item.runningBalance < 0
                                    ? const Color(0xFFBFDBFE)
                                    : const Color(0xFFE2E8F0)),
                          ),
                        ),
                        child: Text(
                          item.runningBalance > 0
                              ? "Bal: ₹${currency.format(item.runningBalance)}"
                              : (item.runningBalance < 0
                                  ? "Adv: -₹${currency.format(item.runningBalance.abs())}"
                                  : "Bal: ₹0"),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: item.runningBalance > 0
                                ? const Color(0xFFB45309)
                                : (item.runningBalance < 0
                                    ? const Color(0xFF1D4ED8)
                                    : const Color(0xFF64748B)),
                          ),
                        ),
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

  Widget _buildRechargesTab(List<_LedgerEntry> entries) {
    if (entries.isEmpty) {
      return const Center(child: Text("No recharges recorded."));
    }

    final currency = NumberFormat('#,##,###');
    final dateFormat = DateFormat('dd-MM-yyyy hh:mm a');

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: entries.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, idx) {
        final item = entries[idx];
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.tv_rounded, color: Color(0xFFDC2626), size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
                    const SizedBox(height: 2),
                    Text(dateFormat.format(item.date), style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                  ],
                ),
              ),
              Text(
                "+₹${currency.format(item.amount)}",
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFFDC2626),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildPaymentsTab(List<_LedgerEntry> entries) {
    if (entries.isEmpty) {
      return const Center(child: Text("No payments recorded."));
    }

    final currency = NumberFormat('#,##,###');
    final dateFormat = DateFormat('dd-MM-yyyy hh:mm a');

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: entries.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, idx) {
        final item = entries[idx];
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5)),
                    const SizedBox(height: 2),
                    Text(
                      "${dateFormat.format(item.date)}${item.subtitle != null ? ' • ${item.subtitle}' : ''}",
                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              Text(
                "-₹${currency.format(item.amount)}",
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF16A34A),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
