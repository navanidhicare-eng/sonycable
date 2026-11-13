import 'package:cloud_firestore/cloud_firestore.dart';

class OperatorModel {
  final String id;
  final String uid;
  final String name;
  final String email;
  final String mobile;
  final String role;
  final String adminId;
  final List<String> areas;
  final String status;

  OperatorModel({
    required this.id,
    required this.uid,
    required this.name,
    required this.email,
    required this.mobile,
    required this.role,
    required this.adminId,
    required this.areas,
    required this.status,
  });

  factory OperatorModel.fromFirestore(DocumentSnapshot doc) {
    final data = (doc.data() as Map<String, dynamic>?) ?? {};
    return OperatorModel(
      id: doc.id,
      uid: data['uid'] ?? '',
      name: data['name'] ?? '',
      email: data['email'] ?? '',
      mobile: data['mobile'] ?? '',
      role: data['role'] ?? 'Cable Operator',
      adminId: data['adminId'] ?? data['userId'] ?? '',
      areas: (data['area'] is List)
          ? List<String>.from(data['area'])
          : [],
      status: data['status'] ?? 'active',
    );
  }
}

class CablePackage {
  final String id;
  final String name;
  final double price; // Customer Retail Price
  final double msoAmount; // MSO Wholesale Cost (Operator Expense)
  final int durationDays;
  final double? threeMonthPrice;
  final double? sixMonthPrice;
  final double? twelveMonthPrice;
  final String? type;

  CablePackage({
    required this.id,
    required this.name,
    required this.price,
    this.msoAmount = 0.0,
    this.durationDays = 30,
    this.threeMonthPrice,
    this.sixMonthPrice,
    this.twelveMonthPrice,
    this.type,
  });

  /// Effective MSO cost: if set, use it; otherwise fallback to 70% of price
  double get effectiveMsoAmount {
    if (msoAmount > 0) return msoAmount;
    return (price * 0.70).roundToDouble();
  }

  /// Expected profit per recharge
  double get profitMargin => price - effectiveMsoAmount;

  factory CablePackage.fromFirestore(DocumentSnapshot doc) {
    final data = (doc.data() as Map<String, dynamic>?) ?? {};

    double parseDouble(dynamic val) {
      if (val == null) return 0.0;
      if (val is num) return val.toDouble();
      if (val is String) return double.tryParse(val) ?? 0.0;
      return 0.0;
    }

    // Support Next.js/Firestore fields ('packageName', 'packageAmount') and Flutter legacy ('name', 'price')
    final name = (data['packageName'] ?? data['name'] ?? 'Standard Package').toString();
    final price = parseDouble(data['packageAmount'] ?? data['price'] ?? data['amount']);
    final mso = parseDouble(data['msoAmount'] ?? data['msoCost'] ?? data['operatorCost']);
    final p3 = parseDouble(data['threeMonthAmount']);
    final p6 = parseDouble(data['sixMonthAmount']);
    final p12 = parseDouble(data['twelveMonthAmount']);

    return CablePackage(
      id: doc.id,
      name: name,
      price: price > 0 ? price : 250.0,
      msoAmount: mso,
      durationDays: data['durationDays'] is int ? data['durationDays'] : 30,
      threeMonthPrice: p3 > 0 ? p3 : null,
      sixMonthPrice: p6 > 0 ? p6 : null,
      twelveMonthPrice: p12 > 0 ? p12 : null,
      type: data['type']?.toString(),
    );
  }
}

class RechargeRecord {
  final String id;
  final String customerId;
  final String customerName;
  final String packageName;
  final String packageId;
  final double amount; // Billed to Customer
  final double msoCost; // Expense paid to MSO
  final double profit; // Customer amount - MSO Cost
  final int months;
  final DateTime rechargeDate;
  final String rechargedBy;
  final String adminId;

  RechargeRecord({
    required this.id,
    required this.customerId,
    required this.customerName,
    required this.packageName,
    required this.packageId,
    required this.amount,
    required this.msoCost,
    required this.profit,
    required this.months,
    required this.rechargeDate,
    required this.rechargedBy,
    required this.adminId,
  });

  factory RechargeRecord.fromFirestore(DocumentSnapshot doc, {Map<String, CablePackage>? packageMap}) {
    final data = (doc.data() as Map<String, dynamic>?) ?? {};

    double parseDouble(dynamic val) {
      if (val == null) return 0.0;
      if (val is num) return val.toDouble();
      if (val is String) return double.tryParse(val) ?? 0.0;
      return 0.0;
    }

    DateTime parseDate(dynamic val) {
      if (val is Timestamp) return val.toDate();
      if (val is String) return DateTime.tryParse(val) ?? DateTime.now();
      return DateTime.now();
    }

    final amount = parseDouble(data['amount']);
    final packageId = data['packageId']?.toString() ?? '';
    final months = (data['months'] is int) ? (data['months'] as int) : 1;

    // Determine MSO cost:
    // 1. Explicitly recorded in transaction (best)
    // 2. Or from package definition
    // 3. Or fallback to 70% of amount
    double mso = parseDouble(data['msoCost'] ?? data['msoAmount']);
    if (mso <= 0 && packageMap != null && packageMap.containsKey(packageId)) {
      mso = packageMap[packageId]!.effectiveMsoAmount * months;
    }
    if (mso <= 0) {
      mso = (amount * 0.70).roundToDouble();
    }

    return RechargeRecord(
      id: doc.id,
      customerId: data['customerId']?.toString() ?? '',
      customerName: data['customerName']?.toString() ?? 'Customer',
      packageName: data['packageName']?.toString() ?? 'Standard Pack',
      packageId: packageId,
      amount: amount,
      msoCost: mso,
      profit: amount - mso,
      months: months,
      rechargeDate: parseDate(data['rechargeDate'] ?? data['createdAt']),
      rechargedBy: data['rechargedBy']?.toString() ?? '',
      adminId: data['adminId']?.toString() ?? '',
    );
  }
}

class ComplaintModel {
  final String id;
  final String customerId;
  final String customerName;
  final String customerMobile;
  final String? customerAddress;
  final String complaintText;
  final String status;
  final DateTime createdAt;
  final String adminId;

  ComplaintModel({
    required this.id,
    required this.customerId,
    required this.customerName,
    required this.customerMobile,
    this.customerAddress,
    required this.complaintText,
    required this.status,
    required this.createdAt,
    required this.adminId,
  });

  factory ComplaintModel.fromFirestore(DocumentSnapshot doc) {
    final data = (doc.data() as Map<String, dynamic>?) ?? {};
    DateTime parseDate(dynamic val) {
      if (val is Timestamp) return val.toDate();
      if (val is String) return DateTime.tryParse(val) ?? DateTime.now();
      return DateTime.now();
    }
    return ComplaintModel(
      id: doc.id,
      customerId: data['customerId'] ?? '',
      customerName: data['customerName'] ?? 'Customer',
      customerMobile: data['customerMobile'] ?? data['mobile'] ?? '',
      customerAddress: data['customerAddress'] ?? data['address'] ?? data['area'],
      complaintText: data['complaint'] ?? data['complaintText'] ?? data['issue'] ?? '',
      status: data['status'] ?? 'Pending',
      createdAt: parseDate(data['createdAt']),
      adminId: data['adminId'] ?? data['userId'] ?? '',
    );
  }
}

class PaymentModel {
  final String id;
  final String customerId;
  final String customerName;
  final double amount;
  final String method;
  final String collectedBy;
  final DateTime collectionDate;
  final String adminId;

  PaymentModel({
    required this.id,
    required this.customerId,
    required this.customerName,
    required this.amount,
    required this.method,
    required this.collectedBy,
    required this.collectionDate,
    required this.adminId,
  });

  factory PaymentModel.fromFirestore(DocumentSnapshot doc) {
    final data = (doc.data() as Map<String, dynamic>?) ?? {};
    double parseDouble(dynamic val) {
      if (val == null) return 0.0;
      if (val is num) return val.toDouble();
      if (val is String) return double.tryParse(val) ?? 0.0;
      return 0.0;
    }
    DateTime parseDate(dynamic val) {
      if (val is Timestamp) return val.toDate();
      if (val is String) return DateTime.tryParse(val) ?? DateTime.now();
      return DateTime.now();
    }
    return PaymentModel(
      id: doc.id,
      customerId: data['customerId'] ?? '',
      customerName: data['customerName'] ?? '',
      amount: parseDouble(data['amount']),
      method: data['method'] ?? 'Cash',
      collectedBy: data['collectedBy'] ?? '',
      collectionDate: parseDate(data['collectionDate']),
      adminId: data['adminId'] ?? '',
    );
  }
}
