import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class NxtLoginResult {
  final bool isSuccess;
  final String? operatorName;
  final String? lcoCode;
  final String? subuserCode;
  final String? balance;
  final String? error;
  final int statusCode;

  NxtLoginResult({
    required this.isSuccess,
    this.operatorName,
    this.lcoCode,
    this.subuserCode,
    this.balance,
    this.error,
    required this.statusCode,
  });
}

class NxtRetrackResult {
  final bool isSuccess;
  final String? transactionId;
  final String message;
  final String? error;
  final String? errorCode;
  final int latencyMs;
  final String rawResponse;
  final int statusCode;

  NxtRetrackResult({
    required this.isSuccess,
    this.transactionId,
    required this.message,
    this.error,
    this.errorCode,
    required this.latencyMs,
    required this.rawResponse,
    required this.statusCode,
  });
}

class NxtTrackResult {
  final bool isSuccess;
  final String? customerName;
  final String? lcoCode;
  final String? canNumber;
  final String? casType;
  final String? itemCode;
  final String rawMessage;
  final String? error;
  final int latencyMs;
  final String rawResponse;

  NxtTrackResult({
    required this.isSuccess,
    this.customerName,
    this.lcoCode,
    this.canNumber,
    this.casType,
    this.itemCode,
    required this.rawMessage,
    this.error,
    required this.latencyMs,
    required this.rawResponse,
  });
}

class NxtDigitalService {
  static const String _keyUsername = 'nxt_username';
  static const String _keyPassword = 'nxt_password';
  static const String _baseUrl = 'https://lcoportalnew6.nxtdigital.in';
  
  static String? _cachedSessionCookie;

  /// Check if operator credentials are saved
  static Future<bool> hasCredentials() async {
    final prefs = await SharedPreferences.getInstance();
    final u = prefs.getString(_keyUsername) ?? '';
    final p = prefs.getString(_keyPassword) ?? '';
    return u.trim().isNotEmpty && p.trim().isNotEmpty;
  }

  /// Get saved credentials
  static Future<Map<String, String>> getCredentials() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      'username': prefs.getString(_keyUsername) ?? '',
      'password': prefs.getString(_keyPassword) ?? '',
    };
  }

  /// Save credentials in local storage
  static Future<void> saveCredentials(String username, String password) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyUsername, username.trim());
    await prefs.setString(_keyPassword, password.trim());
    _cachedSessionCookie = null; // Clear old session cache
  }

  /// Helper to send HTTP request (handles Web proxy vs native Android direct)
  static Future<Map<String, dynamic>> _sendRequest({
    required String endpoint,
    required String method,
    Map<String, String>? headers,
    Map<String, dynamic>? body,
    bool isFormData = false,
  }) async {
    if (kIsWeb) {
      // On Web, proxy through Next.js API route to bypass browser CORS
      // If running flutter web dev server on port 8085 or similar, route to Next.js port 9002
      final host = Uri.base.host.isNotEmpty ? Uri.base.host : 'localhost';
      final scheme = Uri.base.scheme.isNotEmpty ? Uri.base.scheme : 'http';
      final proxyUrl = Uri.parse('$scheme://$host:9002/api/nxt-proxy');
      final res = await http.post(
        proxyUrl,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'endpoint': endpoint,
          'method': method,
          'headers': headers ?? {},
          'body': body,
          'isFormData': isFormData,
        }),
      );
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      } else {
        throw Exception("Proxy error: ${res.statusCode}");
      }
    } else {
      // Native Android: Direct HTTPS call to NXT Digital
      final url = Uri.parse('$_baseUrl$endpoint');
      final reqHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': '$_baseUrl/',
        'Origin': _baseUrl,
        if (headers != null) ...headers,
      };

      if (method == 'POST') {
        if (isFormData && body != null) {
          final request = http.MultipartRequest('POST', url);
          request.headers.addAll(reqHeaders);
          body.forEach((key, val) => request.fields[key] = val.toString());
          final streamed = await request.send();
          final res = await http.Response.fromStream(streamed);

          return {
            'status': res.statusCode,
            'cookies': [res.headers['set-cookie'] ?? ''],
            'body': res.body,
          };
        } else {
          final res = await http.post(url, headers: reqHeaders, body: body != null ? jsonEncode(body) : null);
          return {
            'status': res.statusCode,
            'cookies': [res.headers['set-cookie'] ?? ''],
            'body': res.body,
          };
        }
      } else {
        final res = await http.get(url, headers: reqHeaders);
        return {
          'status': res.statusCode,
          'cookies': [res.headers['set-cookie'] ?? ''],
          'body': res.body,
        };
      }
    }
  }

  /// Authenticate with NXT Digital portal
  static Future<NxtLoginResult> login({String? username, String? password}) async {
    try {
      String u = username ?? '';
      String p = password ?? '';

      if (u.isEmpty || p.isEmpty) {
        final creds = await getCredentials();
        u = creds['username'] ?? '';
        p = creds['password'] ?? '';
      }

      if (u.isEmpty || p.isEmpty) {
        return NxtLoginResult(
          isSuccess: false,
          error: "NXT Digital credentials not found. Please configure in Settings.",
          statusCode: 400,
        );
      }

      final isSubuser = !u.endsWith(".01");
      final endpoint = isSubuser
          ? '/lco/v1/subuser/login?frcode=${Uri.encodeComponent(u)}&password=${Uri.encodeComponent(p)}&logintype=WEB'
          : '/lco/v1/login.php?frcode=${Uri.encodeComponent(u)}&password=${Uri.encodeComponent(p)}&logintype=WEB';

      final res = await _sendRequest(endpoint: endpoint, method: 'GET');
      final int status = res['status'] ?? 0;
      final rawText = res['body']?.toString() ?? '';

      // Extract the authenticated session cookie
      final dynamic cookiesData = res['cookies'];
      List<String> cookiesList = [];
      if (cookiesData is List) {
        cookiesList = cookiesData.map((e) => e.toString()).toList();
      } else if (cookiesData is String) {
        cookiesList = [cookiesData];
      }

      for (final c in cookiesList) {
        if (c.contains('PHPSESSID=')) {
          final match = RegExp(r'PHPSESSID=([^;]+)').firstMatch(c);
          if (match != null) {
            _cachedSessionCookie = 'PHPSESSID=${match.group(1)}';
          }
        }
      }

      Map<String, dynamic> json = {};
      try {
        json = jsonDecode(rawText) as Map<String, dynamic>;
      } catch (_) {}

      if (json.containsKey('error') && json['error'] != null) {
        return NxtLoginResult(
          isSuccess: false,
          error: json['error'].toString(),
          statusCode: status,
        );
      }

      if (status == 200 && (json.containsKey('frcode') || json.containsKey('lcosubuserid') || json.containsKey('lcoid'))) {
        return NxtLoginResult(
          isSuccess: true,
          operatorName: json['contactname']?.toString() ?? json['lconame']?.toString() ?? 'NXT Operator',
          lcoCode: json['frcode']?.toString() ?? '',
          subuserCode: json['subuserfrcode']?.toString() ?? u,
          balance: json['credit']?.toString() ?? json['amount']?.toString() ?? '0.00',
          statusCode: status,
        );
      }

      return NxtLoginResult(
        isSuccess: false,
        error: rawText.isNotEmpty ? rawText : "Invalid response from NXT Digital server",
        statusCode: status,
      );
    } catch (e) {
      return NxtLoginResult(
        isSuccess: false,
        error: "Network connection error: $e",
        statusCode: 500,
      );
    }
  }

  /// Ensure we have an active session
  static Future<bool> _ensureSession() async {
    if (_cachedSessionCookie != null && _cachedSessionCookie!.isNotEmpty) {
      return true;
    }
    final loginRes = await login();
    return loginRes.isSuccess;
  }

  /// 1-Click STB Refresh (Retrack API)
  static Future<NxtRetrackResult> retrackStb(String deviceId) async {
    final cleanId = deviceId.trim();
    if (cleanId.isEmpty) {
      return NxtRetrackResult(
        isSuccess: false,
        message: "STB / VC Number cannot be empty.",
        latencyMs: 0,
        rawResponse: "No device ID provided",
        statusCode: 400,
      );
    }

    final hasSession = await _ensureSession();
    if (!hasSession) {
      return NxtRetrackResult(
        isSuccess: false,
        message: "NXT Digital Login Failed. Please check your credentials in Settings.",
        error: "Authentication Failed",
        latencyMs: 0,
        rawResponse: "Failed to establish authenticated session with NXT Digital",
        statusCode: 401,
      );
    }

    final stopwatch = Stopwatch()..start();

    try {
      final res = await _sendRequest(
        endpoint: '/lco/v1/hardware/retrack',
        method: 'POST',
        headers: {
          if (_cachedSessionCookie != null) 'Cookie': _cachedSessionCookie!,
        },
        body: {'deviceid': cleanId},
        isFormData: true,
      );

      final latency = stopwatch.elapsedMilliseconds;
      final int status = res['status'] ?? 0;
      final rawText = res['body']?.toString() ?? '';

      // If session expired (401), re-login once and retry
      if (status == 401 || rawText.contains("No valid session")) {
        _cachedSessionCookie = null;
        final relogin = await login();
        if (relogin.isSuccess) {
          return await retrackStb(cleanId);
        } else {
          return NxtRetrackResult(
            isSuccess: false,
            message: "Session expired and re-login failed. Please verify password.",
            error: "Session Expired",
            latencyMs: latency,
            rawResponse: rawText,
            statusCode: 401,
          );
        }
      }

      Map<String, dynamic> json = {};
      try {
        json = jsonDecode(rawText) as Map<String, dynamic>;
      } catch (_) {}

      // Case 1: Success
      if (json['status'] == 'SUCCESS' || json.containsKey('success')) {
        final txId = json['success']?.toString() ?? 'OK';
        return NxtRetrackResult(
          isSuccess: true,
          transactionId: txId,
          message: "STB Refresh Command Sent Successfully!\nActivation signal fired to customer TV box.",
          latencyMs: latency,
          rawResponse: rawText,
          statusCode: status,
        );
      }

      // Case 2: Server-side Error (e.g. Invalid Customer No, Not Mapped)
      if (json.containsKey('error')) {
        final errStr = json['error']?.toString() ?? "Unknown error";
        final errCode = json['errorcode']?.toString();

        String friendlyMessage = errStr;
        if (errStr.toLowerCase().contains("invalid customer")) {
          friendlyMessage = "Box Not Mapped: This STB/VC ($cleanId) does not belong to your NXT Digital operator account.";
        }

        return NxtRetrackResult(
          isSuccess: false,
          message: friendlyMessage,
          error: errStr,
          errorCode: errCode,
          latencyMs: latency,
          rawResponse: rawText,
          statusCode: status,
        );
      }

      return NxtRetrackResult(
        isSuccess: false,
        message: rawText.isNotEmpty ? rawText : "Unexpected response from NXT Digital server",
        latencyMs: latency,
        rawResponse: rawText,
        statusCode: status,
      );
    } catch (e) {
      return NxtRetrackResult(
        isSuccess: false,
        message: "Failed to connect to NXT Digital: $e",
        error: e.toString(),
        latencyMs: stopwatch.elapsedMilliseconds,
        rawResponse: e.toString(),
        statusCode: 500,
      );
    }
  }

  /// STB Locator / Track STB API
  static Future<NxtTrackResult> trackStb(String deviceId) async {
    final cleanId = deviceId.trim();
    if (cleanId.isEmpty) {
      return NxtTrackResult(
        isSuccess: false,
        rawMessage: "Please enter a valid STB or VC Number.",
        latencyMs: 0,
        rawResponse: "",
      );
    }

    final hasSession = await _ensureSession();
    if (!hasSession) {
      return NxtTrackResult(
        isSuccess: false,
        rawMessage: "NXT Digital authentication failed. Please check credentials in Settings.",
        error: "Auth Failed",
        latencyMs: 0,
        rawResponse: "",
      );
    }

    final stopwatch = Stopwatch()..start();

    try {
      // 1. Call devicetrack
      final trackRes = await _sendRequest(
        endpoint: '/lco/v1/hardware/devicetrack?deviceid=${Uri.encodeComponent(cleanId)}',
        method: 'GET',
        headers: {
          if (_cachedSessionCookie != null) 'Cookie': _cachedSessionCookie!,
        },
      );

      final latency = stopwatch.elapsedMilliseconds;
      final rawTrack = trackRes['body']?.toString() ?? '';

      Map<String, dynamic> trackJson = {};
      try {
        trackJson = jsonDecode(rawTrack) as Map<String, dynamic>;
      } catch (_) {}

      // 2. Also call getdevicedetails to get CAS and CAN numbers
      String? canNo;
      String? casType;
      String? itemCode;
      try {
        final detailsRes = await _sendRequest(
          endpoint: '/lco/v1/hardware/getdevicedetails?customerno=${Uri.encodeComponent(cleanId)}',
          method: 'GET',
          headers: {
            if (_cachedSessionCookie != null) 'Cookie': _cachedSessionCookie!,
          },
        );
        final detailsText = detailsRes['body']?.toString() ?? '';
        final detailsJson = jsonDecode(detailsText) as Map<String, dynamic>;
        canNo = detailsJson['customercan']?.toString();
        casType = detailsJson['castype']?.toString();
        itemCode = detailsJson['stbitemcode']?.toString();
      } catch (_) {}

      String? customerName;
      String? lcoCode;
      final msg = trackJson['error']?.toString() ?? trackJson['message']?.toString() ?? rawTrack;

      // Extract customer name if in "STB is with customer [NAME] and LCO code is [LCO]"
      if (msg.contains("STB is with customer")) {
        final match = RegExp(r'STB is with customer\s+(.+?)\s+and LCO code is\s+(.+)').firstMatch(msg);
        if (match != null) {
          customerName = match.group(1)?.trim();
          lcoCode = match.group(2)?.trim();
        }
      }

      final isLocated = customerName != null || canNo != null || trackJson['status'] == 'SUCCESS';

      return NxtTrackResult(
        isSuccess: isLocated,
        customerName: customerName,
        lcoCode: lcoCode,
        canNumber: canNo,
        casType: casType,
        itemCode: itemCode,
        rawMessage: msg,
        error: isLocated ? null : msg,
        latencyMs: latency,
        rawResponse: rawTrack,
      );
    } catch (e) {
      return NxtTrackResult(
        isSuccess: false,
        rawMessage: "Error locating box: $e",
        error: e.toString(),
        latencyMs: stopwatch.elapsedMilliseconds,
        rawResponse: e.toString(),
      );
    }
  }
}

