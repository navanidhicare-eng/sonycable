import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../models/customer.dart';
import '../theme/app_theme.dart';

class ReportsScreen extends StatefulWidget {
  final String operatorName;
  final String operatorUid;

  const ReportsScreen({
    super.key,
    required this.operatorName,
    required this.operatorUid,
  });

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  String _searchQuery = "";
  String _selectedArea = "All Lines";
  bool _isGeneratingPdf = false;

  bool _hasValidStbOrVc(Customer c) {
    final stb = (c.stbId ?? "").trim();
    final vc = (c.gtplId ?? "").trim();

    final hasStb = stb.isNotEmpty && stb != '0' && stb.toLowerCase() != 'null';
    final hasVc = vc.isNotEmpty && vc != '0' && vc.toLowerCase() != 'null';

    return hasStb || hasVc;
  }

  Future<void> _generateAndSharePdf(List<Customer> customers) async {
    if (customers.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("No customers with STB or VC numbers found to export!"),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    setState(() => _isGeneratingPdf = true);

    try {
      final pdf = pw.Document();
      final nowFormatted = DateFormat('dd-MM-yyyy hh:mm a').format(DateTime.now());

      // Chunk customers into pages of 24 per page for optimal table layout
      final int totalCount = customers.length;

      pdf.addPage(
        pw.MultiPage(
          pageFormat: PdfPageFormat.a4.landscape,
          margin: const pw.EdgeInsets.all(24),
          header: (pw.Context context) {
            return pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(
                          "SONY CABLE NETWORK",
                          style: pw.TextStyle(
                            fontSize: 18,
                            fontWeight: pw.FontWeight.bold,
                            color: PdfColors.orange900,
                          ),
                        ),
                        pw.SizedBox(height: 2),
                        pw.Text(
                          "Customer STB ID & VC Number Master Report",
                          style: pw.TextStyle(
                            fontSize: 12,
                            fontWeight: pw.FontWeight.bold,
                            color: PdfColors.grey800,
                          ),
                        ),
                      ],
                    ),
                    pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.end,
                      children: [
                        pw.Text(
                          "Date: $nowFormatted",
                          style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700),
                        ),
                        pw.Text(
                          "Filter: $_selectedArea | Total: $totalCount Customers",
                          style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColors.grey800),
                        ),
                        pw.Text(
                          "Operator: ${widget.operatorName}",
                          style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700),
                        ),
                      ],
                    ),
                  ],
                ),
                pw.SizedBox(height: 6),
                pw.Divider(thickness: 1, color: PdfColors.orange800),
                pw.SizedBox(height: 8),
              ],
            );
          },
          footer: (pw.Context context) {
            return pw.Container(
              alignment: pw.Alignment.centerRight,
              margin: const pw.EdgeInsets.only(top: 10),
              child: pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(
                    "Sony Cable Network • Confidential Operator Record",
                    style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
                  ),
                  pw.Text(
                    "Page ${context.pageNumber} of ${context.pagesCount}",
                    style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
                  ),
                ],
              ),
            );
          },
          build: (pw.Context context) {
            return [
              pw.TableHelper.fromTextArray(
                headers: [
                  '#',
                  'Customer Name',
                  'Cust ID',
                  'Mobile',
                  'Area / Line',
                  'STB ID (Box Number)',
                  'STB VC Number (Smartcard)',
                ],
                data: List.generate(customers.length, (index) {
                  final c = customers[index];
                  final stb = (c.stbId ?? '').trim();
                  final vc = (c.gtplId ?? '').trim();

                  return [
                    '${index + 1}',
                    c.name,
                    c.displayId,
                    c.mobile.isNotEmpty ? c.mobile : '-',
                    c.area.isNotEmpty ? c.area : '-',
                    (stb.isNotEmpty && stb != '0') ? stb : '-',
                    (vc.isNotEmpty && vc != '0') ? vc : '-',
                  ];
                }),
                border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.5),
                headerStyle: pw.TextStyle(
                  fontSize: 9.5,
                  fontWeight: pw.FontWeight.bold,
                  color: PdfColors.white,
                ),
                headerDecoration: const pw.BoxDecoration(
                  color: PdfColors.orange800,
                ),
                cellStyle: const pw.TextStyle(
                  fontSize: 8.5,
                  color: PdfColors.black,
                ),
                cellAlignment: pw.Alignment.centerLeft,
                cellPadding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
                rowDecoration: const pw.BoxDecoration(color: PdfColors.white),
                oddRowDecoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFFF9FAFB)),
                columnWidths: {
                  0: const pw.FixedColumnWidth(26), // S.No
                  1: const pw.FlexColumnWidth(2.5), // Name
                  2: const pw.FixedColumnWidth(60), // Cust ID
                  3: const pw.FixedColumnWidth(75), // Mobile
                  4: const pw.FlexColumnWidth(1.6), // Area
                  5: const pw.FlexColumnWidth(2.4), // STB ID
                  6: const pw.FlexColumnWidth(2.4), // VC Number
                },
              ),
            ];
          },
        ),
      );

      final pdfBytes = await pdf.save();

      await Printing.sharePdf(
        bytes: pdfBytes,
        filename: 'SonyCable_STB_VC_Report_${DateFormat('ddMMyyyy').format(DateTime.now())}.pdf',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Error generating PDF: $e"), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _isGeneratingPdf = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
          "Customer Reports",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.textPrimary),
        ),
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance.collection('customers').snapshots(),
        builder: (context, snapshot) {
          final allCustomers = snapshot.hasData
              ? snapshot.data!.docs.map((d) => Customer.fromFirestore(d)).toList()
              : <Customer>[];

          // 1. FILTER ONLY CUSTOMERS WITH STB OR VC NUMBER
          final validBoxCustomers = allCustomers.where(_hasValidStbOrVc).toList();

          // Extract all lines that have valid boxes
          final Set<String> areaSet = {"All Lines"};
          for (var c in validBoxCustomers) {
            if (c.area.trim().isNotEmpty) {
              areaSet.add(c.area.trim());
            }
          }
          final areaList = areaSet.toList()..sort();

          // 2. Filter by Search & Selected Line
          final filtered = validBoxCustomers.where((c) {
            final matchesArea = _selectedArea == "All Lines" || c.area.trim() == _selectedArea;
            final q = _searchQuery.toLowerCase();
            final matchesSearch = q.isEmpty ||
                c.name.toLowerCase().contains(q) ||
                c.customerId.toLowerCase().contains(q) ||
                (c.stbId != null && c.stbId!.toLowerCase().contains(q)) ||
                (c.gtplId != null && c.gtplId!.toLowerCase().contains(q)) ||
                c.mobile.contains(q) ||
                c.area.toLowerCase().contains(q);

            return matchesArea && matchesSearch;
          }).toList();

          // 3. Sort Alphabetically A-Z by Customer Name
          filtered.sort((a, b) => a.name.trim().toLowerCase().compareTo(b.name.trim().toLowerCase()));

          // Statistics
          final stbCount = filtered.where((c) => (c.stbId ?? '').trim().isNotEmpty && (c.stbId ?? '').trim() != '0').length;
          final vcCount = filtered.where((c) => (c.gtplId ?? '').trim().isNotEmpty && (c.gtplId ?? '').trim() != '0').length;

          return Column(
            children: [
              // Header Filter & Search Card
              Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
                child: Column(
                  children: [
                    // Search Bar
                    TextField(
                      style: const TextStyle(color: AppColors.textPrimary),
                      decoration: InputDecoration(
                        hintText: "Search Name, STB ID, VC Number, Area...",
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
                    const SizedBox(height: 10),

                    // Area Filter Chips
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: areaList.map((area) {
                          final isSel = _selectedArea == area;
                          return Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ChoiceChip(
                              label: Text(area),
                              selected: isSel,
                              selectedColor: AppColors.primary,
                              backgroundColor: AppColors.surfaceSecondary,
                              side: BorderSide(
                                color: isSel ? AppColors.primary : AppColors.border,
                              ),
                              labelStyle: TextStyle(
                                color: isSel ? Colors.white : AppColors.textSecondary,
                                fontWeight: FontWeight.bold,
                                fontSize: 11,
                              ),
                              onSelected: (_) => setState(() => _selectedArea = area),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                  ],
                ),
              ),

              // KPI Stats Ribbon
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                color: const Color(0xFFFFFBEB),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.verified_rounded, size: 16, color: Color(0xFFD97706)),
                        const SizedBox(width: 6),
                        Text(
                          "${filtered.length} Assigned Boxes",
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF92400E)),
                        ),
                      ],
                    ),
                    Text(
                      "$stbCount STBs • $vcCount VCs",
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFFB45309)),
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
                            const Icon(Icons.tv_off_rounded, size: 54, color: AppColors.textMuted),
                            const SizedBox(height: 12),
                            const Text(
                              "No customers with STB or VC numbers found",
                              style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _selectedArea == "All Lines" ? "None of the customers have STB or VC assigned" : "No box customers in $_selectedArea",
                              style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final c = filtered[index];
                          final stb = (c.stbId ?? '').trim();
                          final vc = (c.gtplId ?? '').trim();
                          final hasStb = stb.isNotEmpty && stb != '0';
                          final hasVc = vc.isNotEmpty && vc != '0';

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
                                Row(
                                  children: [
                                    CircleAvatar(
                                      radius: 18,
                                      backgroundColor: AppColors.primaryBg,
                                      child: Text(
                                        c.name.isNotEmpty ? c.name[0].toUpperCase() : 'C',
                                        style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 14),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            c.name,
                                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            "ID: ${c.displayId} • ${c.mobile} ${c.area.isNotEmpty ? '• ${c.area}' : ''}",
                                            style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Text(
                                      "#${index + 1}",
                                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),

                                // STB & VC Row
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: AppColors.surfaceSecondary,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Column(
                                    children: [
                                      Row(
                                        children: [
                                          const Icon(Icons.live_tv_rounded, size: 14, color: AppColors.primary),
                                          const SizedBox(width: 6),
                                          const Text(
                                            "STB ID: ",
                                            style: TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.bold),
                                          ),
                                          Expanded(
                                            child: Text(
                                              hasStb ? stb : "Not Assigned",
                                              style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.bold,
                                                color: hasStb ? AppColors.textPrimary : AppColors.textMuted,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Row(
                                        children: [
                                          const Icon(Icons.sim_card_outlined, size: 14, color: Color(0xFF059669)),
                                          const SizedBox(width: 6),
                                          const Text(
                                            "VC NO: ",
                                            style: TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.bold),
                                          ),
                                          Expanded(
                                            child: Text(
                                              hasVc ? vc : "Not Assigned",
                                              style: TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.bold,
                                                color: hasVc ? AppColors.textPrimary : AppColors.textMuted,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
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
      bottomNavigationBar: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance.collection('customers').snapshots(),
        builder: (context, snapshot) {
          final allCustomers = snapshot.hasData
              ? snapshot.data!.docs.map((d) => Customer.fromFirestore(d)).toList()
              : <Customer>[];

          final validCustomers = allCustomers.where(_hasValidStbOrVc).where((c) {
            final matchesArea = _selectedArea == "All Lines" || c.area.trim() == _selectedArea;
            final q = _searchQuery.toLowerCase();
            return matchesArea && (q.isEmpty || c.name.toLowerCase().contains(q) || (c.stbId ?? '').contains(q) || (c.gtplId ?? '').contains(q));
          }).toList();

          validCustomers.sort((a, b) => a.name.trim().toLowerCase().compareTo(b.name.trim().toLowerCase()));

          return Container(
            padding: const EdgeInsets.all(14),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                icon: _isGeneratingPdf
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.picture_as_pdf_rounded, size: 20),
                label: Text(
                  _isGeneratingPdf ? "Generating PDF..." : "Export & Share PDF Report (${validCustomers.length})",
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: _isGeneratingPdf ? null : () => _generateAndSharePdf(validCustomers),
              ),
            ),
          );
        },
      ),
    );
  }
}
