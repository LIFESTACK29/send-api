import { Router } from "express";
import multer from "multer";
import { authenticate, authorize } from "../../middlewares/auth.middleware";
import {
    createKekeRider,
    listKekeRiders,
    getKekeRider,
    updateKekeRider,
    deactivateKekeRider,
    reactivateKekeRider,
    getBanks,
    resolveBank,
    setKekeRiderBankAccount,
    getKekeRiderBankAccount,
} from "../../controllers/admin/keke-riders.controller";
import {
    listRides,
    assignRide,
    updateRideStatus,
    completeRide,
    adminCancelRide,
    getUnsettledRides,
} from "../../controllers/admin/rides.controller";
import {
    createSettlement,
    retrySettlement,
    listSettlements,
    getPlatformBalanceHandler,
} from "../../controllers/admin/settlements.controller";
import {
    listCampuses,
    createCampus,
    updateCampus,
    listZones,
    createZone,
    updateZone,
    adminListLocations,
    adminCreateLocation,
    adminGetLocation,
    adminUpdateLocation,
    adminDeleteLocation,
    adminBulkImportLocations,
} from "../../controllers/campus.controller";
import {
    listFareRules,
    createFareRule,
    updateFareRule,
    deleteFareRule,
} from "../../controllers/admin/fare-rules.controller";

const router = Router();
const csvUpload = multer({ storage: multer.memoryStorage() });

router.use(authenticate);
router.use(authorize("admin", "ops"));

// ── Campus ──────────────────────────────────────────────────────────────────
router.get("/campuses", listCampuses);
router.post("/campuses", createCampus);
router.put("/campuses/:id", updateCampus);
router.get("/campuses/:id/zones", listZones);
router.post("/campuses/:id/zones", createZone);
router.put("/zones/:id", updateZone);

// ── Campus Locations ─────────────────────────────────────────────────────────
router.get("/campus/locations", adminListLocations);
router.post("/campus/locations", adminCreateLocation);
router.post(
    "/campus/locations/bulk-import",
    csvUpload.single("file"),
    adminBulkImportLocations,
);
router.get("/campus/locations/:id", adminGetLocation);
router.put("/campus/locations/:id", adminUpdateLocation);
router.delete("/campus/locations/:id", adminDeleteLocation);

// ── Fare Rules ───────────────────────────────────────────────────────────────
router.get("/fare-rules", listFareRules);
router.post("/fare-rules", createFareRule);
router.put("/fare-rules/:id", updateFareRule);
router.delete("/fare-rules/:id", deleteFareRule);

// ── Banks ────────────────────────────────────────────────────────────────────
router.get("/banks", getBanks);
router.post("/banks/resolve", resolveBank);

// ── Keke Riders ──────────────────────────────────────────────────────────────
router.post("/keke-riders", createKekeRider);
router.get("/keke-riders", listKekeRiders);
router.get("/keke-riders/:id", getKekeRider);
router.put("/keke-riders/:id", updateKekeRider);
router.post("/keke-riders/:id/deactivate", deactivateKekeRider);
router.post("/keke-riders/:id/reactivate", reactivateKekeRider);
router.post("/keke-riders/:id/bank-account", setKekeRiderBankAccount);
router.get("/keke-riders/:id/bank-account", getKekeRiderBankAccount);
router.put("/keke-riders/:id/bank-account", setKekeRiderBankAccount);
router.get("/keke-riders/:id/unsettled-rides", getUnsettledRides);

// ── Rides ────────────────────────────────────────────────────────────────────
router.get("/rides", listRides);
router.post("/rides/:id/assign", assignRide);
router.post("/rides/:id/status", updateRideStatus);
router.post("/rides/:id/complete", completeRide);
router.post("/rides/:id/cancel", adminCancelRide);

// ── Settlements ──────────────────────────────────────────────────────────────
router.post("/settlements", createSettlement);
router.post("/settlements/:id/retry", retrySettlement);
router.get("/settlements", listSettlements);

// ── Platform ─────────────────────────────────────────────────────────────────
router.get("/platform/balance", getPlatformBalanceHandler);

export default router;
