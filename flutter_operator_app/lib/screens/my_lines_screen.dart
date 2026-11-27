import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../models/customer.dart';
import '../services/sound_service.dart';
import '../theme/app_theme.dart';
import 'line_design_screen.dart';

class MyLinesScreen extends StatefulWidget {
  final String operatorName;
  final String operatorUid;

  const MyLinesScreen({
    super.key,
    required this.operatorName,
    required this.operatorUid,
  });

  @override
  State<MyLinesScreen> createState() => _MyLinesScreenState();
}

class _MyLinesScreenState extends State<MyLinesScreen> {
  String _searchQuery = "";

  void _showAddEditLineDialog({DocumentSnapshot? existingDoc}) {
    final isEditing = existingDoc != null;
    final initialName = isEditing ? (existingDoc.data() as Map<String, dynamic>)['name']?.toString() ?? "" : "";
    final controller = TextEditingController(text: initialName);
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
              title: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primaryBg,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.alt_route_rounded, color: AppColors.primary, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    isEditing ? "Edit Line" : "Add New Line",
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: AppColors.textPrimary),
                  ),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    "Enter the line or area name. This will be available exclusively in your operator app.",
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12.5),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: controller,
                    autofocus: true,
                    textCapitalization: TextCapitalization.characters,
                    style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimary, fontSize: 14),
                    decoration: InputDecoration(
                      labelText: "Line / Area Name *",
                      hintText: "e.g. LINE-10, MAIN ROAD, TEMPLE ST",
                      filled: true,
                      fillColor: AppColors.inputBg,
                      prefixIcon: const Icon(Icons.location_on_outlined, color: AppColors.primary, size: 20),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                      ),
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
                          final name = controller.text.trim();
                          if (name.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text("Please enter a line name"), backgroundColor: AppColors.danger),
                            );
                            return;
                          }

                          setDialogState(() => isSaving = true);
                          try {
                            if (isEditing) {
                              final oldName = initialName;
                              await FirebaseFirestore.instance.collection('areas').doc(existingDoc.id).update({
                                'name': name,
                                'updatedAt': FieldValue.serverTimestamp(),
                              });

                              // Also update customer records that had this line
                              if (oldName.isNotEmpty && oldName != name) {
                                final custs = await FirebaseFirestore.instance
                                    .collection('customers')
                                    .where('area', isEqualTo: oldName)
                                    .get();
                                final batch = FirebaseFirestore.instance.batch();
                                for (var c in custs.docs) {
                                  batch.update(c.reference, {'area': name});
                                }
                                await batch.commit();
                              }
                            } else {
                              await FirebaseFirestore.instance.collection('areas').add({
                                'name': name,
                                'operatorUid': widget.operatorUid,
                                'operatorName': widget.operatorName,
                                'createdAt': FieldValue.serverTimestamp(),
                              });
                            }

                            SoundService.playSuccessSound();
                            if (ctx.mounted) Navigator.pop(ctx);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(isEditing ? "Line updated! ✅" : "Line '$name' added successfully! ✅"),
                                  backgroundColor: AppColors.success,
                                ),
                              );
                            }
                          } catch (e) {
                            setDialogState(() => isSaving = false);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text("Failed to save: $e"), backgroundColor: AppColors.danger),
                              );
                            }
                          }
                        },
                  child: isSaving
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Text(isEditing ? "Save Changes" : "Create Line", style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _confirmDeleteLine(DocumentSnapshot areaDoc, String lineName, int customerCount) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text("Delete Line?", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: AppColors.danger)),
        content: Text(
          customerCount > 0
              ? "Line '$lineName' currently has $customerCount customers. Deleting this line may leave customers without an assigned line. Are you sure?"
              : "Are you sure you want to delete line '$lineName'?",
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
                await FirebaseFirestore.instance.collection('areas').doc(areaDoc.id).delete();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text("Line '$lineName' deleted."), backgroundColor: AppColors.textSecondary),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text("Error deleting: $e"), backgroundColor: AppColors.danger),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          "My Lines (Locations)",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.textPrimary),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline_rounded, color: AppColors.primary, size: 24),
            tooltip: "Add Line",
            onPressed: () => _showAddEditLineDialog(),
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: StreamBuilder<QuerySnapshot>(
        stream: FirebaseFirestore.instance
            .collection('areas')
            .where('operatorUid', isEqualTo: widget.operatorUid)
            .snapshots(),
        builder: (context, areaSnap) {
          if (areaSnap.hasError) {
            return Center(child: Text("Error loading lines: ${areaSnap.error}"));
          }
          if (!areaSnap.hasData) {
            return const Center(child: CircularProgressIndicator(color: AppColors.primary));
          }

          final areaDocs = areaSnap.data!.docs;

          return StreamBuilder<QuerySnapshot>(
            stream: FirebaseFirestore.instance.collection('customers').snapshots(),
            builder: (context, custSnap) {
              final customers = custSnap.hasData
                  ? custSnap.data!.docs.map((d) => Customer.fromFirestore(d)).toList()
                  : <Customer>[];

              // Filter by search query
              final filteredDocs = areaDocs.where((d) {
                final name = (d.data() as Map<String, dynamic>)['name']?.toString().toLowerCase() ?? "";
                return name.contains(_searchQuery.toLowerCase());
              }).toList();

              // Sort lines alphabetically
              filteredDocs.sort((a, b) {
                final nameA = (a.data() as Map<String, dynamic>)['name']?.toString() ?? "";
                final nameB = (b.data() as Map<String, dynamic>)['name']?.toString() ?? "";
                return nameA.compareTo(nameB);
              });

              return Column(
                children: [
                  // Search Bar & Summary
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      border: Border(bottom: BorderSide(color: AppColors.border)),
                    ),
                    child: Column(
                      children: [
                        TextField(
                          onChanged: (val) => setState(() => _searchQuery = val.trim()),
                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 13.5),
                          decoration: InputDecoration(
                            hintText: "Search your lines...",
                            hintStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                            prefixIcon: const Icon(Icons.search, color: AppColors.textMuted, size: 20),
                            filled: true,
                            fillColor: AppColors.inputBg,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              "${filteredDocs.length} Total Lines",
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                            ),
                            Text(
                              "Operator: ${widget.operatorName}",
                              style: const TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Line Cards List
                  Expanded(
                    child: filteredDocs.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.alt_route_rounded, size: 48, color: AppColors.textMuted),
                                const SizedBox(height: 12),
                                Text(
                                  _searchQuery.isNotEmpty ? "No lines match '$_searchQuery'" : "No lines created yet",
                                  style: const TextStyle(color: AppColors.textMuted, fontSize: 14),
                                ),
                                const SizedBox(height: 16),
                                ElevatedButton.icon(
                                  onPressed: () => _showAddEditLineDialog(),
                                  icon: const Icon(Icons.add, size: 18),
                                  label: const Text("Create First Line"),
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
                            padding: const EdgeInsets.all(16),
                            itemCount: filteredDocs.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 10),
                            itemBuilder: (context, index) {
                              final doc = filteredDocs[index];
                              final data = doc.data() as Map<String, dynamic>;
                              final lineName = data['name']?.toString() ?? doc.id;
                              final custCount = customers.where((c) => c.area.trim().toLowerCase() == lineName.trim().toLowerCase()).length;

                              return Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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
                                        color: AppColors.primaryBg,
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(color: AppColors.primaryBorder),
                                      ),
                                      child: const Icon(Icons.location_on_rounded, color: AppColors.primary, size: 20),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            lineName,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 14.5,
                                              color: AppColors.textPrimary,
                                            ),
                                          ),
                                          const SizedBox(height: 3),
                                          Row(
                                            children: [
                                              Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                decoration: BoxDecoration(
                                                  color: custCount > 0 ? const Color(0xFFF0FDF4) : AppColors.surfaceSecondary,
                                                  borderRadius: BorderRadius.circular(6),
                                                ),
                                                child: Text(
                                                  "$custCount Customers",
                                                  style: TextStyle(
                                                    fontSize: 11,
                                                    fontWeight: FontWeight.bold,
                                                    color: custCount > 0 ? const Color(0xFF16A34A) : AppColors.textMuted,
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 8),
                                              InkWell(
                                                onTap: () {
                                                  Navigator.push(
                                                    context,
                                                    MaterialPageRoute(
                                                      builder: (_) => LineDesignScreen(
                                                        operatorName: widget.operatorName,
                                                        operatorUid: widget.operatorUid,
                                                        initialLineName: lineName,
                                                      ),
                                                    ),
                                                  );
                                                },
                                                borderRadius: BorderRadius.circular(6),
                                                child: Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFFEFF6FF),
                                                    borderRadius: BorderRadius.circular(6),
                                                    border: Border.all(color: const Color(0xFFBFDBFE)),
                                                  ),
                                                  child: const Row(
                                                    mainAxisSize: MainAxisSize.min,
                                                    children: [
                                                      Icon(Icons.account_tree_rounded, size: 12, color: Color(0xFF2563EB)),
                                                      SizedBox(width: 4),
                                                      Text(
                                                        "Fiber Map",
                                                        style: TextStyle(
                                                          fontSize: 11,
                                                          fontWeight: FontWeight.bold,
                                                          color: Color(0xFF1D4ED8),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.edit_outlined, size: 18, color: AppColors.textSecondary),
                                      tooltip: "Edit Line",
                                      onPressed: () => _showAddEditLineDialog(existingDoc: doc),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline_rounded, size: 18, color: AppColors.danger),
                                      tooltip: "Delete Line",
                                      onPressed: () => _confirmDeleteLine(doc, lineName, custCount),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }
}

