import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class SmsService {
  static const MethodChannel _channel = MethodChannel('com.sonycable.operator/sms');

  static String _cleanPhone(String phone) {
    return phone.replaceAll(RegExp(r'[^0-9]'), '');
  }

  static String _formatDue(double due) {
    if (due < 0) {
      return "-${(-due).toInt()} (Adv)";
    } else if (due == 0) {
      return "0";
    }
    return due.toInt().toString();
  }

  /// 1. Short Recharge SMS (English, <120 chars, fits 1 SMS)
  static String getRechargeSms({
    required String customerId,
    required String customerName,
    required double totalDue,
  }) {
    final dueStr = _formatDue(totalDue);
    return "Sony Cable: Recharge Successful! ID: $customerId, Name: $customerName, Total Due: Rs.$dueStr. Sony Cable Network.";
  }

  /// 2. Short Payment Received (Collection) SMS (English, <130 chars, fits 1 SMS)
  static String getPaymentSms({
    required String customerId,
    required String customerName,
    required double paidAmount,
    required double remainingDue,
  }) {
    final paidStr = paidAmount.toInt().toString();
    final dueStr = _formatDue(remainingDue);
    return "Sony Cable: Payment Received! ID: $customerId, Name: $customerName, Paid: Rs.$paidStr, Remaining Due: Rs.$dueStr. Thank You - Sony Cable.";
  }

  /// 3. Short Extra Due SMS (English, <130 chars, fits 1 SMS)
  static String getExtraDueSms({
    required String customerId,
    required String customerName,
    required double amount,
    required double totalDue,
  }) {
    final amtStr = amount.toInt().toString();
    final dueStr = _formatDue(totalDue);
    return "Sony Cable: Service Charge Added. ID: $customerId, Name: $customerName, Amount: Rs.$amtStr, Total Due: Rs.$dueStr. Sony Cable Network.";
  }

  /// Send direct background SMS using phone's SIM card without prompt
  static Future<bool> sendDirectSms({
    required String mobile,
    required String message,
  }) async {
    if (kIsWeb) {
      debugPrint("[SmsService] Web platform detected; direct SIM SMS is available on Android mobile.");
      return false;
    }

    final clean = _cleanPhone(mobile);
    if (clean.length < 10) {
      debugPrint("[SmsService] Invalid phone number: $mobile");
      return false;
    }

    try {
      final bool? result = await _channel.invokeMethod<bool>('sendDirectSms', {
        'phoneNumber': clean,
        'message': message,
      });
      debugPrint("[SmsService] SMS sent to $clean: $result");
      return result ?? false;
    } catch (e) {
      debugPrint("[SmsService] Error sending SMS: $e");
      return false;
    }
  }

  /// Check whether SMS permission is granted
  static Future<bool> checkPermission() async {
    if (kIsWeb) return false;
    try {
      final bool? granted = await _channel.invokeMethod<bool>('checkSmsPermission');
      return granted ?? false;
    } catch (e) {
      debugPrint("[SmsService] Error checking SMS permission: $e");
      return false;
    }
  }

  /// Request SMS permission from user
  static Future<bool> requestPermission() async {
    if (kIsWeb) return false;
    try {
      final bool? granted = await _channel.invokeMethod<bool>('requestSmsPermission');
      return granted ?? false;
    } catch (e) {
      debugPrint("[SmsService] Error requesting SMS permission: $e");
      return false;
    }
  }
}

