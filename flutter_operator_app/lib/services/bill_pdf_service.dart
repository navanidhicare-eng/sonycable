import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/customer.dart';
import 'whatsapp_service.dart';

class BillPdfService {
  /// Cleans characters that cannot be rendered by standard WinAnsi / Helvetica PDF fonts
  static String sanitizeForPdf(String text) {
    return text
        .replaceAll('•', '-')
        .replaceAll('·', '-')
        .replaceAll('₹', 'Rs. ')
        .replaceAll('✔', '[OK]')
        .replaceAll('📱', '')
        .replaceAll('★', '*')
        .replaceAll('\u2022', '-')
        .replaceAll('\u20B9', 'Rs. ');
  }

  /// Converts a number (e.g. 700) to Indian English words (e.g. "Seven Hundred")
  static String numberToWords(int number) {
    if (number == 0) return 'Zero';
    if (number < 0) return 'Minus ${numberToWords(-number)}';

    final ones = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];

    final tens = [
      '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
    ];

    String convertBelowThousand(int n) {
      if (n == 0) return '';
      if (n < 20) return ones[n];
      if (n < 100) {
        final rem = n % 10;
        return tens[n ~/ 10] + (rem > 0 ? ' ${ones[rem]}' : '');
      }
      final rem = n % 100;
      return '${ones[n ~/ 100]} Hundred${rem > 0 ? ' and ${convertBelowThousand(rem)}' : ''}';
    }

    if (number >= 10000000) {
      final crore = number ~/ 10000000;
      final rem = number % 10000000;
      return '${convertBelowThousand(crore)} Crore ${rem > 0 ? numberToWords(rem) : ''}'.trim();
    }
    if (number >= 100000) {
      final lakh = number ~/ 100000;
      final rem = number % 100000;
      return '${convertBelowThousand(lakh)} Lakh ${rem > 0 ? numberToWords(rem) : ''}'.trim();
    }
    if (number >= 1000) {
      final thousand = number ~/ 1000;
      final rem = number % 1000;
      return '${convertBelowThousand(thousand)} Thousand ${rem > 0 ? numberToWords(rem) : ''}'.trim();
    }

    return convertBelowThousand(number).trim();
  }

  /// Resolves the logged-in operator's business name and helpline
  static Future<Map<String, String>> resolveOperatorBrand({
    String? customBusinessName,
    String? customHelpline,
    String? operatorName,
  }) async {
    String business = (customBusinessName ?? '').trim();
    String helpline = (customHelpline ?? '').trim();

    try {
      final prefs = await SharedPreferences.getInstance();
      if (business.isEmpty) {
        business = prefs.getString('operator_business_name') ?? '';
      }
      if (helpline.isEmpty) {
        helpline = prefs.getString('operator_helpline') ?? prefs.getString('operator_mobile') ?? '';
      }
    } catch (_) {}

    if (business.isEmpty) {
      business = WhatsAppService.businessName.trim();
    }
    if (business.isEmpty) {
      if (operatorName != null && operatorName.isNotEmpty && operatorName.toLowerCase() != 'operator') {
        business = '$operatorName Cable Network';
      } else {
        business = 'Sony Cable Network';
      }
    }

    if (helpline.isEmpty) {
      helpline = WhatsAppService.helpline.trim();
    }
    if (helpline.isEmpty) {
      helpline = '9010737882';
    }

    return {
      'businessName': business,
      'helpline': helpline,
    };
  }

  /// Generates the raw PDF bytes for a monthly payment bill
  static Future<Uint8List> generateMonthlyBillPdf({
    required Customer customer,
    required double amount,
    required DateTime paymentDate,
    required String paymentMethod,
    required String operatorName,
    String? packageName,
    String? customInvoiceNo,
    String? customBusinessName,
    String? customHelpline,
    bool isInternet = false,
  }) async {
    final brand = await resolveOperatorBrand(
      customBusinessName: customBusinessName,
      customHelpline: customHelpline,
      operatorName: operatorName,
    );

    final bName = sanitizeForPdf(brand['businessName']!);
    final helpline = sanitizeForPdf(brand['helpline']!);

    final pdf = pw.Document();

    final billingMonth = DateFormat('MMMM yyyy').format(paymentDate);
    final invoiceDateStr = DateFormat('dd-MM-yyyy').format(paymentDate);
    final paymentDateTimeStr = DateFormat('dd-MM-yyyy hh:mm a').format(paymentDate);

    final invoiceNumber = customInvoiceNo ??
        'INV-${DateFormat('yyyyMM').format(paymentDate)}-${customer.displayId.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '')}';

    final currencyFmt = NumberFormat('#,##,###');
    final formattedAmt = currencyFmt.format(amount.toInt());
    final wordsAmt = numberToWords(amount.toInt());

    final cleanMethod = sanitizeForPdf(paymentMethod);
    final cleanCustName = sanitizeForPdf(customer.name);
    final cleanOpName = sanitizeForPdf(operatorName);
    final cleanArea = sanitizeForPdf(customer.area.isNotEmpty ? customer.area : 'N/A');

    // Service Description & Header Subtitle based on whether it is Cable or Internet
    final String serviceHeaderSubtitle;
    final String serviceDesc;

    if (isInternet) {
      serviceHeaderSubtitle = "High-Speed Fiber Broadband & Internet Services";
      serviceDesc = (packageName != null && packageName.isNotEmpty)
          ? sanitizeForPdf("High-Speed Fiber Broadband Internet ($packageName)")
          : "Monthly High-Speed Fiber Broadband Internet Subscription";
    } else {
      serviceHeaderSubtitle = "Digital Cable TV & Entertainment Services";
      serviceDesc = (packageName != null && packageName.isNotEmpty)
          ? sanitizeForPdf("Digital Cable TV Subscription ($packageName)")
          : "Monthly Digital Cable TV Subscription";
    }

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(36),
        build: (pw.Context ctx) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              // 1. TOP HEADER & BRANDING (Operator-wise)
              pw.Container(
                padding: const pw.EdgeInsets.all(16),
                decoration: pw.BoxDecoration(
                  color: PdfColor.fromInt(0xFF0F172A), // Dark Slate Navy
                  borderRadius: pw.BorderRadius.circular(10),
                ),
                child: pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Expanded(
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Text(
                            bName.toUpperCase(),
                            style: pw.TextStyle(
                              fontSize: 18,
                              fontWeight: pw.FontWeight.bold,
                              color: PdfColors.white,
                              letterSpacing: 0.5,
                            ),
                          ),
                          pw.SizedBox(height: 4),
                          pw.Text(
                            serviceHeaderSubtitle,
                            style: const pw.TextStyle(
                              fontSize: 9.5,
                              color: PdfColor.fromInt(0xFFCBD5E1),
                            ),
                          ),
                          pw.SizedBox(height: 4),
                          pw.Text(
                            "Customer Support / Helpline: +91 $helpline",
                            style: pw.TextStyle(
                              fontSize: 10,
                              fontWeight: pw.FontWeight.bold,
                              color: PdfColor.fromInt(0xFF38BDF8), // Light Blue
                            ),
                          ),
                        ],
                      ),
                    ),
                    pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.end,
                      children: [
                        pw.Container(
                          padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: pw.BoxDecoration(
                            color: PdfColor.fromInt(0xFF10B981), // Emerald Green
                            borderRadius: pw.BorderRadius.circular(4),
                          ),
                          child: pw.Text(
                            "MONTHLY INVOICE",
                            style: pw.TextStyle(
                              fontSize: 10,
                              fontWeight: pw.FontWeight.bold,
                              color: PdfColors.white,
                            ),
                          ),
                        ),
                        pw.SizedBox(height: 6),
                        pw.Text(
                          "Invoice No: $invoiceNumber",
                          style: pw.TextStyle(
                            fontSize: 9,
                            fontWeight: pw.FontWeight.bold,
                            color: PdfColors.white,
                          ),
                        ),
                        pw.Text(
                          "Date: $invoiceDateStr",
                          style: const pw.TextStyle(
                            fontSize: 8.5,
                            color: PdfColor.fromInt(0xFF94A3B8),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              pw.SizedBox(height: 16),

              // 2. BILLED TO & BILL DETAILS CARDS
              pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  // Customer Details Box
                  pw.Expanded(
                    flex: 6,
                    child: pw.Container(
                      padding: const pw.EdgeInsets.all(12),
                      decoration: pw.BoxDecoration(
                        color: PdfColor.fromInt(0xFFF8FAFC),
                        borderRadius: pw.BorderRadius.circular(8),
                        border: pw.Border.all(color: PdfColor.fromInt(0xFFE2E8F0)),
                      ),
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Text(
                            "BILLED TO (SUBSCRIBER / CUSTOMER):",
                            style: pw.TextStyle(
                              fontSize: 8.5,
                              fontWeight: pw.FontWeight.bold,
                              color: PdfColor.fromInt(0xFF475569),
                            ),
                          ),
                          pw.SizedBox(height: 6),
                          pw.Text(
                            cleanCustName,
                            style: pw.TextStyle(
                              fontSize: 13,
                              fontWeight: pw.FontWeight.bold,
                              color: PdfColor.fromInt(0xFF0F172A),
                            ),
                          ),
                          pw.SizedBox(height: 4),
                          _buildPdfMetaRow("Subscriber ID:", customer.displayId),
                          _buildPdfMetaRow("Mobile:", customer.mobile.isNotEmpty ? customer.mobile : 'N/A'),
                          _buildPdfMetaRow("Location / Area:", cleanArea),
                          if (customer.stbId != null && customer.stbId!.isNotEmpty && customer.stbId != '0')
                            _buildPdfMetaRow("STB / Box No:", sanitizeForPdf(customer.stbId!)),
                          if (customer.gtplId != null && customer.gtplId!.isNotEmpty && customer.gtplId != '0')
                            _buildPdfMetaRow("Smartcard VC No:", sanitizeForPdf(customer.gtplId!)),
                        ],
                      ),
                    ),
                  ),

                  pw.SizedBox(width: 12),

                  // Bill Metadata Box (Clean Billing Month & Date)
                  pw.Expanded(
                    flex: 4,
                    child: pw.Container(
                      padding: const pw.EdgeInsets.all(12),
                      decoration: pw.BoxDecoration(
                        color: PdfColor.fromInt(0xFFF8FAFC),
                        borderRadius: pw.BorderRadius.circular(8),
                        border: pw.Border.all(color: PdfColor.fromInt(0xFFE2E8F0)),
                      ),
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Text(
                            "BILLING DETAILS:",
                            style: pw.TextStyle(
                              fontSize: 8.5,
                              fontWeight: pw.FontWeight.bold,
                              color: PdfColor.fromInt(0xFF475569),
                            ),
                          ),
                          pw.SizedBox(height: 6),
                          _buildPdfMetaRow("Billing Month:", billingMonth, isHighlight: true),
                          _buildPdfMetaRow("Billing Date:", invoiceDateStr),
                          _buildPdfMetaRow("Payment Time:", paymentDateTimeStr),
                          _buildPdfMetaRow("Payment Mode:", cleanMethod),
                          _buildPdfMetaRow("Collected By:", cleanOpName),
                        ],
                      ),
                    ),
                  ),
                ],
              ),

              pw.SizedBox(height: 18),

              // 3. TABLE OF CHARGES (No redundant date-to-date)
              pw.Table(
                border: pw.TableBorder.all(color: PdfColor.fromInt(0xFFCBD5E1), width: 0.8),
                columnWidths: {
                  0: const pw.FixedColumnWidth(30), // S.No
                  1: const pw.FlexColumnWidth(5.5), // Particulars
                  2: const pw.FlexColumnWidth(2.5), // Billing Month
                  3: const pw.FlexColumnWidth(2.0), // Amount
                },
                children: [
                  // Table Header
                  pw.TableRow(
                    decoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFF0F172A)),
                    children: [
                      _buildTableCell("#", isHeader: true, align: pw.TextAlign.center),
                      _buildTableCell("Particulars / Service Description", isHeader: true),
                      _buildTableCell("Billing Month", isHeader: true, align: pw.TextAlign.center),
                      _buildTableCell("Amount (INR)", isHeader: true, align: pw.TextAlign.right),
                    ],
                  ),
                  // Table Row 1
                  pw.TableRow(
                    decoration: const pw.BoxDecoration(color: PdfColors.white),
                    children: [
                      _buildTableCell("1", align: pw.TextAlign.center),
                      _buildTableCell(serviceDesc, isBold: true),
                      _buildTableCell(billingMonth, align: pw.TextAlign.center),
                      _buildTableCell("INR $formattedAmt.00", align: pw.TextAlign.right, isBold: true),
                    ],
                  ),
                  // Total Row
                  pw.TableRow(
                    decoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFFF1F5F9)),
                    children: [
                      _buildTableCell("", align: pw.TextAlign.center),
                      _buildTableCell("NET PAYABLE / AMOUNT PAID", isBold: true, isLarge: true),
                      _buildTableCell("PAID IN FULL", align: pw.TextAlign.center, isBold: true),
                      _buildTableCell("INR $formattedAmt.00", align: pw.TextAlign.right, isBold: true, isLarge: true),
                    ],
                  ),
                ],
              ),

              pw.SizedBox(height: 10),

              // Amount in words
              pw.Container(
                padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: pw.BoxDecoration(
                  color: PdfColor.fromInt(0xFFF8FAFC),
                  borderRadius: pw.BorderRadius.circular(6),
                  border: pw.Border.all(color: PdfColor.fromInt(0xFFE2E8F0)),
                ),
                child: pw.Row(
                  children: [
                    pw.Text(
                      "Amount in Words: ",
                      style: pw.TextStyle(
                        fontSize: 9,
                        fontWeight: pw.FontWeight.bold,
                        color: PdfColor.fromInt(0xFF334155),
                      ),
                    ),
                    pw.Expanded(
                      child: pw.Text(
                        "Rupees $wordsAmt Only",
                        style: pw.TextStyle(
                          fontSize: 9,
                          fontStyle: pw.FontStyle.italic,
                          color: PdfColor.fromInt(0xFF0F172A),
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              pw.SizedBox(height: 28),

              // 4. OFFICIAL PAID STAMP & SIGNATURE (Clean ASCII text)
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  // Official Paid Seal / Stamp Box
                  pw.Container(
                    width: 175,
                    padding: const pw.EdgeInsets.all(10),
                    decoration: pw.BoxDecoration(
                      color: PdfColor.fromInt(0xFFECFDF5), // Light Green
                      borderRadius: pw.BorderRadius.circular(8),
                      border: pw.Border.all(color: PdfColor.fromInt(0xFF10B981), width: 1.5),
                    ),
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.center,
                      children: [
                        pw.Text(
                          "RECEIVED WITH THANKS",
                          style: pw.TextStyle(
                            fontSize: 8,
                            fontWeight: pw.FontWeight.bold,
                            color: PdfColor.fromInt(0xFF065F46),
                            letterSpacing: 0.5,
                          ),
                        ),
                        pw.SizedBox(height: 3),
                        pw.Text(
                          "PAID",
                          style: pw.TextStyle(
                            fontSize: 22,
                            fontWeight: pw.FontWeight.bold,
                            color: PdfColor.fromInt(0xFF047857),
                            letterSpacing: 2,
                          ),
                        ),
                        pw.SizedBox(height: 3),
                        pw.Text(
                          "Mode: $cleanMethod | INR $formattedAmt",
                          style: pw.TextStyle(
                            fontSize: 8,
                            fontWeight: pw.FontWeight.bold,
                            color: PdfColor.fromInt(0xFF065F46),
                          ),
                        ),
                        pw.Text(
                          "Date: $invoiceDateStr",
                          style: const pw.TextStyle(
                            fontSize: 7.5,
                            color: PdfColor.fromInt(0xFF059669),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Authorized Signatory (Operator-wise)
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.center,
                    children: [
                      pw.Text(
                        "For $bName",
                        style: pw.TextStyle(
                          fontSize: 10,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColor.fromInt(0xFF0F172A),
                        ),
                      ),
                      pw.SizedBox(height: 38), // Space for physical signature / stamp
                      pw.Container(
                        width: 160,
                        height: 0.8,
                        color: PdfColor.fromInt(0xFF94A3B8),
                      ),
                      pw.SizedBox(height: 4),
                      pw.Text(
                        "Authorized Signatory",
                        style: pw.TextStyle(
                          fontSize: 8.5,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColor.fromInt(0xFF475569),
                        ),
                      ),
                      pw.Text(
                        "Operator: $cleanOpName",
                        style: const pw.TextStyle(
                          fontSize: 7.5,
                          color: PdfColor.fromInt(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              pw.Spacer(),

              // 5. FOOTER NOTES
              pw.Divider(color: PdfColor.fromInt(0xFFE2E8F0), thickness: 0.8),
              pw.SizedBox(height: 4),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(
                    "This is an official computer-generated monthly service invoice.",
                    style: const pw.TextStyle(
                      fontSize: 7.5,
                      color: PdfColor.fromInt(0xFF64748B),
                    ),
                  ),
                  pw.Text(
                    "Helpline: +91 $helpline",
                    style: pw.TextStyle(
                      fontSize: 7.5,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColor.fromInt(0xFF0F172A),
                    ),
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );

    return pdf.save();
  }

  static pw.Widget _buildPdfMetaRow(String label, String value, {bool isHighlight = false}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 2.5),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(
            width: 86,
            child: pw.Text(
              label,
              style: const pw.TextStyle(
                fontSize: 8.5,
                color: PdfColor.fromInt(0xFF64748B),
              ),
            ),
          ),
          pw.Expanded(
            child: pw.Text(
              value,
              style: pw.TextStyle(
                fontSize: 8.5,
                fontWeight: isHighlight ? pw.FontWeight.bold : pw.FontWeight.normal,
                color: isHighlight ? PdfColor.fromInt(0xFF0F172A) : PdfColor.fromInt(0xFF1E293B),
              ),
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _buildTableCell(
    String text, {
    bool isHeader = false,
    bool isBold = false,
    bool isMuted = false,
    bool isLarge = false,
    pw.TextAlign align = pw.TextAlign.left,
  }) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 7),
      child: pw.Text(
        text,
        textAlign: align,
        style: pw.TextStyle(
          fontSize: isLarge ? 10 : (isHeader ? 9 : 8.5),
          fontWeight: isHeader || isBold ? pw.FontWeight.bold : pw.FontWeight.normal,
          color: isHeader
              ? PdfColors.white
              : (isMuted ? PdfColor.fromInt(0xFF64748B) : PdfColor.fromInt(0xFF0F172A)),
        ),
      ),
    );
  }

  /// Generates and immediately opens the system share dialog (WhatsApp, etc.) with the PDF file
  static Future<void> shareMonthlyBillPdf({
    required BuildContext context,
    required Customer customer,
    required double amount,
    required DateTime paymentDate,
    required String paymentMethod,
    required String operatorName,
    String? packageName,
    String? customBusinessName,
    String? customHelpline,
    bool isInternet = false,
  }) async {
    try {
      final pdfBytes = await generateMonthlyBillPdf(
        customer: customer,
        amount: amount,
        paymentDate: paymentDate,
        paymentMethod: paymentMethod,
        operatorName: operatorName,
        packageName: packageName,
        customBusinessName: customBusinessName,
        customHelpline: customHelpline,
        isInternet: isInternet,
      );

      final monthStr = DateFormat('MMM_yyyy').format(paymentDate);
      final filename = '${customer.displayId}_${isInternet ? "Internet" : "Cable"}_Bill_$monthStr.pdf';

      if (kIsWeb) {
        // 1. Download PDF file to browser
        await Printing.sharePdf(
          bytes: pdfBytes,
          filename: filename,
        );

        // 2. Open WhatsApp directly to the customer's chat!
        if (customer.mobile.isNotEmpty) {
          final brand = await resolveOperatorBrand(
            customBusinessName: customBusinessName,
            customHelpline: customHelpline,
            operatorName: operatorName,
          );
          final bName = brand['businessName']!;
          final helpline = brand['helpline']!;
          final monthName = DateFormat('MMMM yyyy').format(paymentDate);
          final currency = NumberFormat('#,##,###');
          final serviceName = isInternet ? "High-Speed Internet" : "Cable TV";

          final msg = '''*$bName - Monthly Bill Receipt*

నమస్కారం *${customer.name}* గారు,
మీ *$serviceName* ($monthName) బిల్లు చెల్లింపు విజయవంతంగా పూర్తయింది.

----------------------------------------
• కస్టమర్ ID: ${customer.displayId}
• బిల్లు నెల: $monthName
• చెల్లించిన మొత్తం: ₹${currency.format(amount.toInt())} (PAID)
• పేమెంట్ విధానం: $paymentMethod
• తేదీ: ${DateFormat('dd-MM-yyyy').format(paymentDate)}
----------------------------------------

ధన్యవాదాలు - *$bName*
హెల్ప్‌లైన్: $helpline''';

          await WhatsAppService.sendWhatsApp(mobile: customer.mobile, message: msg);
        }
      } else {
        // On Android / iOS Native Mobile App:
        // Opens native share sheet where selecting WhatsApp sends the actual PDF file!
        await Printing.sharePdf(
          bytes: pdfBytes,
          filename: filename,
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Error generating bill PDF: $e"),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    }
  }

  /// Opens the print / preview screen for the monthly bill PDF
  static Future<void> printMonthlyBillPdf({
    required BuildContext context,
    required Customer customer,
    required double amount,
    required DateTime paymentDate,
    required String paymentMethod,
    required String operatorName,
    String? packageName,
    String? customBusinessName,
    String? customHelpline,
    bool isInternet = false,
  }) async {
    try {
      final pdfBytes = await generateMonthlyBillPdf(
        customer: customer,
        amount: amount,
        paymentDate: paymentDate,
        paymentMethod: paymentMethod,
        operatorName: operatorName,
        packageName: packageName,
        customBusinessName: customBusinessName,
        customHelpline: customHelpline,
        isInternet: isInternet,
      );

      final monthStr = DateFormat('MMM_yyyy').format(paymentDate);
      await Printing.layoutPdf(
        name: '${customer.displayId}_${isInternet ? "Internet" : "Cable"}_Bill_$monthStr',
        onLayout: (PdfPageFormat format) async => pdfBytes,
      );
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Error previewing bill: $e"),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    }
  }

  /// Interactive Modal: lets operator choose Cable TV vs Internet and share on WhatsApp or Preview
  static Future<void> showBillOptionsModal(
    BuildContext context, {
    required Customer customer,
    required double amount,
    required DateTime paymentDate,
    required String paymentMethod,
    required String operatorName,
    String? packageName,
    String? customBusinessName,
    String? customHelpline,
  }) async {
    final currency = NumberFormat('#,##,###');
    final monthName = DateFormat('MMMM yyyy').format(paymentDate);
    final dateStr = DateFormat('dd-MM-yyyy hh:mm a').format(paymentDate);

    // Initial detection: if package or customerType mentions internet -> true, else false (Cable)
    final bool initialIsInternet = customer.isInternetCustomer ||
        (packageName != null &&
            (packageName.toLowerCase().contains('internet') ||
                packageName.toLowerCase().contains('broadband') ||
                packageName.toLowerCase().contains('fiber') ||
                packageName.toLowerCase().contains('net') ||
                packageName.toLowerCase().contains('mbps')));

    final brand = await resolveOperatorBrand(
      customBusinessName: customBusinessName,
      customHelpline: customHelpline,
      operatorName: operatorName,
    );
    final resolvedBusinessName = brand['businessName']!;

    if (!context.mounted) return;

    return showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      backgroundColor: Colors.white,
      builder: (ctx) {
        bool selectedIsInternet = initialIsInternet;

        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 44,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFFCBD5E1),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Title Header with Business Name
                    Row(
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            color: selectedIsInternet ? const Color(0xFFEFF6FF) : const Color(0xFFFEF2F2),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: selectedIsInternet ? const Color(0xFFBFDBFE) : const Color(0xFFFECACA),
                            ),
                          ),
                          child: Icon(
                            selectedIsInternet ? Icons.wifi_rounded : Icons.tv_rounded,
                            color: selectedIsInternet ? const Color(0xFF2563EB) : const Color(0xFFDC2626),
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                resolvedBusinessName,
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                              Text(
                                "Monthly Bill PDF • $monthName",
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF64748B),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFDCFCE7),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            "PAID ₹${currency.format(amount.toInt())}",
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF16A34A),
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 16),

                    // Service Type Selector Toggle (Cable vs Internet)
                    const Text(
                      "Select Bill Category:",
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF475569),
                      ),
                    ),
                    const SizedBox(height: 8),

                    Row(
                      children: [
                        // Cable TV Option
                        Expanded(
                          child: InkWell(
                            onTap: () {
                              setModalState(() => selectedIsInternet = false);
                            },
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              decoration: BoxDecoration(
                                color: !selectedIsInternet ? const Color(0xFFDC2626) : const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: !selectedIsInternet ? const Color(0xFFDC2626) : const Color(0xFFE2E8F0),
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.tv_rounded,
                                    size: 16,
                                    color: !selectedIsInternet ? Colors.white : const Color(0xFF64748B),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    "Cable TV Bill",
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: !selectedIsInternet ? Colors.white : const Color(0xFF334155),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        // Internet Broadband Option
                        Expanded(
                          child: InkWell(
                            onTap: () {
                              setModalState(() => selectedIsInternet = true);
                            },
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              decoration: BoxDecoration(
                                color: selectedIsInternet ? const Color(0xFF2563EB) : const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: selectedIsInternet ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.wifi_rounded,
                                    size: 16,
                                    color: selectedIsInternet ? Colors.white : const Color(0xFF64748B),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    "Internet / Broadband",
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: selectedIsInternet ? Colors.white : const Color(0xFF334155),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 14),

                    // Info summary card
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        children: [
                          _buildInfoRow("Customer", "${customer.name} (ID: ${customer.displayId})"),
                          const SizedBox(height: 5),
                          _buildInfoRow("Payment Date", dateStr),
                          const SizedBox(height: 5),
                          _buildInfoRow("Payment Mode", paymentMethod),
                          const SizedBox(height: 5),
                          _buildInfoRow("Billing Month", monthName),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // WhatsApp Share Button
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          Navigator.pop(ctx);
                          shareMonthlyBillPdf(
                            context: context,
                            customer: customer,
                            amount: amount,
                            paymentDate: paymentDate,
                            paymentMethod: paymentMethod,
                            operatorName: operatorName,
                            packageName: packageName,
                            customBusinessName: customBusinessName,
                            customHelpline: customHelpline,
                            isInternet: selectedIsInternet,
                          );
                        },
                        icon: const Icon(Icons.share_rounded, size: 20),
                        label: Text(
                          selectedIsInternet
                              ? "Share Internet Bill PDF on WhatsApp"
                              : "Share Cable TV Bill PDF on WhatsApp",
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF25D366),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 1,
                        ),
                      ),
                    ),

                    const SizedBox(height: 10),

                    // Print / Preview Button
                    SizedBox(
                      width: double.infinity,
                      height: 46,
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Navigator.pop(ctx);
                          printMonthlyBillPdf(
                            context: context,
                            customer: customer,
                            amount: amount,
                            paymentDate: paymentDate,
                            paymentMethod: paymentMethod,
                            operatorName: operatorName,
                            packageName: packageName,
                            customBusinessName: customBusinessName,
                            customHelpline: customHelpline,
                            isInternet: selectedIsInternet,
                          );
                        },
                        icon: const Icon(Icons.print_rounded, size: 18, color: Color(0xFF0F172A)),
                        label: const Text(
                          "Print / Preview PDF",
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
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

  static Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        ),
        Text(
          value,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: Color(0xFF0F172A),
          ),
        ),
      ],
    );
  }

  /// Shows a modal listing ONLY payments made by this customer
  /// Tapping any payment lets the operator generate & share the Monthly Bill PDF!
  static Future<void> showCustomerPaymentsBillSelectorModal(
    BuildContext context, {
    required Customer customer,
    required String operatorName,
    String? customBusinessName,
    String? customHelpline,
  }) {
    final currency = NumberFormat('#,##,###');
    final dateFormat = DateFormat('dd-MM-yyyy hh:mm a');

    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      backgroundColor: Colors.white,
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.70,
          minChildSize: 0.45,
          maxChildSize: 0.92,
          expand: false,
          builder: (_, scrollController) {
            return StreamBuilder<QuerySnapshot>(
              stream: FirebaseFirestore.instance
                  .collection('payments')
                  .where('customerId', isEqualTo: customer.id)
                  .snapshots(),
              builder: (context, snapshot) {
                final docs = snapshot.data?.docs ?? [];

                // Parse and sort newest payments first
                final List<Map<String, dynamic>> payments = [];
                for (var d in docs) {
                  final data = d.data() as Map<String, dynamic>;
                  final amt = (data['amount'] is num)
                      ? (data['amount'] as num).toDouble()
                      : (double.tryParse(data['amount']?.toString() ?? '0') ?? 0.0);

                  DateTime date = DateTime.now();
                  if (data['collectionDate'] is Timestamp) {
                    date = (data['collectionDate'] as Timestamp).toDate();
                  } else if (data['collectionDate'] != null) {
                    date = DateTime.tryParse(data['collectionDate'].toString()) ?? DateTime.now();
                  } else if (data['createdAt'] is Timestamp) {
                    date = (data['createdAt'] as Timestamp).toDate();
                  }

                  final method = (data['paymentMethod'] ?? data['method'] ?? 'Cash').toString();
                  final pkg = data['packageName']?.toString();

                  payments.add({
                    'id': d.id,
                    'amount': amt,
                    'date': date,
                    'method': method,
                    'packageName': pkg,
                  });
                }

                payments.sort((a, b) => (b['date'] as DateTime).compareTo(a['date'] as DateTime));

                return Column(
                  children: [
                    // Drag handle
                    const SizedBox(height: 12),
                    Center(
                      child: Container(
                        width: 44,
                        height: 4,
                        decoration: BoxDecoration(
                          color: const Color(0xFFCBD5E1),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Modal Header
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: const Color(0xFFECFDF5),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: const Color(0xFFA7F3D0)),
                            ),
                            child: const Icon(
                              Icons.picture_as_pdf_rounded,
                              color: Color(0xFF059669),
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  "Monthly Bill PDF",
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                Text(
                                  "${customer.name} • ID: ${customer.displayId}",
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF64748B),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
                            onPressed: () => Navigator.pop(ctx),
                          ),
                        ],
                      ),
                    ),

                    const Divider(height: 20, color: Color(0xFFE2E8F0)),

                    // Payments Instruction / Count
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                      child: Row(
                        children: [
                          Text(
                            "Select a payment to generate bill (${payments.length}):",
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF475569),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 6),

                    // Payments List
                    Expanded(
                      child: snapshot.connectionState == ConnectionState.waiting
                          ? const Center(child: CircularProgressIndicator())
                          : (payments.isEmpty
                              ? Center(
                                  child: Padding(
                                    padding: const EdgeInsets.all(32),
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: const [
                                        Icon(Icons.receipt_long_outlined, size: 48, color: Color(0xFF94A3B8)),
                                        SizedBox(height: 12),
                                        Text(
                                          "No payments recorded yet",
                                          style: TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF334155),
                                          ),
                                        ),
                                        SizedBox(height: 4),
                                        Text(
                                          "Collect a due payment first to generate its monthly bill PDF.",
                                          textAlign: TextAlign.center,
                                          style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                                        ),
                                      ],
                                    ),
                                  ),
                                )
                              : ListView.separated(
                                  controller: scrollController,
                                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                                  itemCount: payments.length,
                                  separatorBuilder: (ctx, index) => const SizedBox(height: 10),
                                  itemBuilder: (context, idx) {
                                    final p = payments[idx];
                                    final DateTime pDate = p['date'];
                                    final double pAmt = p['amount'];
                                    final String pMethod = p['method'];
                                    final String monthLabel = DateFormat('MMMM yyyy').format(pDate);

                                    return Material(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(14),
                                      child: InkWell(
                                        onTap: () {
                                          Navigator.pop(ctx);
                                          showBillOptionsModal(
                                            context,
                                            customer: customer,
                                            amount: pAmt,
                                            paymentDate: pDate,
                                            paymentMethod: pMethod,
                                            operatorName: operatorName,
                                            packageName: p['packageName'],
                                            customBusinessName: customBusinessName,
                                            customHelpline: customHelpline,
                                          );
                                        },
                                        borderRadius: BorderRadius.circular(14),
                                        child: Container(
                                          padding: const EdgeInsets.all(14),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFF8FAFC),
                                            borderRadius: BorderRadius.circular(14),
                                            border: Border.all(color: const Color(0xFFE2E8F0)),
                                          ),
                                          child: Row(
                                            children: [
                                              Container(
                                                width: 40,
                                                height: 40,
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFECFDF5),
                                                  borderRadius: BorderRadius.circular(10),
                                                  border: Border.all(color: const Color(0xFFA7F3D0)),
                                                ),
                                                child: const Icon(
                                                  Icons.check_circle_rounded,
                                                  color: Color(0xFF16A34A),
                                                  size: 22,
                                                ),
                                              ),
                                              const SizedBox(width: 12),
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.start,
                                                  children: [
                                                    Text(
                                                      monthLabel,
                                                      style: const TextStyle(
                                                        fontSize: 14,
                                                        fontWeight: FontWeight.bold,
                                                        color: Color(0xFF0F172A),
                                                      ),
                                                    ),
                                                    const SizedBox(height: 3),
                                                    Text(
                                                      "${dateFormat.format(pDate)} • $pMethod",
                                                      style: const TextStyle(
                                                        fontSize: 11,
                                                        color: Color(0xFF64748B),
                                                        fontWeight: FontWeight.w500,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                              Column(
                                                crossAxisAlignment: CrossAxisAlignment.end,
                                                children: [
                                                  Text(
                                                    "₹${currency.format(pAmt.toInt())}",
                                                    style: const TextStyle(
                                                      fontSize: 16,
                                                      fontWeight: FontWeight.w900,
                                                      color: Color(0xFF16A34A),
                                                    ),
                                                  ),
                                                  const SizedBox(height: 4),
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                    decoration: BoxDecoration(
                                                      color: const Color(0xFFEFF6FF),
                                                      borderRadius: BorderRadius.circular(6),
                                                      border: Border.all(color: const Color(0xFFBFDBFE)),
                                                    ),
                                                    child: Row(
                                                      mainAxisSize: MainAxisSize.min,
                                                      children: const [
                                                        Icon(Icons.picture_as_pdf_rounded, size: 11, color: Color(0xFF2563EB)),
                                                        SizedBox(width: 4),
                                                        Text(
                                                          "Bill PDF",
                                                          style: TextStyle(
                                                            fontSize: 10.5,
                                                            fontWeight: FontWeight.bold,
                                                            color: Color(0xFF2563EB),
                                                          ),
                                                        ),
                                                      ],
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
                                )),
                    ),
                  ],
                );
              },
            );
          },
        );
      },
    );
  }
}
