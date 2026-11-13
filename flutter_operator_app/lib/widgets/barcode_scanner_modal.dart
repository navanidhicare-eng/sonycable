import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../services/sound_service.dart';

class BarcodeScannerModal extends StatefulWidget {
  final String title;

  const BarcodeScannerModal({
    super.key,
    this.title = "Scan Barcode",
  });

  static Future<String?> scan(BuildContext context, {String title = "Scan Barcode"}) {
    return Navigator.push<String>(
      context,
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => BarcodeScannerModal(title: title),
      ),
    );
  }

  @override
  State<BarcodeScannerModal> createState() => _BarcodeScannerModalState();
}

class _BarcodeScannerModalState extends State<BarcodeScannerModal> {
  late MobileScannerController _controller;
  bool _hasDetected = false;
  bool _isTorchOn = false;

  @override
  void initState() {
    super.initState();
    _controller = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
      facing: CameraFacing.back,
      torchEnabled: false,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_hasDetected) return;

    for (final barcode in capture.barcodes) {
      final code = barcode.rawValue?.trim();
      if (code != null && code.isNotEmpty) {
        _hasDetected = true;
        SoundService.playSuccessSound();
        if (mounted) {
          Navigator.pop(context, code);
        }
        break;
      }
    }
  }

  Future<void> _toggleTorch() async {
    try {
      await _controller.toggleTorch();
      setState(() => _isTorchOn = !_isTorchOn);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close_rounded, color: Colors.white, size: 26),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          widget.title,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: Colors.white),
        ),
        actions: [
          // Prominent Top Torch Button
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: _isTorchOn ? const Color(0xFFF59E0B) : const Color(0xFF334155),
                foregroundColor: _isTorchOn ? Colors.black : Colors.amberAccent,
                elevation: 4,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                  side: BorderSide(
                    color: _isTorchOn ? Colors.yellow : Colors.amberAccent.withValues(alpha: 0.6),
                    width: 1.5,
                  ),
                ),
              ),
              onPressed: _toggleTorch,
              icon: Icon(
                _isTorchOn ? Icons.flash_on_rounded : Icons.flash_off_rounded,
                size: 18,
                color: _isTorchOn ? Colors.black : Colors.amberAccent,
              ),
              label: Text(
                _isTorchOn ? "Torch ON" : "Torch OFF",
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                  color: _isTorchOn ? Colors.black : Colors.white,
                ),
              ),
            ),
          ),
          // Camera Switch Button
          IconButton(
            icon: const Icon(Icons.flip_camera_ios_rounded, color: Colors.white, size: 22),
            tooltip: "Switch Camera",
            onPressed: () => _controller.switchCamera(),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: Stack(
        alignment: Alignment.center,
        children: [
          // 1. Camera Viewfinder
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),

          // 2. Translucent Overlay with Cutout Target Area
          LayoutBuilder(
            builder: (context, constraints) {
              final scanBoxSize = constraints.maxWidth * 0.75;

              return Stack(
                children: [
                  ColorFiltered(
                    colorFilter: ColorFilter.mode(
                      Colors.black.withValues(alpha: 0.55),
                      BlendMode.srcOut,
                    ),
                    child: Stack(
                      children: [
                        Container(
                          decoration: const BoxDecoration(
                            color: Colors.transparent,
                          ),
                          width: double.infinity,
                          height: double.infinity,
                        ),
                        Center(
                          child: Container(
                            width: scanBoxSize,
                            height: scanBoxSize * 0.55,
                            decoration: BoxDecoration(
                              color: Colors.black,
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Green Corner Borders on Cutout
                  Center(
                    child: Container(
                      width: scanBoxSize,
                      height: scanBoxSize * 0.55,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFF10B981), width: 2.5),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),

          // 3. Big Prominent Torch Button (Right Below Viewfinder)
          Positioned(
            bottom: 95,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: _toggleTorch,
                borderRadius: BorderRadius.circular(30),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                  decoration: BoxDecoration(
                    color: _isTorchOn ? const Color(0xFFF59E0B) : const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(30),
                    border: Border.all(
                      color: _isTorchOn ? Colors.white : Colors.amber,
                      width: 2.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: _isTorchOn
                            ? const Color(0xFFF59E0B).withValues(alpha: 0.6)
                            : Colors.amber.withValues(alpha: 0.25),
                        blurRadius: _isTorchOn ? 20 : 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _isTorchOn ? Icons.flash_on_rounded : Icons.flash_off_rounded,
                        color: _isTorchOn ? Colors.black : Colors.amber,
                        size: 26,
                      ),
                      const SizedBox(width: 10),
                      Text(
                        _isTorchOn ? "🔦 Torch: ON (Tap to Turn OFF)" : "🔦 Torch: OFF (Tap to Turn ON)",
                        style: TextStyle(
                          color: _isTorchOn ? Colors.black : Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // 4. Bottom Guide Text
          Positioned(
            bottom: 35,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.75),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.white24),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.qr_code_scanner_rounded, color: Color(0xFF10B981), size: 22),
                  SizedBox(width: 10),
                  Flexible(
                    child: Text(
                      "Point camera at STB or VC Barcode",
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

