import { Response } from "express";
import { AuthRequest } from "../types/user.type";
import { CatchAsync } from "../utils/catchasync.util";
import CampusLocation from "../models/campus-location.model";
import Campus from "../models/campus.model";
import Zone from "../models/zone.model";

// GET /api/v1/campus/locations?campusId=
export const getCampusLocations = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { campusId } = req.query;

        if (!campusId || typeof campusId !== "string") {
            res.status(400).json({ message: "campusId is required" });
            return;
        }

        const locations = await CampusLocation.find({ campusId, isActive: true })
            .populate("zoneId", "name displayOrder")
            .sort({ displayOrder: 1, name: 1 })
            .lean();

        // Group by category
        const grouped: Record<string, any[]> = {};
        for (const loc of locations) {
            const cat = loc.category as string;
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({
                id: loc._id,
                name: loc.name,
                category: loc.category,
                aliases: loc.aliases,
                description: loc.description,
                displayOrder: loc.displayOrder,
                zone: loc.zoneId,
            });
        }

        res.status(200).json({ success: true, data: grouped });
    },
);

// GET /api/v1/admin/campuses
export const listCampuses = CatchAsync(
    async (_req: AuthRequest, res: Response) => {
        const campuses = await Campus.find().sort({ name: 1 }).lean();
        res.status(200).json({ success: true, data: campuses });
    },
);

// POST /api/v1/admin/campuses
export const createCampus = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { name, code } = req.body;
        if (!name || !code) {
            res.status(400).json({ message: "name and code are required" });
            return;
        }
        const campus = await Campus.create({ name, code: code.toUpperCase() });
        res.status(201).json({ success: true, data: campus });
    },
);

// PUT /api/v1/admin/campuses/:id
export const updateCampus = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { name, isActive } = req.body;
        const campus = await Campus.findByIdAndUpdate(
            req.params.id,
            { ...(name !== undefined && { name }), ...(isActive !== undefined && { isActive }) },
            { new: true },
        );
        if (!campus) {
            res.status(404).json({ message: "Campus not found" });
            return;
        }
        res.status(200).json({ success: true, data: campus });
    },
);

// GET /api/v1/admin/campuses/:id/zones
export const listZones = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const zones = await Zone.find({ campusId: req.params.id })
            .sort({ displayOrder: 1 })
            .lean();
        res.status(200).json({ success: true, data: zones });
    },
);

// POST /api/v1/admin/campuses/:id/zones
export const createZone = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { name, displayOrder } = req.body;
        if (!name) {
            res.status(400).json({ message: "name is required" });
            return;
        }
        const zone = await Zone.create({
            campusId: req.params.id,
            name,
            displayOrder: displayOrder ?? 0,
        });
        res.status(201).json({ success: true, data: zone });
    },
);

// PUT /api/v1/admin/zones/:id
export const updateZone = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { name, isActive, displayOrder } = req.body;
        const zone = await Zone.findByIdAndUpdate(
            req.params.id,
            {
                ...(name !== undefined && { name }),
                ...(isActive !== undefined && { isActive }),
                ...(displayOrder !== undefined && { displayOrder }),
            },
            { new: true },
        );
        if (!zone) {
            res.status(404).json({ message: "Zone not found" });
            return;
        }
        res.status(200).json({ success: true, data: zone });
    },
);

// GET /api/v1/admin/campus/locations
export const adminListLocations = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { campusId, category, zoneId, isActive, search } = req.query;

        const filter: Record<string, any> = {};
        if (campusId) filter.campusId = campusId;
        if (category) filter.category = category;
        if (zoneId) filter.zoneId = zoneId;
        if (isActive !== undefined) filter.isActive = isActive === "true";
        if (search && typeof search === "string") {
            filter.$text = { $search: search };
        }

        const locations = await CampusLocation.find(filter)
            .populate("zoneId", "name")
            .sort({ displayOrder: 1, name: 1 })
            .lean();

        res.status(200).json({ success: true, data: locations });
    },
);

// POST /api/v1/admin/campus/locations
export const adminCreateLocation = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { campusId, zoneId, name, category, aliases, description, displayOrder } =
            req.body;

        if (!campusId || !zoneId || !name || !category) {
            res.status(400).json({
                message: "campusId, zoneId, name, and category are required",
            });
            return;
        }

        const VALID_CATEGORIES = ["FACULTY", "HOSTEL", "GATE", "LANDMARK", "FOOD", "ADMIN"];
        if (!VALID_CATEGORIES.includes(category)) {
            res.status(400).json({
                message: `category must be one of: ${VALID_CATEGORIES.join(", ")}`,
            });
            return;
        }

        const location = await CampusLocation.create({
            campusId,
            zoneId,
            name,
            category,
            aliases: aliases ?? [],
            description,
            displayOrder: displayOrder ?? 0,
            createdBy: req.user!.userId,
        });

        res.status(201).json({ success: true, data: location });
    },
);

// GET /api/v1/admin/campus/locations/:id
export const adminGetLocation = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const location = await CampusLocation.findById(req.params.id)
            .populate("zoneId", "name displayOrder")
            .lean();
        if (!location) {
            res.status(404).json({ message: "Location not found" });
            return;
        }
        res.status(200).json({ success: true, data: location });
    },
);

// PUT /api/v1/admin/campus/locations/:id
export const adminUpdateLocation = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { name, zoneId, category, aliases, description, displayOrder, isActive } =
            req.body;

        const update: Record<string, any> = {};
        if (name !== undefined) update.name = name;
        if (zoneId !== undefined) update.zoneId = zoneId;
        if (category !== undefined) update.category = category;
        if (aliases !== undefined) update.aliases = aliases;
        if (description !== undefined) update.description = description;
        if (displayOrder !== undefined) update.displayOrder = displayOrder;
        if (isActive !== undefined) update.isActive = isActive;

        const location = await CampusLocation.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true },
        );
        if (!location) {
            res.status(404).json({ message: "Location not found" });
            return;
        }
        res.status(200).json({ success: true, data: location });
    },
);

// DELETE /api/v1/admin/campus/locations/:id  (soft delete)
export const adminDeleteLocation = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const location = await CampusLocation.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true },
        );
        if (!location) {
            res.status(404).json({ message: "Location not found" });
            return;
        }
        res.status(200).json({ success: true, message: "Location deactivated" });
    },
);

// POST /api/v1/admin/campus/locations/bulk-import  (CSV multipart)
export const adminBulkImportLocations = CatchAsync(
    async (req: AuthRequest, res: Response) => {
        const { campusId } = req.body;
        if (!campusId) {
            res.status(400).json({ message: "campusId is required" });
            return;
        }
        if (!req.file) {
            res.status(400).json({ message: "CSV file is required" });
            return;
        }

        const csv = req.file.buffer.toString("utf-8");
        const lines = csv.split("\n").filter((l) => l.trim());
        if (lines.length < 2) {
            res.status(400).json({ message: "CSV has no data rows" });
            return;
        }

        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const results: Array<{ row: number; success: boolean; message?: string }> = [];

        // Pre-fetch all zones for the campus
        const zones = await Zone.find({ campusId }).lean();
        const zoneByName = new Map(zones.map((z) => [z.name.toLowerCase(), z._id]));

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
            const row: Record<string, string> = {};
            headers.forEach((h, idx) => (row[h] = values[idx] ?? ""));

            const { name, category, zone_name, aliases, description } = row;

            if (!name || !category || !zone_name) {
                results.push({ row: i + 1, success: false, message: "name, category, zone_name are required" });
                continue;
            }

            const zoneId = zoneByName.get(zone_name.toLowerCase());
            if (!zoneId) {
                results.push({ row: i + 1, success: false, message: `Zone '${zone_name}' not found` });
                continue;
            }

            const VALID_CATEGORIES = ["FACULTY", "HOSTEL", "GATE", "LANDMARK", "FOOD", "ADMIN"];
            if (!VALID_CATEGORIES.includes(category.toUpperCase())) {
                results.push({ row: i + 1, success: false, message: `Invalid category '${category}'` });
                continue;
            }

            try {
                await CampusLocation.create({
                    campusId,
                    zoneId,
                    name,
                    category: category.toUpperCase(),
                    aliases: aliases ? aliases.split("|").map((a) => a.trim()).filter(Boolean) : [],
                    description: description || undefined,
                    createdBy: req.user!.userId,
                });
                results.push({ row: i + 1, success: true });
            } catch (err: any) {
                results.push({ row: i + 1, success: false, message: err.message });
            }
        }

        const successCount = results.filter((r) => r.success).length;
        res.status(200).json({
            success: true,
            imported: successCount,
            failed: results.length - successCount,
            results,
        });
    },
);
