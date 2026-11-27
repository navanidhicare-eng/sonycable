import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../models/customer.dart';
import '../models/fiber_line_model.dart';
import '../services/sound_service.dart';
import '../theme/app_theme.dart';
import '../widgets/optical_power_modal.dart';

class LineDesignScreen extends StatefulWidget {
  final String operatorName;
  final String operatorUid;
  final String? initialLineName;

  const LineDesignScreen({
    super.key,
    required this.operatorName,
    required this.operatorUid,
    this.initialLineName,
  });

  @override
  State<LineDesignScreen> createState() => _LineDesignScreenState();
}

class _LineDesignScreenState extends State<LineDesignScreen> {
  String? _selectedLine;
  String _selectedWdmPort = "Port 1";
  List<String> _wdmPorts = ["Port 1", "Port 2", "Port 3"];
  List<FiberBox> _allBoxesCache = [];

  // Navigation Stack for Folder Drill-Down (Root -> Coupler L1 -> Coupler L2 -> ...)
  final List<FiberBox> _navigationStack = [];

  @override
  void initState() {
    super.initState();
    _selectedLine = widget.initialLineName;
  }

  // Helper to drill down into a box
  void _openBox(FiberBox box) {
    setState(() {
      _navigationStack.add(box);
    });
  }

  // Helper to jump back in the breadcrumb trail
  void _navigateToIndex(int index) {
    setState(() {
      while (_navigationStack.length > index + 1) {
        _navigationStack.removeLast();
      }
    });
  }

  // --- ADD WDM PORT DIALOG ---
  void _showAddWdmPortDialog() {
    final nameCtrl = TextEditingController(text: "Port ${_wdmPorts.length + 1}");
    final powerCtrl = TextEditingController(text: "+20.0");
    final noteCtrl = TextEditingController();
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          title: const Row(
            children: [
              Icon(Icons.router_rounded, color: AppColors.primary, size: 22),
              SizedBox(width: 10),
              Text("Add New WDM / Port", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                "Enter WDM Port name and optional output laser power:",
                style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: nameCtrl,
                textCapitalization: TextCapitalization.words,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                decoration: InputDecoration(
                  labelText: "WDM Port Name *",
                  hintText: "e.g. Port 4, Port 5, or WDM-2",
                  filled: true,
                  fillColor: AppColors.inputBg,
                  prefixIcon: const Icon(Icons.router_rounded, color: AppColors.primary, size: 18),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: powerCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                style: const TextStyle(fontSize: 13),
                decoration: InputDecoration(
                  labelText: "Laser Power (Optional)",
                  hintText: "e.g. +20.0",
                  suffixText: "dBm",
                  filled: true,
                  fillColor: AppColors.inputBg,
                  prefixIcon: const Icon(Icons.bolt_rounded, color: Color(0xFFD97706), size: 18),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteCtrl,
                style: const TextStyle(fontSize: 12),
                decoration: InputDecoration(
                  labelText: "Remarks / Location",
                  hintText: "e.g. Control Room Rack 1",
                  filled: true,
                  fillColor: AppColors.inputBg,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: isSaving ? null : () => Navigator.pop(ctx),
              child: const Text("Cancel", style: TextStyle(color: AppColors.textMuted)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: isSaving
                  ? null
                  : () async {
                      final portName = nameCtrl.text.trim();
                      if (portName.isEmpty) return;

                      setDialogState(() => isSaving = true);
                      try {
                        await FirebaseFirestore.instance.collection('wdm_ports').add({
                          'operatorUid': widget.operatorUid,
                          'name': portName,
                          'power': double.tryParse(powerCtrl.text.trim()),
                          'notes': noteCtrl.text.trim(),
                          'createdAt': FieldValue.serverTimestamp(),
                        });

                        SoundService.playSuccessSound();
                        setState(() {
                          if (!_wdmPorts.contains(portName)) {
                            _wdmPorts.add(portName);
                          }
                          _selectedWdmPort = portName;
                        });

                        if (ctx.mounted) Navigator.pop(ctx);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text("WDM '$portName' added successfully! ✅"),
                              backgroundColor: AppColors.success,
                            ),
                          );
                        }
                      } catch (e) {
                        setDialogState(() => isSaving = false);
                      }
                    },
              child: isSaving
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text("Create WDM Port", style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  // --- TOP ADD BUTTON CHOICE SHEET ---
  void _showAddChoiceDialog(List<FiberBox> allBoxes) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2))),
            ),
            const SizedBox(height: 16),
            const Text(
              "What would you like to add?",
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 14),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.router_rounded, color: Color(0xFF2563EB), size: 22),
              ),
              title: const Text("Add New WDM / Port 🎛️", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              subtitle: const Text("Create another WDM Port (e.g. Port 4, Port 5, or new device)", style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
              trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.textMuted),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: AppColors.border)),
              onTap: () {
                Navigator.pop(ctx);
                _showAddWdmPortDialog();
              },
            ),
            const SizedBox(height: 10),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.alt_route_rounded, color: Color(0xFF059669), size: 22),
              ),
              title: Text("Add Main Coupler for $_selectedWdmPort 📦", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              subtitle: const Text("Add a 1:2, 1:4 or 1:8 primary splitter connected to WDM", style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
              trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppColors.textMuted),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: AppColors.border)),
              onTap: () {
                Navigator.pop(ctx);
                _showAddEditBoxDialog(availableParentBoxes: allBoxes);
              },
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  // --- ADD / EDIT BOX DIALOG ---
  void _showAddEditBoxDialog({
    FiberBox? existingBox,
    FiberBox? defaultParentBox,
    int? defaultParentPortIndex,
    List<FiberBox>? availableParentBoxes,
  }) {
    final isEditing = existingBox != null;
    final nameCtrl = TextEditingController(text: existingBox?.name ?? "");
    final locationCtrl = TextEditingController(text: existingBox?.location ?? (defaultParentBox?.location ?? ""));
    final inputPowerCtrl = TextEditingController(
      text: existingBox?.inputPower != null ? existingBox!.inputPower!.toStringAsFixed(1) : "",
    );
    final outputPowerCtrl = TextEditingController(
      text: existingBox?.outputPower != null ? existingBox!.outputPower!.toStringAsFixed(1) : "",
    );
    final customPortsCtrl = TextEditingController(
      text: existingBox != null && !["1:2", "1:4", "1:8", "1:16"].contains(existingBox.splitterRatio)
          ? existingBox.totalPorts.toString()
          : "8",
    );

    String boxType = existingBox?.boxType ?? "JC";
    String splitterRatio = existingBox?.splitterRatio ?? "1:4";
    String wdmPort = existingBox?.wdmPort ?? (defaultParentBox?.wdmPort ?? _selectedWdmPort);
    String lineName = existingBox?.lineName ?? (defaultParentBox?.lineName ?? (_selectedLine ?? "LINE-1"));

    String? parentBoxId = existingBox?.parentBoxId ?? defaultParentBox?.id;
    int? parentPortIndex = existingBox?.parentPortIndex ?? defaultParentPortIndex;

    String? inputFiberColor = existingBox?.inputFiberColor;
    final inputCableTagCtrl = TextEditingController(text: existingBox?.inputCableTag ?? "");

    bool isSaving = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final validParents = (availableParentBoxes ?? []).where((b) => b.id != existingBox?.id).toList();

            return AlertDialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
              title: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: const BoxDecoration(
                      color: Color(0xFFEFF6FF),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.alt_route_rounded,
                      color: Color(0xFF2563EB),
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isEditing ? "Edit Coupler" : "Add Coupler",
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.textPrimary),
                        ),
                        Text(
                          parentBoxId != null ? "Sub-Coupler under parent" : "Main Coupler • $wdmPort",
                          style: const TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              content: SingleChildScrollView(
                child: SizedBox(
                  width: double.maxFinite,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Coupler Name
                      TextField(
                        controller: nameCtrl,
                        textCapitalization: TextCapitalization.words,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                        decoration: InputDecoration(
                          labelText: "Coupler Name *",
                          hintText: "e.g. Main JC-1, Pole-10 Coupler",
                          filled: true,
                          fillColor: AppColors.inputBg,
                          isDense: true,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Location / Pole Number
                      TextField(
                        controller: locationCtrl,
                        textCapitalization: TextCapitalization.words,
                        style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                        decoration: InputDecoration(
                          labelText: "Location / Pole Number",
                          hintText: "e.g. Pole #14, Near Ramalayam Temple",
                          filled: true,
                          fillColor: AppColors.inputBg,
                          isDense: true,
                          prefixIcon: const Icon(Icons.location_on_outlined, size: 18, color: AppColors.textSecondary),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Splitter Ratio Selector
                      const Text(
                        "Splitter Ratio:",
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        children: ["1:2", "1:4", "1:8", "1:16", "Custom"].map((ratio) {
                          final isSelected = splitterRatio == ratio;
                          return ChoiceChip(
                            label: Text(
                              ratio,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: isSelected ? Colors.white : AppColors.textPrimary,
                              ),
                            ),
                            selected: isSelected,
                            selectedColor: AppColors.primary,
                            backgroundColor: AppColors.inputBg,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                              side: BorderSide(color: isSelected ? AppColors.primary : AppColors.border),
                            ),
                            onSelected: (val) {
                              if (val) setDialogState(() => splitterRatio = ratio);
                            },
                          );
                        }).toList(),
                      ),

                      if (splitterRatio == "Custom") ...[
                        const SizedBox(height: 8),
                        TextField(
                          controller: customPortsCtrl,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: "Number of Output Ports",
                            hintText: "e.g. 6, 12, 24",
                            isDense: true,
                            filled: true,
                            fillColor: AppColors.inputBg,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ],
                      const SizedBox(height: 14),

                      // Optical Power Inputs (Input Power & Output Power)
                      const Text(
                        "Optical Power (dBm):",
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          // Input Power
                          Expanded(
                            child: TextField(
                              controller: inputPowerCtrl,
                              keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                              decoration: InputDecoration(
                                labelText: "Input Power",
                                hintText: "+18.0",
                                floatingLabelBehavior: FloatingLabelBehavior.always,
                                suffixText: "dBm",
                                isDense: true,
                                filled: true,
                                fillColor: AppColors.inputBg,
                                prefixIcon: const Icon(Icons.login_rounded, size: 16, color: Color(0xFF2563EB)),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          // Output Power
                          Expanded(
                            child: TextField(
                              controller: outputPowerCtrl,
                              keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                              decoration: InputDecoration(
                                labelText: "Output Power",
                                hintText: "+11.0",
                                floatingLabelBehavior: FloatingLabelBehavior.always,
                                suffixText: "dBm",
                                isDense: true,
                                filled: true,
                                fillColor: AppColors.inputBg,
                                prefixIcon: const Icon(Icons.logout_rounded, size: 16, color: Color(0xFF059669)),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Feed Source
                      const Text(
                        "Input Feed Source:",
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.inputBg,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String?>(
                            isExpanded: true,
                            value: parentBoxId,
                            hint: Text("Direct from $wdmPort (WDM)", style: const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                            items: [
                              DropdownMenuItem<String?>(
                                value: null,
                                child: Text("Direct from $wdmPort (WDM)", style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.primary)),
                              ),
                              ...validParents.map(
                                (p) => DropdownMenuItem<String?>(
                                  value: p.id,
                                  child: Text("From ${p.name} (${p.splitterRatio})", style: const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                                ),
                              ),
                            ],
                            onChanged: (val) {
                              setDialogState(() {
                                parentBoxId = val;
                                parentPortIndex = val == null ? null : 1;
                              });
                            },
                          ),
                        ),
                      ),

                      if (parentBoxId == null) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.cable_rounded, size: 14, color: AppColors.primary),
                                  const SizedBox(width: 5),
                                  const Text(
                                    "WDM Incoming Fiber Core Color:",
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                  ),
                                  const Spacer(),
                                  if (inputFiberColor != null) ...[
                                    Container(
                                      width: 11,
                                      height: 11,
                                      decoration: BoxDecoration(
                                        color: FiberColorCode.getColor(inputFiberColor),
                                        shape: BoxShape.circle,
                                        border: Border.all(color: Colors.black26, width: 0.8),
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Text(inputFiberColor!, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                                  ] else
                                    const Text("Not Selected", style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppColors.textMuted)),
                                ],
                              ),
                              const SizedBox(height: 6),
                              SizedBox(
                                height: 30,
                                child: ListView.separated(
                                  scrollDirection: Axis.horizontal,
                                  itemCount: FiberColorCode.colors.length,
                                  separatorBuilder: (_, _) => const SizedBox(width: 5),
                                  itemBuilder: (context, idx) {
                                    final item = FiberColorCode.colors[idx];
                                    final name = item['name'] as String;
                                    final col = item['color'] as Color;
                                    final isSel = inputFiberColor == name;
                                    return InkWell(
                                      borderRadius: BorderRadius.circular(6),
                                      onTap: () => setDialogState(() => inputFiberColor = name),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: isSel ? col.withValues(alpha: 0.15) : Colors.white,
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(
                                            color: isSel ? col : Colors.grey.shade300,
                                            width: isSel ? 1.8 : 1,
                                          ),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Container(
                                              width: 9,
                                              height: 9,
                                              decoration: BoxDecoration(
                                                color: col,
                                                shape: BoxShape.circle,
                                                border: Border.all(color: Colors.black26, width: 0.5),
                                              ),
                                            ),
                                            const SizedBox(width: 4),
                                            Text(
                                              name,
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                                                color: isSel ? AppColors.textPrimary : AppColors.textSecondary,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              ),
                              const SizedBox(height: 8),
                              TextField(
                                controller: inputCableTagCtrl,
                                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                                decoration: InputDecoration(
                                  labelText: "Incoming Cable Tag (Optional)",
                                  hintText: "e.g. 12F Main Cable from OLT",
                                  hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.normal),
                                  floatingLabelBehavior: FloatingLabelBehavior.always,
                                  filled: true,
                                  fillColor: Colors.white,
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isSaving ? null : () => Navigator.pop(ctx),
                  child: const Text("Cancel", style: TextStyle(color: AppColors.textMuted)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: isSaving
                      ? null
                      : () async {
                          final name = nameCtrl.text.trim();
                          if (name.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text("Please enter a box name"), backgroundColor: AppColors.danger),
                            );
                            return;
                          }

                          int totalPorts = 8;
                          if (splitterRatio == "1:2") totalPorts = 2;
                          if (splitterRatio == "1:4") totalPorts = 4;
                          if (splitterRatio == "1:8") totalPorts = 8;
                          if (splitterRatio == "1:16") totalPorts = 16;
                          if (splitterRatio == "Custom") {
                            totalPorts = int.tryParse(customPortsCtrl.text.trim()) ?? 8;
                          }

                          double? inPower = double.tryParse(inputPowerCtrl.text.trim());
                          double? outPower = double.tryParse(outputPowerCtrl.text.trim());
                          String? parentName;
                          if (parentBoxId != null) {
                            final parent = validParents.firstWhere(
                              (p) => p.id == parentBoxId,
                              orElse: () => FiberBox(
                                id: '',
                                operatorUid: '',
                                lineName: '',
                                wdmPort: '',
                                name: 'JC',
                                totalPorts: 4,
                                ports: [],
                                createdAt: DateTime.now(),
                              ),
                            );
                            parentName = parent.name;
                          }

                          setDialogState(() => isSaving = true);
                          try {
                            if (isEditing) {
                              List<FiberPortMapping> existingPorts = existingBox.ports;
                              if (existingPorts.length < totalPorts) {
                                for (int i = existingPorts.length + 1; i <= totalPorts; i++) {
                                  existingPorts.add(FiberPortMapping(portIndex: i));
                                }
                              } else if (existingPorts.length > totalPorts) {
                                existingPorts = existingPorts.sublist(0, totalPorts);
                              }

                              await FirebaseFirestore.instance.collection('fiber_boxes').doc(existingBox.id).update({
                                'name': name,
                                'location': locationCtrl.text.trim(),
                                'boxType': boxType,
                                'splitterRatio': splitterRatio,
                                'totalPorts': totalPorts,
                                'parentBoxId': parentBoxId,
                                'parentBoxName': parentName,
                                'parentPortIndex': parentPortIndex,
                                'inputPower': inPower,
                                'outputPower': outPower,
                                'inputFiberColor': parentBoxId == null ? inputFiberColor : null,
                                'inputCableTag': parentBoxId == null && inputCableTagCtrl.text.trim().isNotEmpty ? inputCableTagCtrl.text.trim() : null,
                                'ports': existingPorts.map((p) => p.toMap()).toList(),
                                'updatedAt': FieldValue.serverTimestamp(),
                              });
                            } else {
                              List<FiberPortMapping> initialPorts = [];
                              for (int i = 1; i <= totalPorts; i++) {
                                initialPorts.add(FiberPortMapping(portIndex: i));
                              }

                              final newBox = FiberBox(
                                id: '',
                                operatorUid: widget.operatorUid,
                                lineName: lineName,
                                wdmPort: wdmPort,
                                name: name,
                                location: locationCtrl.text.trim(),
                                boxType: boxType,
                                splitterRatio: splitterRatio,
                                totalPorts: totalPorts,
                                parentBoxId: parentBoxId,
                                parentBoxName: parentName,
                                parentPortIndex: parentPortIndex,
                                inputPower: inPower,
                                outputPower: outPower,
                                inputFiberColor: parentBoxId == null ? inputFiberColor : null,
                                inputCableTag: parentBoxId == null && inputCableTagCtrl.text.trim().isNotEmpty ? inputCableTagCtrl.text.trim() : null,
                                ports: initialPorts,
                                createdAt: DateTime.now(),
                              );

                              final docRef = await FirebaseFirestore.instance.collection('fiber_boxes').add(newBox.toMap());

                              // If created under a parent box port, link parent port as well!
                              if (defaultParentBox != null && defaultParentPortIndex != null) {
                                final updatedParentPorts = defaultParentBox.ports.map((p) {
                                  if (p.portIndex == defaultParentPortIndex) {
                                    return FiberPortMapping(
                                      portIndex: defaultParentPortIndex,
                                      status: 'subbox',
                                      subBoxId: docRef.id,
                                      subBoxName: name,
                                    );
                                  }
                                  return p;
                                }).toList();

                                await FirebaseFirestore.instance.collection('fiber_boxes').doc(defaultParentBox.id).update({
                                  'ports': updatedParentPorts.map((p) => p.toMap()).toList(),
                                  'updatedAt': FieldValue.serverTimestamp(),
                                });
                              }
                            }

                            SoundService.playSuccessSound();
                            if (ctx.mounted) Navigator.pop(ctx);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(isEditing ? "Coupler updated! ✅" : "Coupler '$name' created! ✅"),
                                  backgroundColor: AppColors.success,
                                ),
                              );
                            }
                          } catch (e) {
                            setDialogState(() => isSaving = false);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text("Error: $e"), backgroundColor: AppColors.danger),
                              );
                            }
                          }
                        },
                  child: isSaving
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Text(isEditing ? "Save Changes" : "Create Coupler", style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // --- DELETE BOX DIALOG ---
  void _confirmDeleteBox(FiberBox box) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text("Delete Coupler?", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: AppColors.danger)),
        content: Text(
          box.customerPortsCount > 0
              ? "Coupler '${box.name}' has ${box.customerPortsCount} connected customers. Deleting it will unlink these customers. Continue?"
              : "Are you sure you want to delete '${box.name}'?",
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Cancel")),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await FirebaseFirestore.instance.collection('fiber_boxes').doc(box.id).delete();

                // If currently open in navigation stack, pop it
                if (_navigationStack.isNotEmpty && _navigationStack.last.id == box.id) {
                  setState(() => _navigationStack.removeLast());
                }

                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text("Coupler '${box.name}' deleted."), backgroundColor: AppColors.textSecondary),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text("Error: $e"), backgroundColor: AppColors.danger),
                  );
                }
              }
            },
            child: const Text("Delete"),
          ),
        ],
      ),
    );
  }

  // --- CONNECT PORT DIALOG (CUSTOMER OR SUB-COUPLER) ---
  void _showPortActionDialog({
    required FiberBox box,
    required FiberPortMapping port,
    required List<Customer> lineCustomers,
    required List<FiberBox> allBoxes,
  }) {
    Customer? selectedCustomer;
    String actionType = port.isSubBox ? "SUBBOX" : "CUSTOMER";
    FiberBox? existingSubBox;
    if (port.isCustomer && port.customerId != null) {
      selectedCustomer = lineCustomers.where((c) => c.id == port.customerId).firstOrNull;
    }
    if (port.isSubBox && port.subBoxId != null) {
      existingSubBox = allBoxes.where((b) => b.id == port.subBoxId).firstOrNull;
    }

    final powerCtrl = TextEditingController(
      text: port.opticalPower != null ? port.opticalPower!.toStringAsFixed(1) : "-6.0",
    );
    final noteCtrl = TextEditingController(text: port.notes ?? "");
    String searchCustText = "";

    final newSubBoxNameCtrl = TextEditingController(
      text: existingSubBox?.name ?? (port.subBoxName ?? ""),
    );
    final newSubBoxLocCtrl = TextEditingController(
      text: existingSubBox?.location ?? "",
    );
    String newSubBoxRatio = existingSubBox?.splitterRatio ?? "1:4";
    String newSubBoxType = existingSubBox?.boxType ?? "JC";

    final newSubBoxInPowerCtrl = TextEditingController(
      text: existingSubBox?.inputPower != null
          ? existingSubBox!.inputPower!.toStringAsFixed(1)
          : (port.opticalPower != null ? port.opticalPower!.toStringAsFixed(1) : ""),
    );
    final newSubBoxOutPowerCtrl = TextEditingController(
      text: existingSubBox?.outputPower != null ? existingSubBox!.outputPower!.toStringAsFixed(1) : "",
    );

    String selectedCouplerColor = port.couplerColor ?? FiberColorCode.getDefaultCouplerColor(port.portIndex);
    String selectedFiberCoreColor = port.fiberCoreColor ?? "";
    final cableTagCtrl = TextEditingController(text: port.cableTag ?? "");
    String custFilterArea = "ALL";

    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setPortDialogState) {
            final lineMatchCount = lineCustomers.where((c) => c.area.trim().toLowerCase() == box.lineName.trim().toLowerCase()).length;
            final baseList = custFilterArea == "LINE"
                ? lineCustomers.where((c) => c.area.trim().toLowerCase() == box.lineName.trim().toLowerCase()).toList()
                : lineCustomers;

            final filteredCusts = baseList.where((c) {
              if (searchCustText.isEmpty) return true;
              final q = searchCustText.toLowerCase();
              return c.name.toLowerCase().contains(q) ||
                  c.customerId.toLowerCase().contains(q) ||
                  (c.stbId ?? '').toLowerCase().contains(q) ||
                  c.area.toLowerCase().contains(q) ||
                  c.mobile.contains(q);
            }).toList();

            return AlertDialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
              title: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(7),
                    decoration: BoxDecoration(
                      color: AppColors.primaryBg,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.settings_input_composite_rounded, color: AppColors.primary, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Port #${port.portIndex} Setup",
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.textPrimary),
                        ),
                        Text(
                          "${box.name} (${box.splitterRatio})",
                          style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              content: SingleChildScrollView(
                child: SizedBox(
                  width: double.maxFinite,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Choice: Connect Customer vs Feed Another Coupler
                      Row(
                        children: [
                          Expanded(
                            child: ChoiceChip(
                              label: const Center(child: Text("Customer Drop 🏠", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold))),
                              selected: actionType == "CUSTOMER",
                              selectedColor: AppColors.primary,
                              labelStyle: TextStyle(color: actionType == "CUSTOMER" ? Colors.white : AppColors.textPrimary),
                              onSelected: (val) {
                                if (val) setPortDialogState(() => actionType = "CUSTOMER");
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: ChoiceChip(
                              label: const Center(child: Text("Sub-Coupler 🔀", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold))),
                              selected: actionType == "SUBBOX",
                              selectedColor: const Color(0xFF2563EB),
                              labelStyle: TextStyle(color: actionType == "SUBBOX" ? Colors.white : AppColors.textPrimary),
                              onSelected: (val) {
                                if (val) setPortDialogState(() => actionType = "SUBBOX");
                              },
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      if (actionType == "CUSTOMER") ...[
                        Row(
                          children: [
                            Text(
                              "Select Customer (${filteredCusts.length}):",
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                            ),
                            const Spacer(),
                            if (lineMatchCount > 0)
                              InkWell(
                                onTap: () => setPortDialogState(() => custFilterArea = custFilterArea == "ALL" ? "LINE" : "ALL"),
                                borderRadius: BorderRadius.circular(6),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                                  decoration: BoxDecoration(
                                    color: custFilterArea == "ALL" ? const Color(0xFFEFF6FF) : const Color(0xFFFEF3C7),
                                    borderRadius: BorderRadius.circular(6),
                                    border: Border.all(color: custFilterArea == "ALL" ? const Color(0xFFBFDBFE) : const Color(0xFFFDE68A)),
                                  ),
                                  child: Text(
                                    custFilterArea == "ALL" ? "All (${lineCustomers.length}) 🔄" : "${box.lineName} ($lineMatchCount) 🔄",
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.bold,
                                      color: custFilterArea == "ALL" ? const Color(0xFF1D4ED8) : const Color(0xFFD97706),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        TextField(
                          onChanged: (v) => setPortDialogState(() => searchCustText = v.trim()),
                          style: const TextStyle(fontSize: 13),
                          decoration: InputDecoration(
                            hintText: "Search Name, ID, STB, Mobile, Area...",
                            hintStyle: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                            prefixIcon: const Icon(Icons.search, size: 18, color: AppColors.textMuted),
                            filled: true,
                            fillColor: AppColors.inputBg,
                            isDense: true,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                          ),
                        ),
                        const SizedBox(height: 8),

                        Container(
                          height: 200,
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.border),
                            borderRadius: BorderRadius.circular(10),
                            color: Colors.white,
                          ),
                          child: filteredCusts.isEmpty
                              ? const Center(child: Text("No customers found", style: TextStyle(color: AppColors.textMuted, fontSize: 12)))
                              : ListView.separated(
                                  itemCount: filteredCusts.length,
                                  separatorBuilder: (context, _) => const Divider(height: 1),
                                  itemBuilder: (context, idx) {
                                    final c = filteredCusts[idx];
                                    final isSelected = selectedCustomer?.id == c.id;
                                    return ListTile(
                                      dense: true,
                                      selected: isSelected,
                                      selectedTileColor: AppColors.primaryBg,
                                      title: Text(
                                        c.name,
                                        style: TextStyle(
                                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                                          fontSize: 13,
                                          color: isSelected ? AppColors.primary : AppColors.textPrimary,
                                        ),
                                      ),
                                      subtitle: Text(
                                        "ID: ${c.customerId} • ${c.stbId ?? 'No STB'} • 📱 ${c.mobile}${c.area.isNotEmpty ? ' • 📍 ${c.area}' : ''}",
                                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                      ),
                                      trailing: isSelected
                                          ? const Icon(Icons.check_circle_rounded, color: AppColors.primary, size: 18)
                                          : null,
                                      onTap: () {
                                        setPortDialogState(() {
                                          selectedCustomer = c;
                                          if (c.opticalPower != null) {
                                            powerCtrl.text = c.opticalPower!.toStringAsFixed(1);
                                          }
                                        });
                                      },
                                    );
                                  },
                                ),
                        ),
                        const SizedBox(height: 12),

                        // Optical Power Input
                        const Text(
                          "Optical Power (dBm):",
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: powerCtrl,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                decoration: InputDecoration(
                                  hintText: "-6.0",
                                  suffixText: "dBm",
                                  filled: true,
                                  fillColor: AppColors.inputBg,
                                  isDense: true,
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                onChanged: (val) => setPortDialogState(() {}),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Builder(
                              builder: (context) {
                                final pVal = double.tryParse(powerCtrl.text.trim());
                                if (pVal == null) return const SizedBox.shrink();
                                return Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: OpticalPowerConfig.getStatusBgColor(pVal),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: OpticalPowerConfig.getStatusBorderColor(pVal)),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(OpticalPowerConfig.getStatusIcon(pVal), color: OpticalPowerConfig.getStatusColor(pVal), size: 14),
                                      const SizedBox(width: 4),
                                      Text(
                                        OpticalPowerConfig.getStatus(pVal),
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12,
                                          color: OpticalPowerConfig.getStatusColor(pVal),
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                          ],
                        ),
                      ] else ...[
                        // Sub-Coupler Setup Form
                        TextField(
                          controller: newSubBoxNameCtrl,
                          textCapitalization: TextCapitalization.words,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                          decoration: InputDecoration(
                            labelText: "Coupler Name (Optional)",
                            hintText: "e.g. ${box.name}-JC-P${port.portIndex}",
                            hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.normal),
                            floatingLabelBehavior: FloatingLabelBehavior.always,
                            filled: true,
                            fillColor: AppColors.inputBg,
                            isDense: true,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                        const SizedBox(height: 10),

                        const Text(
                          "Splitter Ratio:",
                          style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: ["1:2", "1:4", "1:8", "1:16"].map((r) {
                            final isSel = newSubBoxRatio == r;
                            return ChoiceChip(
                              label: Text(r, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: isSel ? Colors.white : AppColors.textPrimary)),
                              selected: isSel,
                              selectedColor: const Color(0xFF2563EB),
                              onSelected: (v) {
                                if (v) setPortDialogState(() => newSubBoxRatio = r);
                              },
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 10),

                        TextField(
                          controller: newSubBoxLocCtrl,
                          style: const TextStyle(fontSize: 12, color: AppColors.textPrimary),
                          decoration: InputDecoration(
                            labelText: "Location / Pole Number",
                            hintText: "e.g. Pole #18, Main Street",
                            hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.normal),
                            floatingLabelBehavior: FloatingLabelBehavior.always,
                            filled: true,
                            fillColor: AppColors.inputBg,
                            isDense: true,
                            prefixIcon: const Icon(Icons.location_on_outlined, size: 16, color: AppColors.textSecondary),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                        const SizedBox(height: 12),

                        const Text(
                          "Optical Power (dBm):",
                          style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: newSubBoxInPowerCtrl,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                decoration: InputDecoration(
                                  labelText: "Input Power",
                                  hintText: "+11.0",
                                  hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.normal),
                                  floatingLabelBehavior: FloatingLabelBehavior.always,
                                  suffixText: "dBm",
                                  isDense: true,
                                  filled: true,
                                  fillColor: AppColors.inputBg,
                                  prefixIcon: const Icon(Icons.login_rounded, size: 15, color: Color(0xFF2563EB)),
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextField(
                                controller: newSubBoxOutPowerCtrl,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                decoration: InputDecoration(
                                  labelText: "Output Power",
                                  hintText: "+3.5",
                                  hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.normal),
                                  floatingLabelBehavior: FloatingLabelBehavior.always,
                                  suffixText: "dBm",
                                  isDense: true,
                                  filled: true,
                                  fillColor: AppColors.inputBg,
                                  prefixIcon: const Icon(Icons.logout_rounded, size: 15, color: Color(0xFF059669)),
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],

                      const SizedBox(height: 12),

                      // Fiber Splicing & Joint Colors
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.cable_rounded, size: 14, color: AppColors.primary),
                                SizedBox(width: 5),
                                Text(
                                  "Fiber Splicing & Joint Colors",
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),

                            // 1. Coupler Out Color
                            Row(
                              children: [
                                const Text("Coupler Leg Color: ", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                                Container(
                                  width: 11,
                                  height: 11,
                                  decoration: BoxDecoration(
                                    color: FiberColorCode.getColor(selectedCouplerColor),
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.black26, width: 0.8),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                Text(selectedCouplerColor, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                              ],
                            ),
                            const SizedBox(height: 5),
                            SizedBox(
                              height: 30,
                              child: ListView.separated(
                                scrollDirection: Axis.horizontal,
                                itemCount: FiberColorCode.colors.length,
                                separatorBuilder: (_, _) => const SizedBox(width: 5),
                                itemBuilder: (context, idx) {
                                  final item = FiberColorCode.colors[idx];
                                  final name = item['name'] as String;
                                  final col = item['color'] as Color;
                                  final isSel = selectedCouplerColor == name;
                                  return InkWell(
                                    borderRadius: BorderRadius.circular(6),
                                    onTap: () => setPortDialogState(() => selectedCouplerColor = name),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: isSel ? col.withValues(alpha: 0.15) : Colors.white,
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(
                                          color: isSel ? col : Colors.grey.shade300,
                                          width: isSel ? 1.8 : 1,
                                        ),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Container(
                                            width: 9,
                                            height: 9,
                                            decoration: BoxDecoration(
                                              color: col,
                                              shape: BoxShape.circle,
                                              border: Border.all(color: Colors.black26, width: 0.5),
                                            ),
                                          ),
                                          const SizedBox(width: 4),
                                          Text(
                                            name,
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                                              color: isSel ? AppColors.textPrimary : AppColors.textSecondary,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),

                            const Divider(height: 14),

                            // 2. Spliced Fiber Core Color
                            Row(
                              children: [
                                const Text("Spliced Cable Core: ", style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSecondary)),
                                if (selectedFiberCoreColor.isNotEmpty) ...[
                                  Container(
                                    width: 11,
                                    height: 11,
                                    decoration: BoxDecoration(
                                      color: FiberColorCode.getColor(selectedFiberCoreColor),
                                      shape: BoxShape.circle,
                                      border: Border.all(color: Colors.black26, width: 0.8),
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  Text(selectedFiberCoreColor, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                                ] else
                                  const Text("Not Selected", style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppColors.textMuted)),
                              ],
                            ),
                            const SizedBox(height: 5),
                            SizedBox(
                              height: 30,
                              child: ListView.separated(
                                scrollDirection: Axis.horizontal,
                                itemCount: FiberColorCode.colors.length,
                                separatorBuilder: (_, _) => const SizedBox(width: 5),
                                itemBuilder: (context, idx) {
                                  final item = FiberColorCode.colors[idx];
                                  final name = item['name'] as String;
                                  final col = item['color'] as Color;
                                  final isSel = selectedFiberCoreColor == name;
                                  return InkWell(
                                    borderRadius: BorderRadius.circular(6),
                                    onTap: () => setPortDialogState(() => selectedFiberCoreColor = name),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: isSel ? col.withValues(alpha: 0.15) : Colors.white,
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(
                                          color: isSel ? col : Colors.grey.shade300,
                                          width: isSel ? 1.8 : 1,
                                        ),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Container(
                                            width: 9,
                                            height: 9,
                                            decoration: BoxDecoration(
                                              color: col,
                                              shape: BoxShape.circle,
                                              border: Border.all(color: Colors.black26, width: 0.5),
                                            ),
                                          ),
                                          const SizedBox(width: 4),
                                          Text(
                                            name,
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: isSel ? FontWeight.bold : FontWeight.normal,
                                              color: isSel ? AppColors.textPrimary : AppColors.textSecondary,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),

                            const SizedBox(height: 10),
                            TextField(
                              controller: cableTagCtrl,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                              decoration: InputDecoration(
                                labelText: "Cable Tag (Optional)",
                                hintText: "e.g. 4F Main Cable, Drop Wire",
                                hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.normal),
                                floatingLabelBehavior: FloatingLabelBehavior.always,
                                filled: true,
                                fillColor: Colors.white,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 12),
                      TextField(
                        controller: noteCtrl,
                        style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                        decoration: InputDecoration(
                          labelText: "Optional Note / Remarks",
                          hintText: "e.g. Drop wire replaced, new fiber joint",
                          hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12, fontWeight: FontWeight.normal),
                          floatingLabelBehavior: FloatingLabelBehavior.always,
                          filled: true,
                          fillColor: AppColors.inputBg,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                if (!port.isEmpty)
                  TextButton(
                    onPressed: isSaving
                        ? null
                        : () async {
                            setPortDialogState(() => isSaving = true);
                            try {
                              final updatedPorts = box.ports.map((p) {
                                if (p.portIndex == port.portIndex) {
                                  return FiberPortMapping(portIndex: port.portIndex, status: 'empty');
                                }
                                return p;
                              }).toList();

                              await FirebaseFirestore.instance.collection('fiber_boxes').doc(box.id).update({
                                'ports': updatedPorts.map((p) => p.toMap()).toList(),
                                'updatedAt': FieldValue.serverTimestamp(),
                              });

                              if (port.customerId != null) {
                                await FirebaseFirestore.instance.collection('customers').doc(port.customerId).update({
                                  'fiberBoxId': FieldValue.delete(),
                                  'fiberBoxName': FieldValue.delete(),
                                  'fiberPortIndex': FieldValue.delete(),
                                });
                              }

                              if (ctx.mounted) Navigator.pop(ctx);
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text("Port #${port.portIndex} cleared!"), backgroundColor: AppColors.textSecondary),
                                );
                              }
                            } catch (e) {
                              setPortDialogState(() => isSaving = false);
                            }
                          },
                    child: const Text("Clear Port", style: TextStyle(color: AppColors.danger)),
                  ),

                TextButton(
                  onPressed: isSaving ? null : () => Navigator.pop(ctx),
                  child: const Text("Cancel", style: TextStyle(color: AppColors.textMuted)),
                ),

                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: isSaving
                      ? null
                      : () async {
                          if (actionType == "CUSTOMER" && selectedCustomer == null) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text("Please select a customer"), backgroundColor: AppColors.danger),
                            );
                            return;
                          }
                          setPortDialogState(() => isSaving = true);
                          try {
                            final parsedPower = double.tryParse(powerCtrl.text.trim());
                            final note = noteCtrl.text.trim();

                            FiberPortMapping newPortMapping;
                            if (actionType == "CUSTOMER") {
                              newPortMapping = FiberPortMapping(
                                portIndex: port.portIndex,
                                status: 'customer',
                                customerId: selectedCustomer!.id,
                                customerName: selectedCustomer!.name,
                                customerPhone: selectedCustomer!.mobile,
                                customerStbId: selectedCustomer!.stbId ?? selectedCustomer!.customerId,
                                opticalPower: parsedPower,
                                notes: note.isNotEmpty ? note : null,
                                couplerColor: selectedCouplerColor,
                                fiberCoreColor: selectedFiberCoreColor.isNotEmpty ? selectedFiberCoreColor : null,
                                cableTag: cableTagCtrl.text.trim().isNotEmpty ? cableTagCtrl.text.trim() : null,
                              );

                              final custUpdate = <String, dynamic>{
                                'fiberBoxId': box.id,
                                'fiberBoxName': box.name,
                                'fiberPortIndex': port.portIndex,
                              };
                              if (parsedPower != null) {
                                custUpdate['opticalPower'] = parsedPower;
                                custUpdate['opticalPowerDate'] = FieldValue.serverTimestamp();
                                custUpdate['opticalPowerUpdatedBy'] = widget.operatorName;
                                if (note.isNotEmpty) custUpdate['opticalPowerRemarks'] = note;
                              }
                              await FirebaseFirestore.instance.collection('customers').doc(selectedCustomer!.id).update(custUpdate);

                              if (parsedPower != null) {
                                await FirebaseFirestore.instance
                                    .collection('customers')
                                    .doc(selectedCustomer!.id)
                                    .collection('optical_power_history')
                                    .add({
                                  'power': parsedPower,
                                  'date': FieldValue.serverTimestamp(),
                                  'updatedBy': widget.operatorName,
                                  'remarks': note.isNotEmpty ? note : "Assigned to ${box.name} Port #${port.portIndex}",
                                  'boxId': box.id,
                                  'boxName': box.name,
                                  'portIndex': port.portIndex,
                                });
                              }
                            } else {
                              // SUB-BOX / COUPLER
                              String subId = "";
                              final subName = newSubBoxNameCtrl.text.trim().isNotEmpty
                                  ? newSubBoxNameCtrl.text.trim()
                                  : "${box.name}-JC-P${port.portIndex}";
                              final subInPower = double.tryParse(newSubBoxInPowerCtrl.text.trim());
                              final subOutPower = double.tryParse(newSubBoxOutPowerCtrl.text.trim());

                              int newTotal = 4;
                              if (newSubBoxRatio == "1:2") newTotal = 2;
                              if (newSubBoxRatio == "1:4") newTotal = 4;
                              if (newSubBoxRatio == "1:8") newTotal = 8;
                              if (newSubBoxRatio == "1:16") newTotal = 16;

                              if (port.isSubBox && port.subBoxId != null && existingSubBox != null) {
                                subId = existingSubBox.id;
                                final updateMap = <String, dynamic>{
                                  'name': subName,
                                  'splitterRatio': newSubBoxRatio,
                                  'location': newSubBoxLocCtrl.text.trim(),
                                  'parentBoxId': box.id,
                                  'parentBoxName': box.name,
                                  'parentPortIndex': port.portIndex,
                                };
                                if (subInPower != null) updateMap['inputPower'] = subInPower;
                                if (subOutPower != null) updateMap['outputPower'] = subOutPower;

                                await FirebaseFirestore.instance.collection('fiber_boxes').doc(subId).update(updateMap);
                              } else {
                                List<FiberPortMapping> initPorts = [];
                                for (int i = 1; i <= newTotal; i++) {
                                  initPorts.add(FiberPortMapping(portIndex: i));
                                }

                                final newChild = FiberBox(
                                  id: '',
                                  operatorUid: widget.operatorUid,
                                  lineName: box.lineName,
                                  wdmPort: box.wdmPort,
                                  name: subName,
                                  location: newSubBoxLocCtrl.text.trim(),
                                  boxType: newSubBoxType,
                                  splitterRatio: newSubBoxRatio,
                                  totalPorts: newTotal,
                                  parentBoxId: box.id,
                                  parentBoxName: box.name,
                                  parentPortIndex: port.portIndex,
                                  inputPower: subInPower,
                                  outputPower: subOutPower,
                                  ports: initPorts,
                                  createdAt: DateTime.now(),
                                );

                                final docRef = await FirebaseFirestore.instance.collection('fiber_boxes').add(newChild.toMap());
                                subId = docRef.id;
                              }

                              newPortMapping = FiberPortMapping(
                                portIndex: port.portIndex,
                                status: 'subbox',
                                subBoxId: subId,
                                subBoxName: subName,
                                opticalPower: subInPower,
                                notes: note.isNotEmpty ? note : null,
                                couplerColor: selectedCouplerColor,
                                fiberCoreColor: selectedFiberCoreColor.isNotEmpty ? selectedFiberCoreColor : null,
                                cableTag: cableTagCtrl.text.trim().isNotEmpty ? cableTagCtrl.text.trim() : null,
                              );
                            }

                            final updatedPorts = box.ports.map((p) {
                              if (p.portIndex == port.portIndex) return newPortMapping;
                              return p;
                            }).toList();

                            await FirebaseFirestore.instance.collection('fiber_boxes').doc(box.id).update({
                              'ports': updatedPorts.map((p) => p.toMap()).toList(),
                              'updatedAt': FieldValue.serverTimestamp(),
                            });

                            SoundService.playSuccessSound();
                            if (ctx.mounted) Navigator.pop(ctx);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text("Port #${port.portIndex} updated successfully! ✅"),
                                  backgroundColor: AppColors.success,
                                ),
                              );
                            }
                          } catch (e) {
                            setPortDialogState(() => isSaving = false);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text("Error: $e"), backgroundColor: AppColors.danger),
                              );
                            }
                          }
                        },
                  child: isSaving
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text("Save Port", style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _navigationStack.isEmpty,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _navigationStack.isNotEmpty) {
          setState(() {
            _navigationStack.removeLast();
          });
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 20),
            onPressed: () {
              if (_navigationStack.isNotEmpty) {
                setState(() => _navigationStack.removeLast());
              } else {
                Navigator.pop(context);
              }
            },
          ),
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _navigationStack.isEmpty
                    ? "Line Design & Fiber Map"
                    : _navigationStack.last.name,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: AppColors.textPrimary),
              ),
              Text(
                _navigationStack.isEmpty
                    ? "WDM Port ➡️ Main Coupler (Level 1)"
                    : "Level ${_navigationStack.length} • ${_navigationStack.last.splitterRatio} Splitter",
                style: const TextStyle(fontSize: 10.5, color: AppColors.textMuted, fontWeight: FontWeight.w500),
              ),
            ],
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.add_circle_outline_rounded, color: AppColors.primary, size: 26),
              tooltip: _navigationStack.isEmpty ? "Add Coupler or WDM" : "Add Sub-Coupler",
              onPressed: () {
                if (_navigationStack.isEmpty) {
                  _showAddChoiceDialog(_allBoxesCache);
                } else {
                  _showAddEditBoxDialog(
                    defaultParentBox: _navigationStack.last,
                    availableParentBoxes: _allBoxesCache,
                  );
                }
              },
            ),
            const SizedBox(width: 4),
          ],
        ),
        body: StreamBuilder<QuerySnapshot>(
          stream: FirebaseFirestore.instance.collection('areas').where('operatorUid', isEqualTo: widget.operatorUid).snapshots(),
          builder: (context, areaSnap) {
            final areaDocs = areaSnap.hasData ? areaSnap.data!.docs : [];
            final List<String> lineNames = areaDocs
                .map<String>((d) => (d.data() as Map<String, dynamic>)['name']?.toString() ?? d.id)
                .toList();

            if (_selectedLine == null && lineNames.isNotEmpty) {
              _selectedLine = lineNames.first;
            }

            return StreamBuilder<QuerySnapshot>(
              stream: FirebaseFirestore.instance.collection('customers').snapshots(),
              builder: (context, custSnap) {
                final allCustomers = custSnap.hasData
                    ? custSnap.data!.docs.map((d) => Customer.fromFirestore(d)).toList()
                    : <Customer>[];

                return StreamBuilder<QuerySnapshot>(
                  stream: FirebaseFirestore.instance
                      .collection('fiber_boxes')
                      .where('operatorUid', isEqualTo: widget.operatorUid)
                      .snapshots(),
                  builder: (context, boxSnap) {
                    if (boxSnap.hasError) {
                      return Center(child: Text("Error loading boxes: ${boxSnap.error}"));
                    }
                    if (!boxSnap.hasData) {
                      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
                    }

                    final allBoxes = boxSnap.data!.docs.map((d) => FiberBox.fromFirestore(d)).toList();
                    _allBoxesCache = allBoxes;

                    return StreamBuilder<QuerySnapshot>(
                      stream: FirebaseFirestore.instance
                          .collection('wdm_ports')
                          .where('operatorUid', isEqualTo: widget.operatorUid)
                          .snapshots(),
                      builder: (context, wdmSnap) {
                        final customWdmDocs = wdmSnap.hasData ? wdmSnap.data!.docs : [];
                        final customWdmNames = customWdmDocs
                            .map((d) => (d.data() as Map<String, dynamic>)['name']?.toString() ?? '')
                            .where((s) => s.isNotEmpty)
                            .toList();

                        final Set<String> allPortNames = {"Port 1", "Port 2", "Port 3"};
                        allPortNames.addAll(customWdmNames);
                        for (final b in allBoxes) {
                          if (b.wdmPort.isNotEmpty) allPortNames.add(b.wdmPort);
                        }
                        _wdmPorts = allPortNames.toList();
                        if (!_wdmPorts.contains(_selectedWdmPort)) {
                          _selectedWdmPort = _wdmPorts.first;
                        }

                        // Root level boxes for the active WDM port
                        final rootBoxes = allBoxes.where((b) {
                          final matchLine = _selectedLine == null || b.lineName.toLowerCase() == _selectedLine!.toLowerCase();
                          final matchWdm = b.wdmPort == _selectedWdmPort;
                          return matchLine && matchWdm && b.isDirectFromWdm;
                        }).toList();

                        // If drilled into a coupler, resolve current active box from fresh Firestore data
                        FiberBox? activeBox;
                        if (_navigationStack.isNotEmpty) {
                          final targetId = _navigationStack.last.id;
                          activeBox = allBoxes.where((b) => b.id == targetId).firstOrNull;
                          if (activeBox == null) {
                            // Box was deleted
                            WidgetsBinding.instance.addPostFrameCallback((_) {
                              setState(() => _navigationStack.removeLast());
                            });
                            return const Center(child: CircularProgressIndicator());
                          }
                        }

                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // BREADCRUMB NAVIGATION TRAIL (ALWAYS VISIBLE & CLICKABLE)
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              decoration: const BoxDecoration(
                                color: Colors.white,
                                border: Border(bottom: BorderSide(color: AppColors.border)),
                              ),
                              child: SingleChildScrollView(
                                scrollDirection: Axis.horizontal,
                                child: Row(
                                  children: [
                                    // Home / WDM Port Pill
                                    InkWell(
                                      onTap: () => setState(() => _navigationStack.clear()),
                                      borderRadius: BorderRadius.circular(6),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: _navigationStack.isEmpty ? AppColors.primary : AppColors.inputBg,
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Row(
                                          children: [
                                            Icon(Icons.router_rounded, size: 13, color: _navigationStack.isEmpty ? Colors.white : AppColors.textSecondary),
                                            const SizedBox(width: 4),
                                            Text(
                                              "$_selectedWdmPort (WDM)",
                                              style: TextStyle(
                                                fontSize: 11.5,
                                                fontWeight: FontWeight.bold,
                                                color: _navigationStack.isEmpty ? Colors.white : AppColors.textPrimary,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),

                                    // Stack Trail Items
                                    for (int i = 0; i < _navigationStack.length; i++) ...[
                                      const Padding(
                                        padding: EdgeInsets.symmetric(horizontal: 4),
                                        child: Icon(Icons.chevron_right_rounded, size: 16, color: AppColors.textMuted),
                                      ),
                                      InkWell(
                                        onTap: () => _navigateToIndex(i),
                                        borderRadius: BorderRadius.circular(6),
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: i == _navigationStack.length - 1 ? const Color(0xFF2563EB) : AppColors.inputBg,
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            _navigationStack[i].name,
                                            style: TextStyle(
                                              fontSize: 11.5,
                                              fontWeight: FontWeight.bold,
                                              color: i == _navigationStack.length - 1 ? Colors.white : AppColors.textPrimary,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),

                            // MAIN BODY: Either ROOT VIEW (WDM Ports + L1 Couplers) OR DRILL-DOWN COUPLER VIEW
                            Expanded(
                              child: _navigationStack.isEmpty
                                  ? _buildRootWdmView(
                                      lineNames: lineNames,
                                      rootBoxes: rootBoxes,
                                      allBoxes: allBoxes,
                                    )
                                  : _buildInsideCouplerView(
                                      box: activeBox!,
                                      allBoxes: allBoxes,
                                      lineCustomers: allCustomers,
                                    ),
                            ),
                          ],
                        );
                      },
                    );
                  },
                );
              },
            );
          },
        ),
      ),
    );
  }

  // --- 1. ROOT VIEW: SELECT LINE, WDM PORTS, AND MAIN LEVEL-1 COUPLERS ---
  Widget _buildRootWdmView({
    required List<String> lineNames,
    required List<FiberBox> rootBoxes,
    required List<FiberBox> allBoxes,
  }) {
    return Column(
      children: [
        // Top Line Selector & WDM Tabs
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Line Selector
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primaryBg,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.location_on, size: 14, color: AppColors.primary),
                        SizedBox(width: 4),
                        Text("LINE:", style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                      decoration: BoxDecoration(
                        color: AppColors.inputBg,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          isExpanded: true,
                          value: lineNames.contains(_selectedLine) ? _selectedLine : (lineNames.isNotEmpty ? lineNames.first : null),
                          hint: const Text("Select Line / Area", style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
                          items: lineNames.map<DropdownMenuItem<String>>(
                            (name) => DropdownMenuItem<String>(
                              value: name,
                              child: Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                            ),
                          ).toList(),
                          onChanged: (val) {
                            if (val != null) setState(() => _selectedLine = val);
                          },
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Dynamic WDM Ports Tabs + Quick Add Button
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                child: Row(
                  children: [
                    ..._wdmPorts.map((portName) {
                      final isSelected = _selectedWdmPort == portName;
                      final portRootCount = allBoxes.where((b) {
                        final matchLine = _selectedLine == null || b.lineName.toLowerCase() == _selectedLine!.toLowerCase();
                        return matchLine && b.wdmPort == portName && b.isDirectFromWdm;
                      }).length;

                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: InkWell(
                          onTap: () => setState(() => _selectedWdmPort = portName),
                          borderRadius: BorderRadius.circular(10),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            constraints: const BoxConstraints(minWidth: 105),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: isSelected ? AppColors.primary : AppColors.inputBg,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isSelected ? AppColors.primary : AppColors.border,
                                width: isSelected ? 1.5 : 1,
                              ),
                            ),
                            child: Column(
                              children: [
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.router_rounded,
                                      size: 14,
                                      color: isSelected ? Colors.white : AppColors.textSecondary,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      portName,
                                      style: TextStyle(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.bold,
                                        color: isSelected ? Colors.white : AppColors.textPrimary,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  "$portRootCount Couplers",
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: isSelected ? Colors.white.withValues(alpha: 0.85) : AppColors.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }),
                    // Quick "+ Add WDM" button
                    InkWell(
                      onTap: () => _showAddWdmPortDialog(),
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFBFDBFE)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.add_circle_outline_rounded, color: Color(0xFF2563EB), size: 16),
                            SizedBox(width: 4),
                            Text(
                              "Add WDM",
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF2563EB)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        // Info Banner
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: const Color(0xFFF1F5F9),
          child: Row(
            children: [
              const Icon(Icons.info_outline_rounded, size: 14, color: AppColors.textSecondary),
              const SizedBox(width: 6),
              Text(
                "$_selectedWdmPort Main Couplers (Level 1) • Tap any coupler to enter",
                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),

        // List of Level 1 Main Couplers
        Expanded(
          child: rootBoxes.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(color: AppColors.primaryBg, shape: BoxShape.circle),
                        child: const Icon(Icons.alt_route_rounded, size: 36, color: AppColors.primary),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        "No Main Coupler on $_selectedWdmPort yet",
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        "Add your primary 1:4 or 1:2 JC splitter connected to WDM",
                        style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton.icon(
                        onPressed: () => _showAddEditBoxDialog(availableParentBoxes: allBoxes),
                        icon: const Icon(Icons.add, size: 16),
                        label: Text("Add Main Coupler for $_selectedWdmPort"),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(14),
                  itemCount: rootBoxes.length,
                  separatorBuilder: (context, _) => const SizedBox(height: 12),
                  itemBuilder: (context, idx) {
                    final box = rootBoxes[idx];

                    return InkWell(
                      onTap: () => _openBox(box),
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFBFDBFE), width: 1.5),
                          boxShadow: AppColors.cardShadow,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEFF6FF),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(color: const Color(0xFF93C5FD)),
                                  ),
                                  child: Column(
                                    children: [
                                      const Icon(Icons.alt_route_rounded, color: Color(0xFF2563EB), size: 22),
                                      const SizedBox(height: 2),
                                      Text(
                                        box.splitterRatio,
                                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Flexible(
                                            child: Text(
                                              box.name,
                                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary),
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFDBEAFE),
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: const Text(
                                              "L1 • MAIN COUPLER",
                                              style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 3),
                                      if (box.location.isNotEmpty)
                                        Text("📍 ${box.location}", style: const TextStyle(fontSize: 11.5, color: AppColors.textSecondary)),
                                      const SizedBox(height: 3),
                                      Text(
                                        "⚡ Direct from $_selectedWdmPort (WDM) • ${box.usedPortsCount}/${box.totalPorts} Ports Used",
                                        style: const TextStyle(fontSize: 11, color: Color(0xFFD97706), fontWeight: FontWeight.w600),
                                      ),
                                      if (box.inputFiberColor != null) ...[
                                        const SizedBox(height: 3),
                                        Row(
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFF1F5F9),
                                                borderRadius: BorderRadius.circular(5),
                                                border: Border.all(color: const Color(0xFFE2E8F0)),
                                              ),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  const Icon(Icons.cable_rounded, size: 11, color: AppColors.textSecondary),
                                                  const SizedBox(width: 4),
                                                  const Text("WDM Core:", style: TextStyle(fontSize: 10, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
                                                  const SizedBox(width: 4),
                                                  Container(
                                                    width: 9,
                                                    height: 9,
                                                    decoration: BoxDecoration(
                                                      color: FiberColorCode.getColor(box.inputFiberColor),
                                                      shape: BoxShape.circle,
                                                      border: Border.all(color: Colors.black26, width: 0.6),
                                                    ),
                                                  ),
                                                  const SizedBox(width: 3),
                                                  Text(
                                                    box.inputCableTag != null && box.inputCableTag!.isNotEmpty
                                                        ? "${box.inputFiberColor!} (${box.inputCableTag})"
                                                        : box.inputFiberColor!,
                                                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                      if (box.inputPower != null || box.outputPower != null) ...[
                                        const SizedBox(height: 5),
                                        Wrap(
                                          spacing: 6,
                                          runSpacing: 4,
                                          children: [
                                            if (box.inputPower != null)
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFEFF6FF),
                                                  borderRadius: BorderRadius.circular(5),
                                                  border: Border.all(color: const Color(0xFFBFDBFE)),
                                                ),
                                                child: Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    const Icon(Icons.login_rounded, size: 11, color: Color(0xFF2563EB)),
                                                    const SizedBox(width: 3),
                                                    Text(
                                                      "In: ${box.inputPower! > 0 ? '+${box.inputPower!.toStringAsFixed(1)}' : box.inputPower!.toStringAsFixed(1)} dBm",
                                                      style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            if (box.outputPower != null)
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFFECFDF5),
                                                  borderRadius: BorderRadius.circular(5),
                                                  border: Border.all(color: const Color(0xFFA7F3D0)),
                                                ),
                                                child: Row(
                                                  mainAxisSize: MainAxisSize.min,
                                                  children: [
                                                    const Icon(Icons.logout_rounded, size: 11, color: Color(0xFF059669)),
                                                    const SizedBox(width: 3),
                                                    Text(
                                                      "Out: ${box.outputPower! > 0 ? '+${box.outputPower!.toStringAsFixed(1)}' : box.outputPower!.toStringAsFixed(1)} dBm",
                                                      style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.bold, color: Color(0xFF047857)),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                          ],
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.more_vert_rounded, size: 18, color: AppColors.textSecondary),
                                  onPressed: () => _showAddEditBoxDialog(existingBox: box, availableParentBoxes: allBoxes),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            // Big Enter Button
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(vertical: 9),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEFF6FF),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFFBFDBFE)),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.folder_open_rounded, size: 16, color: Color(0xFF2563EB)),
                                  const SizedBox(width: 6),
                                  Text(
                                    "Open Coupler (View ${box.totalPorts} Ports)",
                                    style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
                                  ),
                                  const SizedBox(width: 4),
                                  const Icon(Icons.arrow_forward_rounded, size: 14, color: Color(0xFF1D4ED8)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  // --- 2. INSIDE COUPLER VIEW: SHOWS ONLY THIS COUPLER'S OUTPUT PORTS ---
  Widget _buildInsideCouplerView({
    required FiberBox box,
    required List<FiberBox> allBoxes,
    required List<Customer> lineCustomers,
  }) {
    final isJc = box.boxType == "JC";
    final level = _navigationStack.length;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Current Coupler Header Card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
              boxShadow: AppColors.cardShadow,
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isJc ? const Color(0xFFEFF6FF) : const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: isJc ? const Color(0xFFBFDBFE) : const Color(0xFFA7F3D0)),
                  ),
                  child: Icon(
                    isJc ? Icons.alt_route_rounded : Icons.inventory_2_outlined,
                    color: isJc ? const Color(0xFF2563EB) : const Color(0xFF059669),
                    size: 24,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              box.name,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.textPrimary),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: level == 1
                                  ? const Color(0xFFDBEAFE)
                                  : (level == 2 ? const Color(0xFFF3E8FF) : const Color(0xFFDCFCE7)),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              "Level $level • ${box.splitterRatio}",
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                                color: level == 1
                                    ? const Color(0xFF1D4ED8)
                                    : (level == 2 ? const Color(0xFF7E22CE) : const Color(0xFF15803D)),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      if (box.location.isNotEmpty)
                        Text("📍 ${box.location}", style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                      const SizedBox(height: 2),
                      Text(
                        box.isDirectFromWdm
                            ? "⚡ Input: Direct from ${box.wdmPort} (WDM)"
                            : "⚡ Input: From ${box.parentBoxName ?? 'JC'} (Port #${box.parentPortIndex ?? 1})",
                        style: const TextStyle(fontSize: 11, color: Color(0xFFD97706), fontWeight: FontWeight.w600),
                      ),
                      if (box.isDirectFromWdm && box.inputFiberColor != null) ...[
                        const SizedBox(height: 3),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(5),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.cable_rounded, size: 11, color: AppColors.textSecondary),
                                  const SizedBox(width: 4),
                                  const Text("WDM Core:", style: TextStyle(fontSize: 10, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
                                  const SizedBox(width: 4),
                                  Container(
                                    width: 9,
                                    height: 9,
                                    decoration: BoxDecoration(
                                      color: FiberColorCode.getColor(box.inputFiberColor),
                                      shape: BoxShape.circle,
                                      border: Border.all(color: Colors.black26, width: 0.6),
                                    ),
                                  ),
                                  const SizedBox(width: 3),
                                  Text(
                                    box.inputCableTag != null && box.inputCableTag!.isNotEmpty
                                        ? "${box.inputFiberColor!} (${box.inputCableTag})"
                                        : box.inputFiberColor!,
                                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                      if (box.inputPower != null || box.outputPower != null) ...[
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: [
                            if (box.inputPower != null)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEFF6FF),
                                  borderRadius: BorderRadius.circular(5),
                                  border: Border.all(color: const Color(0xFFBFDBFE)),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.login_rounded, size: 12, color: Color(0xFF2563EB)),
                                    const SizedBox(width: 4),
                                    Text(
                                      "In: ${box.inputPower! > 0 ? '+${box.inputPower!.toStringAsFixed(1)}' : box.inputPower!.toStringAsFixed(1)} dBm",
                                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
                                    ),
                                  ],
                                ),
                              ),
                            if (box.outputPower != null)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFECFDF5),
                                  borderRadius: BorderRadius.circular(5),
                                  border: Border.all(color: const Color(0xFFA7F3D0)),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(Icons.logout_rounded, size: 12, color: Color(0xFF059669)),
                                    const SizedBox(width: 4),
                                    Text(
                                      "Out: ${box.outputPower! > 0 ? '+${box.outputPower!.toStringAsFixed(1)}' : box.outputPower!.toStringAsFixed(1)} dBm",
                                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF047857)),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert_rounded, size: 20, color: AppColors.textSecondary),
                  onSelected: (val) {
                    if (val == "EDIT") {
                      _showAddEditBoxDialog(existingBox: box, availableParentBoxes: allBoxes);
                    } else if (val == "DELETE") {
                      _confirmDeleteBox(box);
                    }
                  },
                  itemBuilder: (ctx) => [
                    const PopupMenuItem(value: "EDIT", child: Text("Edit Coupler Details")),
                    const PopupMenuItem(value: "DELETE", child: Text("Delete Coupler", style: TextStyle(color: AppColors.danger))),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Ports Header & Free Count
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "Output Ports (${box.totalPorts} Total):",
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: box.freePortsCount > 0 ? const Color(0xFFDCFCE7) : AppColors.surfaceSecondary,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  "${box.freePortsCount} Free Ports",
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: box.freePortsCount > 0 ? const Color(0xFF16A34A) : AppColors.textMuted,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // LIST OF PORTS
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: box.ports.length,
            separatorBuilder: (context, _) => const SizedBox(height: 8),
            itemBuilder: (context, pIdx) {
              final port = box.ports[pIdx];

              // Find connected child box if subbox
              final childBox = port.isSubBox && port.subBoxId != null
                  ? allBoxes.where((b) => b.id == port.subBoxId).firstOrNull
                  : null;

              return Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: port.isEmpty
                      ? Colors.white
                      : (port.isSubBox
                          ? const Color(0xFFF8FAFC)
                          : (port.opticalPower != null && port.opticalPower! < -10.0
                              ? const Color(0xFFFEF2F2)
                              : const Color(0xFFF0FDF4))),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: port.isEmpty
                        ? AppColors.border
                        : (port.isSubBox
                            ? const Color(0xFFBFDBFE)
                            : (port.opticalPower != null && port.opticalPower! < -10.0
                                ? const Color(0xFFFCA5A5)
                                : const Color(0xFFBBF7D0))),
                    width: port.isSubBox ? 1.5 : 1,
                  ),
                  boxShadow: AppColors.cardShadow,
                ),
                child: Row(
                  children: [
                    // Port Number Badge
                    Container(
                      width: 28,
                      height: 28,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: port.isEmpty
                            ? AppColors.surfaceSecondary
                            : (port.isSubBox ? const Color(0xFF2563EB) : AppColors.primary),
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        "${port.portIndex}",
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: port.isEmpty ? AppColors.textSecondary : Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),

                    // PORT INFO
                    Expanded(
                      child: port.isEmpty
                          ? Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  "Empty / Free Port",
                                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textMuted),
                                ),
                                Text(
                                  "Tap to connect customer or sub-coupler",
                                  style: TextStyle(fontSize: 10.5, color: AppColors.textMuted.withValues(alpha: 0.8)),
                                ),
                              ],
                            )
                          : port.isCustomer
                              ? Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      port.customerName ?? 'Customer',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: AppColors.textPrimary),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      "ID: ${port.customerStbId ?? 'N/A'} • 📱 ${port.customerPhone ?? ''}",
                                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                    ),
                                    if (port.couplerColor != null || port.fiberCoreColor != null) ...[
                                      const SizedBox(height: 3),
                                      _buildFiberColorBadge(port),
                                    ],
                                  ],
                                )
                              : Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        const Icon(Icons.alt_route_rounded, size: 14, color: Color(0xFF2563EB)),
                                        const SizedBox(width: 4),
                                        Flexible(
                                          child: Text(
                                            port.subBoxName ?? 'Sub-Coupler',
                                            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        if (childBox != null)
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFDBEAFE),
                                              borderRadius: BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              childBox.splitterRatio,
                                              style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
                                            ),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      childBox != null
                                          ? "📍 ${childBox.location.isNotEmpty ? childBox.location : 'Pole'} • ${childBox.usedPortsCount}/${childBox.totalPorts} Used"
                                          : "Feeds Sub-Coupler",
                                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                    ),
                                    if (childBox != null && (childBox.inputPower != null || childBox.outputPower != null)) ...[
                                      const SizedBox(height: 3),
                                      Row(
                                        children: [
                                          if (childBox.inputPower != null) ...[
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFEFF6FF),
                                                borderRadius: BorderRadius.circular(4),
                                                border: Border.all(color: const Color(0xFFBFDBFE)),
                                              ),
                                              child: Text(
                                                "In: ${childBox.inputPower! > 0 ? '+${childBox.inputPower!.toStringAsFixed(1)}' : childBox.inputPower!.toStringAsFixed(1)} dBm",
                                                style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF1D4ED8)),
                                              ),
                                            ),
                                            const SizedBox(width: 5),
                                          ],
                                          if (childBox.outputPower != null) ...[
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFECFDF5),
                                                borderRadius: BorderRadius.circular(4),
                                                border: Border.all(color: const Color(0xFFA7F3D0)),
                                              ),
                                              child: Text(
                                                "Out: ${childBox.outputPower! > 0 ? '+${childBox.outputPower!.toStringAsFixed(1)}' : childBox.outputPower!.toStringAsFixed(1)} dBm",
                                                style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.bold, color: Color(0xFF047857)),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ],
                                    if (port.couplerColor != null || port.fiberCoreColor != null) ...[
                                      const SizedBox(height: 3),
                                      _buildFiberColorBadge(port),
                                    ],
                                  ],
                                ),
                    ),

                    // Optical Power Pill if Customer
                    if (port.isCustomer && port.opticalPower != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: OpticalPowerConfig.getStatusBgColor(port.opticalPower!),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: OpticalPowerConfig.getStatusBorderColor(port.opticalPower!)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(OpticalPowerConfig.getStatusIcon(port.opticalPower!), size: 12, color: OpticalPowerConfig.getStatusColor(port.opticalPower!)),
                            const SizedBox(width: 4),
                            Text(
                              "${port.opticalPower!.toStringAsFixed(1)} dBm",
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: OpticalPowerConfig.getStatusColor(port.opticalPower!),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 6),
                    ],

                    // ACTION BUTTON
                    if (port.isEmpty)
                      ElevatedButton.icon(
                        onPressed: () => _showPortActionDialog(
                          box: box,
                          port: port,
                          lineCustomers: lineCustomers,
                          allBoxes: allBoxes,
                        ),
                        icon: const Icon(Icons.add, size: 13),
                        label: const Text("Connect", style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                      )
                    else if (port.isSubBox)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.settings_outlined, size: 16, color: AppColors.textMuted),
                            tooltip: "Port Settings",
                            onPressed: () => _showPortActionDialog(
                              box: box,
                              port: port,
                              lineCustomers: lineCustomers,
                              allBoxes: allBoxes,
                            ),
                          ),
                          ElevatedButton.icon(
                            onPressed: () {
                              if (childBox != null) {
                                _openBox(childBox);
                              } else {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text("Sub-coupler box not found")),
                                );
                              }
                            },
                            icon: const Icon(Icons.folder_open_rounded, size: 14),
                            label: const Text("Open ➔", style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF2563EB),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                          ),
                        ],
                      )
                    else
                      IconButton(
                        icon: const Icon(Icons.edit_outlined, size: 16, color: AppColors.textSecondary),
                        tooltip: "Edit Port",
                        onPressed: () => _showPortActionDialog(
                          box: box,
                          port: port,
                          lineCustomers: lineCustomers,
                          allBoxes: allBoxes,
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildFiberColorBadge(FiberPortMapping port) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cable_rounded, size: 11, color: AppColors.textSecondary),
          const SizedBox(width: 4),
          if (port.couplerColor != null) ...[
            Container(
              width: 9,
              height: 9,
              decoration: BoxDecoration(
                color: FiberColorCode.getColor(port.couplerColor),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.black26, width: 0.6),
              ),
            ),
            const SizedBox(width: 3),
            Text(
              port.couplerColor!,
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            ),
          ],
          if (port.couplerColor != null && port.fiberCoreColor != null) ...[
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 3),
              child: Icon(Icons.arrow_forward_rounded, size: 9, color: AppColors.textMuted),
            ),
          ],
          if (port.fiberCoreColor != null) ...[
            Container(
              width: 9,
              height: 9,
              decoration: BoxDecoration(
                color: FiberColorCode.getColor(port.fiberCoreColor),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.black26, width: 0.6),
              ),
            ),
            const SizedBox(width: 3),
            Text(
              port.cableTag != null && port.cableTag!.isNotEmpty
                  ? "${port.fiberCoreColor!} (${port.cableTag})"
                  : port.fiberCoreColor!,
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            ),
          ],
        ],
      ),
    );
  }
}
