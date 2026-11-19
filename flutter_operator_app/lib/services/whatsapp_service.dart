import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

class WhatsAppService {
  static const String publicBaseUrl = 'https://sony.navanidhi.org';
  static String helpline = '9010737882';
  static String businessName = 'Sony Cable Network';

  static String cleanMobile(String mobile) {
    String cleaned = mobile.replaceAll(RegExp(r'[^0-9]'), '');
    if (cleaned.length == 10) {
      return '91$cleaned';
    }
    if (cleaned.startsWith('0') && cleaned.length == 11) {
      return '91${cleaned.substring(1)}';
    }
    return cleaned;
  }

  static Future<bool> sendWhatsApp({
    required String mobile,
    required String message,
  }) async {
    final phone = cleanMobile(mobile);
    if (phone.isEmpty) return false;

    // Use Uri.https with queryParameters so Dart handles UTF-8 percent-encoding cleanly
    final url = Uri.https('wa.me', '/$phone', {'text': message});

    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  static Future<bool> makeCall(String mobile) async {
    final phone = mobile.replaceAll(RegExp(r'[^0-9+]'), '');
    if (phone.isEmpty) return false;
    final url = Uri.parse('tel:$phone');
    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  // 1. Payment Receipt Notification
  static String getPaymentReceiptMessage({
    required String customerName,
    required String customerId,
    String? customerDocId,
    required String mobile,
    required double totalDue,
    required double amountPaid,
    required double remainingBalance,
    required String paymentMethod,
    required String operatorName,
    String? transactionId,
    String? customBusinessName,
    String? customHelpline,
  }) {
    final bName = (customBusinessName != null && customBusinessName.isNotEmpty) ? customBusinessName : businessName;
    final phone = (customHelpline != null && customHelpline.isNotEmpty) ? customHelpline : helpline;

    final now = DateFormat('dd-MM-yyyy hh:mm a').format(DateTime.now());
    final currency = NumberFormat('#,##,###');

    final formattedRemaining = remainingBalance < 0
        ? '-₹${currency.format(remainingBalance.abs())} (Advance / అడ్వాన్స్)'
        : (remainingBalance == 0
            ? '₹0 (పూర్తిగా చెల్లించబడింది)'
            : '₹${currency.format(remainingBalance)}');

    final docId = (customerDocId != null && customerDocId.isNotEmpty)
        ? customerDocId
        : customerId;
    final ledgerLink = '$publicBaseUrl/passbook?id=$docId';

    return '''*$bName - చెల్లింపు రసీదు*

నమస్కారం *$customerName* గారు,
మీ కేబుల్ టీవీ బిల్లు చెల్లింపు విజయవంతంగా నమోదైంది.

----------------------------------------
• తేదీ & సమయం: $now
• కస్టమర్ ID: $customerId
• మొబైల్: $mobile
• మొత్తం బకాయి (Total Due): ₹${currency.format(totalDue)}
• చెల్లించిన మొత్తం (Paid): ₹${currency.format(amountPaid)}
• మిగిలిన బాకీ (Remaining Due): $formattedRemaining
• చెల్లింపు విధానం: $paymentMethod
• కలెక్షన్ ఆపరేటర్: $operatorName
----------------------------------------

పాస్‌బుక్ లెడ్జర్ లింక్ (Ledger History):
$ledgerLink

ధన్యవాదాలు!
*$bName Support*
హెల్ప్‌లైన్: $phone''';
  }

  // 2. Recharge / Renewal Receipt
  static String getRechargeReceiptMessage({
    required String customerName,
    required String customerId,
    String? customerDocId,
    required String packageName,
    required double packageAmount,
    required int months,
    required DateTime expiryDate,
    double? previousBalance,
    double? newTotalBalance,
    String? paymentMethod,
    required String operatorName,
    String? customBusinessName,
    String? customHelpline,
  }) {
    final bName = (customBusinessName != null && customBusinessName.isNotEmpty) ? customBusinessName : businessName;
    final phone = (customHelpline != null && customHelpline.isNotEmpty) ? customHelpline : helpline;

    final now = DateFormat('dd-MM-yyyy hh:mm a').format(DateTime.now());
    final expStr = DateFormat('dd-MM-yyyy').format(expiryDate);
    final currency = NumberFormat('#,##,###');

    final docId = (customerDocId != null && customerDocId.isNotEmpty)
        ? customerDocId
        : customerId;
    final ledgerLink = '$publicBaseUrl/passbook?id=$docId';

    final prevBal = previousBalance ?? 0.0;
    final totalDue = newTotalBalance ?? (prevBal + packageAmount);

    final formattedPrev = prevBal < 0
        ? '-₹${currency.format(prevBal.abs())} (Advance)'
        : '₹${currency.format(prevBal)}';

    final formattedTotal = totalDue < 0
        ? '-₹${currency.format(totalDue.abs())} (Advance)'
        : (totalDue == 0
            ? '₹0'
            : '₹${currency.format(totalDue)}');

    return '''*$bName - రీఛార్జ్ విజయవంతం*

నమస్కారం *$customerName* గారు,
మీ సెట్-టాప్ బాక్స్ రీఛార్జ్ విజయవంతంగా పూర్తయింది.

----------------------------------------
• తేదీ & సమయం: $now
• కస్టమర్ ID: $customerId
• ప్యాకేజీ: $packageName
• వ్యవధి: $months నెల(లు)
• రీఛార్జ్ మొత్తం (Recharge): ₹${currency.format(packageAmount)}
• పాత బకాయి (Previous Due): $formattedPrev
• మొత్తం బకాయి (Total Due): $formattedTotal
• కొత్త గడువు తేదీ: $expStr
• ఆపరేటర్: $operatorName
----------------------------------------

పాస్‌బుక్ లెడ్జర్ లింక్ (Ledger History):
$ledgerLink

నిరంతరాయ వినోదాన్ని ఆస్వాదించండి!
ధన్యవాదాలు - *$bName*
హెల్ప్‌లైన్: $phone''';
  }

  // 3. Extra Due / Service Charge Receipt
  static String getExtraDueReceiptMessage({
    required String customerName,
    required String customerId,
    String? customerDocId,
    required String reason,
    required double amount,
    required double newTotalBalance,
    required String operatorName,
    String? customBusinessName,
    String? customHelpline,
  }) {
    final bName = (customBusinessName != null && customBusinessName.isNotEmpty) ? customBusinessName : businessName;
    final phone = (customHelpline != null && customHelpline.isNotEmpty) ? customHelpline : helpline;

    final now = DateFormat('dd-MM-yyyy hh:mm a').format(DateTime.now());
    final currency = NumberFormat('#,##,###');

    final docId = (customerDocId != null && customerDocId.isNotEmpty)
        ? customerDocId
        : customerId;
    final ledgerLink = '$publicBaseUrl/passbook?id=$docId';

    return '''*$bName - సర్వీస్ ఛార్జ్ అప్‌డేట్*

నమస్కారం *$customerName* గారు,
మీ ఖాతాకు సర్వీస్ ఛార్జ్ వివరాలు జోడించబడ్డాయి.

----------------------------------------
• తేదీ & సమయం: $now
• కస్టమర్ ID: $customerId
• సర్వీస్ రకం: $reason
• సర్వీస్ ఛార్జ్: ₹${currency.format(amount)}
• మొత్తం బకాయి: ₹${currency.format(newTotalBalance)}
• టెక్నీషియన్/ఆపరేటర్: $operatorName
----------------------------------------

పాస్‌బుక్ లెడ్జర్ లింక్ (Ledger History):
$ledgerLink

ధన్యవాదాలు!
*$bName*
హెల్ప్‌లైన్: $phone''';
  }

  static String formatComplaintId(String rawId, {String? customerId}) {
    if (rawId.startsWith('CMP-')) return rawId;
    if (rawId.length > 10 && !rawId.contains('-')) {
      final cust = (customerId != null && customerId.isNotEmpty)
          ? customerId.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '')
          : '';
      if (cust.isNotEmpty) {
        return "CMP-$cust-${DateFormat('ddMM').format(DateTime.now())}";
      }
      return "CMP-${rawId.substring(rawId.length - 6).toUpperCase()}";
    }
    return rawId.startsWith('CMP') ? rawId : "CMP-$rawId";
  }

  // 4. Complaint Registration Notification
  static String getComplaintRegisteredMessage({
    required String customerName,
    required String customerId,
    required String complaintText,
    required String complaintId,
    String? customBusinessName,
    String? customHelpline,
  }) {
    final bName = (customBusinessName != null && customBusinessName.isNotEmpty) ? customBusinessName : businessName;
    final phone = (customHelpline != null && customHelpline.isNotEmpty) ? customHelpline : helpline;

    final now = DateFormat('dd-MM-yyyy hh:mm a').format(DateTime.now());
    final formattedComplaintId = formatComplaintId(complaintId, customerId: customerId);

    return '''*$bName - ఫిర్యాదు నమోదు*

నమస్కారం *$customerName* గారు,
మీ సమస్య విజయవంతంగా నమోదైంది.

----------------------------------------
• తేదీ & సమయం: $now
• కస్టమర్ ID: $customerId
• కంప్లైంట్ ID: $formattedComplaintId
• సమస్య: $complaintText
• స్టేటస్: పెండింగ్ (త్వరలో పరిష్కరించబడును)
----------------------------------------

మా టెక్నీషియన్ త్వరలోనే మీ వద్దకు వచ్చి సమస్యను పరిష్కరిస్తారు.
ధన్యవాదాలు - *$bName*
హెల్ప్‌లైన్: $phone''';
  }

  // 5. Expiry Reminder
  static String getReminderMessage({
    required String customerName,
    required String customerId,
    String? customerDocId,
    required DateTime? expiryDate,
    required double balanceAmount,
    String? customBusinessName,
    String? customHelpline,
  }) {
    final bName = (customBusinessName != null && customBusinessName.isNotEmpty) ? customBusinessName : businessName;
    final phone = (customHelpline != null && customHelpline.isNotEmpty) ? customHelpline : helpline;

    final currency = NumberFormat('#,##,###');
    String expNotice = '';
    if (expiryDate != null) {
      final now = DateTime.now();
      final diff = expiryDate.difference(now).inDays;
      final expStr = DateFormat('dd-MM-yyyy').format(expiryDate);
      if (diff < 0) {
        expNotice = '• గడువు స్థితి: గడువు ముగిసింది ($expStr)';
      } else if (diff == 0) {
        expNotice = '• గడువు స్థితి: ఈరోజే గడువు ముగుస్తుంది ($expStr)';
      } else {
        expNotice = '• గడువు స్థితి: $diff రోజుల్లో గడువు ముగుస్తుంది ($expStr)';
      }
    } else {
      expNotice = '• రీఛార్జ్ బకాయి ఉంది';
    }

    final docId = (customerDocId != null && customerDocId.isNotEmpty)
        ? customerDocId
        : customerId;
    final ledgerLink = '$publicBaseUrl/passbook?id=$docId';

    return '''*$bName - రీఛార్జ్ రిమైండర్*

నమస్కారం *$customerName* గారు,
మీ సెట్-టాప్ బాక్స్ వివరాలు:

----------------------------------------
• కస్టమర్ ID: $customerId
$expNotice
${balanceAmount > 0 ? '• బకాయి మొత్తం: ₹${currency.format(balanceAmount)}\n' : ''}----------------------------------------

పాస్‌బుక్ లెడ్జర్ లింక్ (Ledger History):
$ledgerLink

టీవీ ప్రసారాలకు అంతరాయం కలగకుండా రీఛార్జ్ చేసుకోగలరు.
ధన్యవాదాలు - *$bName*
హెల్ప్‌లైన్: $phone''';
  }
}
