import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class OpticalPowerCalculatorScreen extends StatefulWidget {
  const OpticalPowerCalculatorScreen({super.key});

  @override
  State<OpticalPowerCalculatorScreen> createState() => _OpticalPowerCalculatorScreenState();
}

class _OpticalPowerCalculatorScreenState extends State<OpticalPowerCalculatorScreen> {
  // Mode: "RATIO" (FBT Unbalanced) or "PLC" (Equal Balanced)
  String _activeTab = "RATIO";

  // --- RATIO (FBT) STATE ---
  final _ratioInputPowerCtrl = TextEditingController(text: "18.0");
  String _selectedRatio = "90:10";
  double _customRatioPercent = 90.0;
  bool _isCustomRatio = false;

  // Standard FBT Coupler typical insertion losses (Through Loss dB, Tap Loss dB)
  static const Map<String, List<double>> _fbtLosses = {
    "50:50": [3.4, 3.4],
    "60:40": [2.6, 4.4],
    "70:30": [1.9, 5.7],
    "80:20": [1.2, 7.5],
    "85:15": [0.9, 8.8],
    "90:10": [0.6, 10.6],
    "95:5": [0.3, 13.8],
    "98:2": [0.2, 17.5],
  };

  // --- PLC SPLITTER STATE ---
  final _plcInputPowerCtrl = TextEditingController(text: "11.0");
  String _selectedPlcSplit = "1:4";

  // Standard PLC Splitter insertion losses (typical)
  static const Map<String, double> _plcLosses = {
    "1:2": 3.6,
    "1:4": 7.1,
    "1:8": 10.3,
    "1:16": 13.6,
    "1:32": 16.9,
    "1:64": 20.3,
  };

  // --- OPTIONAL EXTRA FIELD LOSSES ---
  bool _includeExtraLosses = false;
  final _fiberDistKmCtrl = TextEditingController(text: "");
  final _jointCountCtrl = TextEditingController(text: "");
  final _connectorCountCtrl = TextEditingController(text: "");

  double get _extraLossTotal {
    if (!_includeExtraLosses) return 0.0;
    double dist = double.tryParse(_fiberDistKmCtrl.text.trim()) ?? 0.0;
    int joints = int.tryParse(_jointCountCtrl.text.trim()) ?? 0;
    int conns = int.tryParse(_connectorCountCtrl.text.trim()) ?? 0;

    double distLoss = dist * 0.35; // ~0.35 dB/km
    double jointLoss = joints * 0.08; // ~0.08 dB per fusion splice
    double connLoss = conns * 0.25; // ~0.25 dB per SC/APC connector

    return distLoss + jointLoss + connLoss;
  }

  @override
  void dispose() {
    _ratioInputPowerCtrl.dispose();
    _plcInputPowerCtrl.dispose();
    _fiberDistKmCtrl.dispose();
    _jointCountCtrl.dispose();
    _connectorCountCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          "Optical Power Calculator",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: AppColors.textPrimary),
        ),
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Mode Selector Tabs (FBT Ratio vs PLC vs Line Cascade)
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              padding: const EdgeInsets.all(4),
              child: Row(
                children: [
                  Expanded(
                    child: _buildTabButton(
                      id: "RATIO",
                      label: "Ratio Coupler (FBT)",
                      icon: Icons.alt_route_rounded,
                      activeColor: const Color(0xFF2563EB),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: _buildTabButton(
                      id: "PLC",
                      label: "PLC Splitter",
                      icon: Icons.hub_rounded,
                      activeColor: const Color(0xFF059669),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Tab Content
            if (_activeTab == "RATIO") _buildRatioCalculatorView(),
            if (_activeTab == "PLC") _buildPlcCalculatorView(),

            const SizedBox(height: 20),

            // Quick Reference Loss Table (Cheat Sheet)
            _buildReferenceTableCard(),
          ],
        ),
      ),
    );
  }

  Widget _buildTabButton({
    required String id,
    required String label,
    required IconData icon,
    required Color activeColor,
  }) {
    final isSelected = _activeTab == id;
    return InkWell(
      onTap: () => setState(() => _activeTab = id),
      borderRadius: BorderRadius.circular(10),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? activeColor : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 15, color: isSelected ? Colors.white : AppColors.textSecondary),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: isSelected ? Colors.white : AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ===========================================================================
  // 1. RATIO (FBT) CALCULATOR VIEW
  // ===========================================================================
  Widget _buildRatioCalculatorView() {
    final double inPower = double.tryParse(_ratioInputPowerCtrl.text.trim()) ?? 18.0;

    double throughLoss = 0.6;
    double tapLoss = 10.6;

    if (_isCustomRatio) {
      double r = _customRatioPercent;
      throughLoss = (-10 * (math.log(r / 100) / math.ln10)) + 0.15;
      tapLoss = (-10 * (math.log((100 - r) / 100) / math.ln10)) + 0.15;
    } else {
      final losses = _fbtLosses[_selectedRatio] ?? [0.6, 10.6];
      throughLoss = losses[0];
      tapLoss = losses[1];
    }

    final double extra = _extraLossTotal;
    final double throughOut = inPower - throughLoss - extra;
    final double tapOut = inPower - tapLoss - extra;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.alt_route_rounded, size: 18, color: Color(0xFF2563EB)),
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Ratio Coupler (FBT Unbalanced)",
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                    Text(
                      "Calculates Through Leg (forward) and Tap Leg (drop)",
                      style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Divider(height: 24),

          // Input Power Field
          const Text(
            "Input Power (dBm):",
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _ratioInputPowerCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            decoration: InputDecoration(
              hintText: "e.g. +18.0",
              hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13, fontWeight: FontWeight.normal),
              suffixText: "dBm",
              prefixIcon: const Icon(Icons.bolt_rounded, size: 20, color: Color(0xFFF59E0B)),
              filled: true,
              fillColor: AppColors.inputBg,
              isDense: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onChanged: (v) => setState(() {}),
          ),
          const SizedBox(height: 16),

          // Select Ratio Chips
          const Text(
            "Select Coupler Ratio:",
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              ..._fbtLosses.keys.map((ratio) {
                final isSelected = !_isCustomRatio && _selectedRatio == ratio;
                return ChoiceChip(
                  label: Text(
                    ratio,
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.bold,
                      color: isSelected ? Colors.white : AppColors.textPrimary,
                    ),
                  ),
                  selected: isSelected,
                  selectedColor: const Color(0xFF2563EB),
                  backgroundColor: AppColors.inputBg,
                  onSelected: (val) {
                    if (val) {
                      setState(() {
                        _selectedRatio = ratio;
                        _isCustomRatio = false;
                      });
                    }
                  },
                );
              }),
              ChoiceChip(
                label: Text(
                  "Custom",
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.bold,
                    color: _isCustomRatio ? Colors.white : AppColors.textPrimary,
                  ),
                ),
                selected: _isCustomRatio,
                selectedColor: const Color(0xFF2563EB),
                backgroundColor: AppColors.inputBg,
                onSelected: (val) {
                  if (val) setState(() => _isCustomRatio = true);
                },
              ),
            ],
          ),

          if (_isCustomRatio) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Slider(
                    value: _customRatioPercent,
                    min: 50,
                    max: 99,
                    divisions: 49,
                    label: "${_customRatioPercent.toInt()}:${(100 - _customRatioPercent).toInt()}",
                    activeColor: const Color(0xFF2563EB),
                    onChanged: (v) => setState(() => _customRatioPercent = v),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(6)),
                  child: Text(
                    "${_customRatioPercent.toInt()} : ${(100 - _customRatioPercent).toInt()}",
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1D4ED8)),
                  ),
                ),
              ],
            ),
          ],

          const SizedBox(height: 14),

          // Optional Extra Losses
          _buildExtraLossesExpander(),

          const SizedBox(height: 16),

          // Output Results Card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFF0FDF4), Color(0xFFEFF6FF)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFBFDBFE)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.output_rounded, size: 16, color: Color(0xFF1D4ED8)),
                    SizedBox(width: 6),
                    Text(
                      "Calculated Output Power:",
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E293B)),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Leg 1: Through Leg (Main line forward)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFF86EFAC)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(6)),
                        child: const Icon(Icons.arrow_forward_rounded, size: 18, color: Color(0xFF15803D)),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  _isCustomRatio ? "Through Leg (${_customRatioPercent.toInt()}%)" : "Through Leg (${_selectedRatio.split(':').first}%)",
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
                                ),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                  decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(4)),
                                  child: Text("Loss: -${throughLoss.toStringAsFixed(2)} dB", style: const TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                                ),
                              ],
                            ),
                            const Text(
                              "Feeds next pole / JC box forward on main line",
                              style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        "${throughOut > 0 ? '+' : ''}${throughOut.toStringAsFixed(2)} dBm",
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF15803D)),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 8),

                // Leg 2: Tap Leg (Local Drop)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFFED7AA)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(color: const Color(0xFFFFEDD5), borderRadius: BorderRadius.circular(6)),
                        child: const Icon(Icons.call_split_rounded, size: 18, color: Color(0xFFC2410C)),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  _isCustomRatio ? "Tap Leg (${(100 - _customRatioPercent).toInt()}%)" : "Tap Leg (${_selectedRatio.split(':').last}%)",
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
                                ),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                  decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(4)),
                                  child: Text("Loss: -${tapLoss.toStringAsFixed(2)} dB", style: const TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                                ),
                              ],
                            ),
                            const Text(
                              "Feeds local distribution / customer box",
                              style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        "${tapOut > 0 ? '+' : ''}${tapOut.toStringAsFixed(2)} dBm",
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFFC2410C)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // 2. PLC SPLITTER CALCULATOR VIEW
  // ===========================================================================
  Widget _buildPlcCalculatorView() {
    final double inPower = double.tryParse(_plcInputPowerCtrl.text.trim()) ?? 11.0;
    final double plcLoss = _plcLosses[_selectedPlcSplit] ?? 7.1;
    final double extra = _extraLossTotal;
    final double outputPower = inPower - plcLoss - extra;

    int totalPorts = 4;
    if (_selectedPlcSplit == "1:2") totalPorts = 2;
    if (_selectedPlcSplit == "1:4") totalPorts = 4;
    if (_selectedPlcSplit == "1:8") totalPorts = 8;
    if (_selectedPlcSplit == "1:16") totalPorts = 16;
    if (_selectedPlcSplit == "1:32") totalPorts = 32;
    if (_selectedPlcSplit == "1:64") totalPorts = 64;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.hub_rounded, size: 18, color: Color(0xFF059669)),
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "PLC Splitter (Balanced Equal)",
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                    Text(
                      "Divides power equally across all output ports",
                      style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Divider(height: 24),

          // Input Power Field
          const Text(
            "Input Power (dBm):",
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _plcInputPowerCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            decoration: InputDecoration(
              hintText: "e.g. +11.0",
              hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13, fontWeight: FontWeight.normal),
              suffixText: "dBm",
              prefixIcon: const Icon(Icons.bolt_rounded, size: 20, color: Color(0xFFF59E0B)),
              filled: true,
              fillColor: AppColors.inputBg,
              isDense: true,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onChanged: (v) => setState(() {}),
          ),
          const SizedBox(height: 16),

          // Select Splitter Ratio Chips
          const Text(
            "Select PLC Split Ratio:",
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: _plcLosses.keys.map((split) {
              final isSelected = _selectedPlcSplit == split;
              return ChoiceChip(
                label: Text(
                  split,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: isSelected ? Colors.white : AppColors.textPrimary,
                  ),
                ),
                selected: isSelected,
                selectedColor: const Color(0xFF059669),
                backgroundColor: AppColors.inputBg,
                onSelected: (val) {
                  if (val) setState(() => _selectedPlcSplit = split);
                },
              );
            }).toList(),
          ),

          const SizedBox(height: 14),

          // Optional Extra Losses
          _buildExtraLossesExpander(),

          const SizedBox(height: 16),

          // Output Results Card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFECFDF5), Color(0xFFF0FDF4)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFA7F3D0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.check_circle_rounded, size: 18, color: Color(0xFF059669)),
                    const SizedBox(width: 6),
                    Text(
                      "Each of the $totalPorts Output Ports gets:",
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF065F46)),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "${outputPower > 0 ? '+' : ''}${outputPower.toStringAsFixed(2)} dBm",
                          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF047857)),
                        ),
                        Text(
                          "Insertion Loss: -${plcLoss.toStringAsFixed(1)} dB per port",
                          style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                    _buildPowerStatusBadge(outputPower),
                  ],
                ),

                const Divider(height: 20),

                // Visual Representation of Output Ports
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: List.generate(math.min(totalPorts, 16), (index) {
                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFFA7F3D0)),
                      ),
                      child: Text(
                        "Port #${index + 1}: ${outputPower > 0 ? '+' : ''}${outputPower.toStringAsFixed(1)}",
                        style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF065F46)),
                      ),
                    );
                  }),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // EXTRA LOSSES (DISTANCE, JOINTS, CONNECTORS)
  // ===========================================================================
  Widget _buildExtraLossesExpander() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        children: [
          CheckboxListTile(
            value: _includeExtraLosses,
            dense: true,
            title: const Text("Include Cable & Splicing Losses", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
            subtitle: Text(
              _includeExtraLosses ? "-${_extraLossTotal.toStringAsFixed(2)} dB additional field loss" : "Distance, splice joints & connectors",
              style: TextStyle(fontSize: 10.5, color: _includeExtraLosses ? AppColors.danger : AppColors.textMuted),
            ),
            onChanged: (v) => setState(() => _includeExtraLosses = v ?? false),
          ),
          if (_includeExtraLosses) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _fiberDistKmCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: const TextStyle(fontSize: 12),
                      decoration: InputDecoration(
                        labelText: "Km Distance",
                        hintText: "1.0",
                        hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                        suffixText: "km",
                        isDense: true,
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onChanged: (v) => setState(() {}),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: TextField(
                      controller: _jointCountCtrl,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(fontSize: 12),
                      decoration: InputDecoration(
                        labelText: "Joints",
                        hintText: "2",
                        hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                        isDense: true,
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onChanged: (v) => setState(() {}),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: TextField(
                      controller: _connectorCountCtrl,
                      keyboardType: TextInputType.number,
                      style: const TextStyle(fontSize: 12),
                      decoration: InputDecoration(
                        labelText: "Adapters",
                        hintText: "1",
                        hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                        isDense: true,
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onChanged: (v) => setState(() {}),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ===========================================================================
  // REFERENCE TABLE (CHEAT SHEET) - DYNAMIC BY ACTIVE TAB
  // ===========================================================================
  Widget _buildReferenceTableCard() {
    final bool isRatio = _activeTab == "RATIO";

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isRatio ? Icons.alt_route_rounded : Icons.hub_rounded,
                size: 16,
                color: isRatio ? const Color(0xFF2563EB) : const Color(0xFF059669),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  isRatio ? "FBT Ratio Couplers Quick Reference" : "PLC Splitters Quick Reference",
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isRatio ? const Color(0xFFEFF6FF) : const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  "Tap row to select",
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.bold,
                    color: isRatio ? const Color(0xFF2563EB) : const Color(0xFF059669),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          if (isRatio) ...[
            // FBT Ratio Reference Table
            Table(
              border: TableBorder.all(color: const Color(0xFFE2E8F0), width: 0.8),
              children: [
                const TableRow(
                  decoration: BoxDecoration(color: Color(0xFFF8FAFC)),
                  children: [
                    Padding(padding: EdgeInsets.all(6), child: Text("Coupler Ratio", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11))),
                    Padding(padding: EdgeInsets.all(6), child: Text("Main Line / Through", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFF15803D)))),
                    Padding(padding: EdgeInsets.all(6), child: Text("Drop Wire / Tap", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFFC2410C)))),
                  ],
                ),
                ..._fbtLosses.entries.map((e) {
                  final isSelected = !_isCustomRatio && _selectedRatio == e.key;
                  return TableRow(
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFFEFF6FF) : Colors.transparent,
                    ),
                    children: [
                      InkWell(
                        onTap: () {
                          setState(() {
                            _selectedRatio = e.key;
                            _isCustomRatio = false;
                          });
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Row(
                            children: [
                              if (isSelected) const Icon(Icons.check_circle, size: 12, color: Color(0xFF2563EB)),
                              if (isSelected) const SizedBox(width: 4),
                              Text(e.key, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: isSelected ? const Color(0xFF1D4ED8) : AppColors.textPrimary)),
                            ],
                          ),
                        ),
                      ),
                      InkWell(
                        onTap: () {
                          setState(() {
                            _selectedRatio = e.key;
                            _isCustomRatio = false;
                          });
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Text("-${e.value[0]} dB", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF15803D))),
                        ),
                      ),
                      InkWell(
                        onTap: () {
                          setState(() {
                            _selectedRatio = e.key;
                            _isCustomRatio = false;
                          });
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Text("-${e.value[1]} dB", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFFC2410C))),
                        ),
                      ),
                    ],
                  );
                }),
              ],
            ),
          ] else ...[
            // PLC Splitter Reference Table
            Table(
              border: TableBorder.all(color: const Color(0xFFE2E8F0), width: 0.8),
              children: [
                const TableRow(
                  decoration: BoxDecoration(color: Color(0xFFF0FDF4)),
                  children: [
                    Padding(padding: EdgeInsets.all(6), child: Text("Splitter Type", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11))),
                    Padding(padding: EdgeInsets.all(6), child: Text("Output Ports", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11))),
                    Padding(padding: EdgeInsets.all(6), child: Text("Loss per Port (Equal)", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Color(0xFF047857)))),
                  ],
                ),
                ..._plcLosses.entries.map((e) {
                  final isSelected = _selectedPlcSplit == e.key;
                  final portCount = int.tryParse(e.key.replaceFirst("1:", "")) ?? 2;
                  return TableRow(
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFFDCFCE7) : Colors.transparent,
                    ),
                    children: [
                      InkWell(
                        onTap: () {
                          setState(() => _selectedPlcSplit = e.key);
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Row(
                            children: [
                              if (isSelected) const Icon(Icons.check_circle, size: 12, color: Color(0xFF059669)),
                              if (isSelected) const SizedBox(width: 4),
                              Text(e.key, style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: isSelected ? const Color(0xFF065F46) : AppColors.textPrimary)),
                            ],
                          ),
                        ),
                      ),
                      InkWell(
                        onTap: () {
                          setState(() => _selectedPlcSplit = e.key);
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Text("$portCount Ports", style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                        ),
                      ),
                      InkWell(
                        onTap: () {
                          setState(() => _selectedPlcSplit = e.key);
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(6),
                          child: Text("-${e.value} dB", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF047857))),
                        ),
                      ),
                    ],
                  );
                }),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPowerStatusBadge(double power) {
    Color bg;
    Color fg;
    String text;

    if (power >= -6.0) {
      bg = const Color(0xFFDCFCE7);
      fg = const Color(0xFF15803D);
      text = "Excellent";
    } else if (power >= -10.0) {
      bg = const Color(0xFFFEF3C7);
      fg = const Color(0xFFD97706);
      text = "Good / Normal";
    } else if (power >= -15.0) {
      bg = const Color(0xFFFFEDD5);
      fg = const Color(0xFFC2410C);
      text = "Moderate / Low";
    } else {
      bg = const Color(0xFFFEE2E2);
      fg = const Color(0xFFDC2626);
      text = "Critical Low";
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Text(
        text,
        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: fg),
      ),
    );
  }
}
