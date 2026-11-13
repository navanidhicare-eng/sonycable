import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/customer.dart';
import '../services/whatsapp_service.dart';
import '../theme/app_theme.dart';

class PaymentSuccessDialog extends StatefulWidget {
  final Customer customer;
  final double amountPaid;
  final String paymentMethod;
  final double remainingBalance;
  final String operatorName;
  final String? packageName;
  final bool isRecharge;
  final double? previousBalance;

  const PaymentSuccessDialog({
    super.key,
    required this.customer,
    required this.amountPaid,
    required this.paymentMethod,
    required this.remainingBalance,
    required this.operatorName,
    this.packageName,
    this.isRecharge = false,
    this.previousBalance,
  });

  static Future<void> show(
    BuildContext context, {
    required Customer customer,
    required double amountPaid,
    required String paymentMethod,
    required double remainingBalance,
    required String operatorName,
    String? packageName,
    bool isRecharge = false,
    double? previousBalance,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => PaymentSuccessDialog(
        customer: customer,
        amountPaid: amountPaid,
        paymentMethod: paymentMethod,
        remainingBalance: remainingBalance,
        operatorName: operatorName,
        packageName: packageName,
        isRecharge: isRecharge,
        previousBalance: previousBalance,
      ),
    );
  }

  @override
  State<PaymentSuccessDialog> createState() => _PaymentSuccessDialogState();
}

class _PaymentSuccessDialogState extends State<PaymentSuccessDialog>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _scaleAnimation;
  bool _whatsappSent = false;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );
    _scaleAnimation = CurvedAnimation(
      parent: _animController,
      curve: Curves.elasticOut,
    );
    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  void _sendWhatsAppReceipt() async {
    final c = widget.customer;
    final String msg;

    if (widget.isRecharge) {
      final prev = widget.previousBalance ?? (widget.remainingBalance - widget.amountPaid);
      msg = WhatsAppService.getRechargeReceiptMessage(
        customerName: c.name,
        customerId: c.displayId,
        customerDocId: c.id,
        packageName: widget.packageName ?? 'Standard Pack',
        packageAmount: widget.amountPaid,
        months: 1,
        expiryDate: c.expiryDate ?? DateTime.now(),
        previousBalance: prev,
        newTotalBalance: widget.remainingBalance,
        operatorName: widget.operatorName,
      );
    } else {
      final totalDue = widget.previousBalance ?? (widget.remainingBalance + widget.amountPaid);
      msg = WhatsAppService.getPaymentReceiptMessage(
        customerName: c.name,
        customerId: c.displayId,
        customerDocId: c.id,
        mobile: c.mobile,
        totalDue: totalDue,
        amountPaid: widget.amountPaid,
        remainingBalance: widget.remainingBalance,
        paymentMethod: widget.paymentMethod,
        operatorName: widget.operatorName,
      );
    }

    setState(() => _whatsappSent = true);
    await WhatsAppService.sendWhatsApp(mobile: c.mobile, message: msg);
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.customer;
    final now = DateTime.now();
    final timeStr = DateFormat('dd MMM yyyy, hh:mm a').format(now);
    final remaining = widget.remainingBalance;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      backgroundColor: Colors.white,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // PhonePe Green Animated Success Icon
              ScaleTransition(
                scale: _scaleAnimation,
                child: Container(
                  width: 84,
                  height: 84,
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF10B981).withValues(alpha: 0.35),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.check_rounded,
                      color: Colors.white,
                      size: 52,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Title
              Text(
                widget.isRecharge ? "Recharge Successful!" : "Payment Collected!",
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                "Collected by ${widget.operatorName}",
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 14),

              // Giant Amount
              Text(
                "₹${widget.amountPaid.toInt()}",
                style: const TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF059669),
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 18),

              // Transaction Details Card (PhonePe style)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  children: [
                    _buildRow(
                      "Customer Name",
                      c.name,
                      isBold: true,
                    ),
                    const Divider(height: 14, color: Color(0xFFE2E8F0)),
                    _buildRow(
                      "Customer ID",
                      c.displayId,
                    ),
                    const Divider(height: 14, color: Color(0xFFE2E8F0)),
                    _buildRow(
                      "Mobile Number",
                      c.mobile.isNotEmpty ? c.mobile : "N/A",
                    ),
                    const Divider(height: 14, color: Color(0xFFE2E8F0)),
                    if (widget.isRecharge) ...[
                      _buildRow(
                        "Package",
                        widget.packageName ?? "Standard Pack",
                        isBold: true,
                        valueColor: const Color(0xFF059669),
                      ),
                      const Divider(height: 14, color: Color(0xFFE2E8F0)),
                      _buildRow(
                        "Recharge Amount",
                        "₹${widget.amountPaid.toInt()}",
                        valueColor: const Color(0xFF059669),
                        isBold: true,
                      ),
                      const Divider(height: 14, color: Color(0xFFE2E8F0)),
                      _buildRow(
                        "Previous Due",
                        "₹${(widget.previousBalance ?? (widget.remainingBalance - widget.amountPaid)).toInt()}",
                        valueColor: const Color(0xFF64748B),
                        isBold: true,
                      ),
                      const Divider(height: 14, color: Color(0xFFE2E8F0)),
                      _buildRow(
                        "New Total Due",
                        remaining < 0
                            ? "-₹${(-remaining).toInt()} (Adv)"
                            : (remaining == 0 ? "₹0" : "₹${remaining.toInt()}"),
                        valueColor: remaining > 0 ? const Color(0xFFB91C1C) : const Color(0xFF059669),
                        isBold: true,
                      ),
                      const Divider(height: 14, color: Color(0xFFE2E8F0)),
                    ] else ...[
                      _buildRow(
                        "Total Due Before",
                        "₹${(widget.previousBalance ?? (widget.remainingBalance + widget.amountPaid)).toInt()}",
                        valueColor: const Color(0xFF64748B),
                        isBold: true,
                      ),
                      const Divider(height: 14, color: Color(0xFFE2E8F0)),
                      _buildRow(
                        "Amount Paid",
                        "₹${widget.amountPaid.toInt()}",
                        valueColor: const Color(0xFF059669),
                        isBold: true,
                      ),
                      const Divider(height: 14, color: Color(0xFFE2E8F0)),
                      _buildRow(
                        "Payment Mode",
                        widget.paymentMethod,
                        valueColor: AppColors.primary,
                        isBold: true,
                      ),
                      const Divider(height: 14, color: Color(0xFFE2E8F0)),
                      _buildRow(
                        remaining < 0
                            ? "Advance Balance (-)"
                            : remaining == 0
                                ? "Balance Status"
                                : "Remaining Due",
                        remaining < 0
                            ? "-₹${(-remaining).toInt()}"
                            : remaining == 0
                                ? "Fully Cleared (₹0)"
                                : "₹${remaining.toInt()}",
                        valueColor: remaining < 0
                            ? const Color(0xFF2563EB)
                            : remaining == 0
                                ? const Color(0xFF16A34A)
                                : const Color(0xFFEA580C),
                        isBold: true,
                      ),
                      const Divider(height: 14, color: Color(0xFFE2E8F0)),
                    ],
                    _buildRow(
                      "Date & Time",
                      timeStr,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),

              // Send WhatsApp Receipt Button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: _sendWhatsAppReceipt,
                  icon: const Icon(Icons.chat_bubble_rounded, size: 20),
                  label: Text(
                    _whatsappSent ? "WhatsApp Opened (Send Again)" : "Send WhatsApp Receipt",
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF25D366), // WhatsApp Green
                    foregroundColor: Colors.white,
                    elevation: 2,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Done Button
              SizedBox(
                width: double.infinity,
                height: 44,
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textSecondary,
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text(
                    "Done",
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRow(String label, String value, {Color? valueColor, bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: Color(0xFF64748B),
            fontWeight: FontWeight.w500,
          ),
        ),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 13,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
              color: valueColor ?? AppColors.textPrimary,
            ),
          ),
        ),
      ],
    );
  }
}
