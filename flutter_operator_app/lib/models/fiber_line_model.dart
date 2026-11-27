import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

class FiberColorCode {
  static const List<Map<String, dynamic>> colors = [
    {'name': 'Blue', 'color': Color(0xFF2563EB), 'label': 'Blue'},
    {'name': 'Orange', 'color': Color(0xFFF97316), 'label': 'Orange'},
    {'name': 'Green', 'color': Color(0xFF16A34A), 'label': 'Green'},
    {'name': 'Brown', 'color': Color(0xFF8B5A2B), 'label': 'Brown'},
    {'name': 'Slate', 'color': Color(0xFF64748B), 'label': 'Slate/Grey'},
    {'name': 'White', 'color': Color(0xFFF1F5F9), 'label': 'White'},
    {'name': 'Red', 'color': Color(0xFFDC2626), 'label': 'Red'},
    {'name': 'Black', 'color': Color(0xFF1E293B), 'label': 'Black'},
    {'name': 'Yellow', 'color': Color(0xFFEAB308), 'label': 'Yellow'},
    {'name': 'Violet', 'color': Color(0xFF7C3AED), 'label': 'Violet'},
    {'name': 'Rose', 'color': Color(0xFFEC4899), 'label': 'Pink/Rose'},
    {'name': 'Aqua', 'color': Color(0xFF06B6D4), 'label': 'Aqua'},
  ];

  static Color getColor(String? name) {
    if (name == null) return Colors.grey;
    final found = colors.firstWhere(
      (c) => (c['name'] as String).toLowerCase() == name.toLowerCase(),
      orElse: () => {'color': Colors.grey},
    );
    return found['color'] as Color;
  }

  static String getDefaultCouplerColor(int portIndex) {
    if (portIndex >= 1 && portIndex <= colors.length) {
      return colors[portIndex - 1]['name'] as String;
    }
    return 'Blue';
  }
}

class FiberPortMapping {
  final int portIndex; // 1-based (1, 2, 3...)
  final String status; // 'empty', 'customer', 'subbox', 'reserved'
  final String? customerId;
  final String? customerName;
  final String? customerPhone;
  final String? customerStbId;
  final double? opticalPower; // dBm reading
  final String? subBoxId;
  final String? subBoxName;
  final String? notes;
  final String? couplerColor; // Splitter leg color (e.g. 'Blue', 'Orange')
  final String? fiberCoreColor; // Jointed cable core color (e.g. 'Orange', 'Blue')
  final String? cableTag; // Optional cable name/core tag (e.g. '4F Cable', '2F Drop')

  FiberPortMapping({
    required this.portIndex,
    this.status = 'empty',
    this.customerId,
    this.customerName,
    this.customerPhone,
    this.customerStbId,
    this.opticalPower,
    this.subBoxId,
    this.subBoxName,
    this.notes,
    this.couplerColor,
    this.fiberCoreColor,
    this.cableTag,
  });

  Map<String, dynamic> toMap() {
    return {
      'portIndex': portIndex,
      'status': status,
      'customerId': customerId,
      'customerName': customerName,
      'customerPhone': customerPhone,
      'customerStbId': customerStbId,
      'opticalPower': opticalPower,
      'subBoxId': subBoxId,
      'subBoxName': subBoxName,
      'notes': notes,
      'couplerColor': couplerColor,
      'fiberCoreColor': fiberCoreColor,
      'cableTag': cableTag,
    };
  }

  factory FiberPortMapping.fromMap(Map<String, dynamic> map, int fallbackIndex) {
    double? parseDouble(dynamic v) {
      if (v == null) return null;
      if (v is num) return v.toDouble();
      if (v is String) return double.tryParse(v);
      return null;
    }

    return FiberPortMapping(
      portIndex: (map['portIndex'] as num?)?.toInt() ?? fallbackIndex,
      status: map['status']?.toString() ?? 'empty',
      customerId: map['customerId']?.toString(),
      customerName: map['customerName']?.toString(),
      customerPhone: map['customerPhone']?.toString(),
      customerStbId: map['customerStbId']?.toString(),
      opticalPower: parseDouble(map['opticalPower']),
      subBoxId: map['subBoxId']?.toString(),
      subBoxName: map['subBoxName']?.toString(),
      notes: map['notes']?.toString(),
      couplerColor: map['couplerColor']?.toString(),
      fiberCoreColor: map['fiberCoreColor']?.toString(),
      cableTag: map['cableTag']?.toString(),
    );
  }

  bool get isEmpty => status == 'empty' || (customerId == null && subBoxId == null);
  bool get isCustomer => status == 'customer' || (customerId != null && customerId!.isNotEmpty);
  bool get isSubBox => status == 'subbox' || (subBoxId != null && subBoxId!.isNotEmpty);

  String? get opticalPowerStatus {
    if (opticalPower == null) return null;
    if (opticalPower! >= -6.0) return 'Good';
    if (opticalPower! >= -10.0) return 'Low';
    return 'Critical';
  }
}

class FiberBox {
  final String id;
  final String operatorUid;
  final String lineName; // e.g. "LINE-1", "MAIN ROAD"
  final String wdmPort; // e.g. "Port 1", "Port 2", "Port 3"
  final String name; // e.g. "Main JC-1", "Box-4 Water Tank"
  final String location; // e.g. "Pole #14 Near School"
  final String boxType; // "JC" (Joint Closure) or "FAT_BOX" (Distribution Box)
  final String splitterRatio; // "1:2", "1:4", "1:8", "1:16", "Custom"
  final int totalPorts; // 2, 4, 8, 16, etc.
  final String? parentBoxId; // null = connected to WDM Port directly
  final String? parentBoxName;
  final int? parentPortIndex;
  final double? inputPower;
  final double? outputPower;
  final String? inputFiberColor; // Incoming fiber core color (especially when direct from WDM)
  final String? inputCableTag; // Incoming cable tag/note (e.g. "12F Main Cable", "Core 1")
  final List<FiberPortMapping> ports;
  final DateTime createdAt;
  final DateTime? updatedAt;

  FiberBox({
    required this.id,
    required this.operatorUid,
    required this.lineName,
    required this.wdmPort,
    required this.name,
    this.location = '',
    this.boxType = 'FAT_BOX',
    this.splitterRatio = '1:8',
    required this.totalPorts,
    this.parentBoxId,
    this.parentBoxName,
    this.parentPortIndex,
    this.inputPower,
    this.outputPower,
    this.inputFiberColor,
    this.inputCableTag,
    required this.ports,
    required this.createdAt,
    this.updatedAt,
  });

  int get usedPortsCount => ports.where((p) => !p.isEmpty).length;
  int get customerPortsCount => ports.where((p) => p.isCustomer).length;
  int get subBoxPortsCount => ports.where((p) => p.isSubBox).length;
  int get freePortsCount => totalPorts - usedPortsCount;

  bool get isDirectFromWdm => parentBoxId == null || parentBoxId!.isEmpty;

  Map<String, dynamic> toMap() {
    return {
      'operatorUid': operatorUid,
      'lineName': lineName,
      'wdmPort': wdmPort,
      'name': name,
      'location': location,
      'boxType': boxType,
      'splitterRatio': splitterRatio,
      'totalPorts': totalPorts,
      'parentBoxId': parentBoxId,
      'parentBoxName': parentBoxName,
      'parentPortIndex': parentPortIndex,
      'inputPower': inputPower,
      'outputPower': outputPower,
      'inputFiberColor': inputFiberColor,
      'inputCableTag': inputCableTag,
      'ports': ports.map((p) => p.toMap()).toList(),
      'createdAt': Timestamp.fromDate(createdAt),
      'updatedAt': FieldValue.serverTimestamp(),
    };
  }

  factory FiberBox.fromFirestore(DocumentSnapshot doc) {
    final data = (doc.data() as Map<String, dynamic>?) ?? {};

    DateTime parseDate(dynamic val) {
      if (val is Timestamp) return val.toDate();
      if (val is String) return DateTime.tryParse(val) ?? DateTime.now();
      return DateTime.now();
    }

    double? parseDouble(dynamic v) {
      if (v == null) return null;
      if (v is num) return v.toDouble();
      if (v is String) return double.tryParse(v);
      return null;
    }

    final ratio = data['splitterRatio']?.toString() ?? '1:8';
    int defaultPorts = 8;
    if (ratio == '1:2') defaultPorts = 2;
    if (ratio == '1:4') defaultPorts = 4;
    if (ratio == '1:8') defaultPorts = 8;
    if (ratio == '1:16') defaultPorts = 16;

    final total = (data['totalPorts'] as num?)?.toInt() ?? defaultPorts;

    // Parse ports list
    final rawPorts = data['ports'];
    List<FiberPortMapping> portList = [];
    if (rawPorts is List) {
      for (int i = 0; i < rawPorts.length; i++) {
        final p = rawPorts[i];
        if (p is Map<String, dynamic>) {
          portList.add(FiberPortMapping.fromMap(p, i + 1));
        }
      }
    }

    // Ensure all 1..totalPorts exist
    if (portList.length < total) {
      for (int i = portList.length + 1; i <= total; i++) {
        portList.add(FiberPortMapping(portIndex: i));
      }
    }

    return FiberBox(
      id: doc.id,
      operatorUid: data['operatorUid']?.toString() ?? '',
      lineName: data['lineName']?.toString() ?? 'Default Line',
      wdmPort: data['wdmPort']?.toString() ?? 'Port 1',
      name: data['name']?.toString() ?? 'Unnamed Box',
      location: data['location']?.toString() ?? '',
      boxType: data['boxType']?.toString() ?? 'FAT_BOX',
      splitterRatio: ratio,
      totalPorts: total,
      parentBoxId: data['parentBoxId']?.toString(),
      parentBoxName: data['parentBoxName']?.toString(),
      parentPortIndex: (data['parentPortIndex'] as num?)?.toInt(),
      inputPower: parseDouble(data['inputPower']),
      outputPower: parseDouble(data['outputPower']),
      inputFiberColor: data['inputFiberColor']?.toString(),
      inputCableTag: data['inputCableTag']?.toString(),
      ports: portList,
      createdAt: parseDate(data['createdAt']),
      updatedAt: data['updatedAt'] != null ? parseDate(data['updatedAt']) : null,
    );
  }
}
