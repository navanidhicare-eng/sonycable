import 'package:cloud_firestore/cloud_firestore.dart';

class Customer {
  final String id;
  final String name;
  final String mobile;
  final String customerId;
  final String? stbId;
  final String? gtplId;
  final String area;
  final double balanceAmount;
  final DateTime? expiryDate;
  final DateTime? lastRechargeDate;
  final String adminId;
  final String? packageName;
  final String? customerType;

  Customer({
    required this.id,
    required this.name,
    required this.mobile,
    required this.customerId,
    this.stbId,
    this.gtplId,
    required this.area,
    required this.balanceAmount,
    this.expiryDate,
    this.lastRechargeDate,
    required this.adminId,
    this.packageName,
    this.customerType,
  });

  factory Customer.fromFirestore(DocumentSnapshot doc) {
    final data = (doc.data() as Map<String, dynamic>?) ?? {};

    DateTime? parseDate(dynamic field) {
      if (field == null) return null;
      if (field is Timestamp) return field.toDate();
      if (field is String) return DateTime.tryParse(field);
      return null;
    }

    double parseDouble(dynamic field) {
      if (field == null) return 0.0;
      if (field is num) return field.toDouble();
      if (field is String) return double.tryParse(field) ?? 0.0;
      return 0.0;
    }

    return Customer(
      id: doc.id,
      name: data['name'] ?? 'Unnamed',
      mobile: data['mobile'] ?? '',
      customerId: data['customerId'] ?? data['stbId'] ?? doc.id,
      stbId: data['stbId'],
      gtplId: data['gtplId'],
      area: data['area'] ?? '',
      balanceAmount: parseDouble(data['balanceAmount']),
      expiryDate: parseDate(data['expiryDate']),
      lastRechargeDate: parseDate(data['lastRechargeDate']),
      adminId: data['adminId'] ?? data['userId'] ?? '',
      packageName: data['packageName']?.toString() ?? data['plan']?.toString(),
      customerType: data['customerType']?.toString() ?? data['connectionType']?.toString(),
    );
  }

  bool get isInternetCustomer {
    final type = (customerType ?? '').toUpperCase();
    final pkg = (packageName ?? '').toLowerCase();
    if (type.contains('INTERNET') || type.contains('BROADBAND') || type.contains('FIBER')) {
      return true;
    }
    if (pkg.contains('internet') || pkg.contains('broadband') || pkg.contains('fiber') || pkg.contains('mbps') || pkg.contains('wifi')) {
      return true;
    }
    return false;
  }

  String get displayId {
    if (customerId.isNotEmpty) return customerId;
    if (stbId != null && stbId!.isNotEmpty) return stbId!;
    return id;
  }
}
