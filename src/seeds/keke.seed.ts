import mongoose from "mongoose";
import Campus from "../models/campus.model";
import Zone from "../models/zone.model";
import CampusLocation from "../models/campus-location.model";
import FareRule from "../models/fare-rule.model";
import "../config/db";

async function seed() {
    const dbUri = process.env.MONGO_URI;
    if (!dbUri) throw new Error("MONGO_URI not set");

    await mongoose.connect(dbUri);
    console.log("Connected to MongoDB");

    // ── Campus ──────────────────────────────────────────────────────────────
    let campus = await Campus.findOne({ code: "UNIPORT" });
    if (!campus) {
        campus = await Campus.create({
            name: "University of Port Harcourt",
            code: "UNIPORT",
            isActive: true,
        });
        console.log("Created campus: UNIPORT");
    }
    const campusId = campus._id;

    // ── Zones ────────────────────────────────────────────────────────────────
    const zoneData = [
        { name: "Academic Zone", displayOrder: 1 },
        { name: "Hostel Zone", displayOrder: 2 },
        { name: "Gate Zone", displayOrder: 3 },
        { name: "Landmark Zone", displayOrder: 4 },
        { name: "Food Zone", displayOrder: 5 },
    ];

    const zoneMap: Record<string, mongoose.Types.ObjectId> = {};
    for (const z of zoneData) {
        let zone = await Zone.findOne({ campusId, name: z.name });
        if (!zone) {
            zone = await Zone.create({ campusId, ...z, isActive: true });
            console.log(`Created zone: ${z.name}`);
        }
        zoneMap[z.name] = zone._id as mongoose.Types.ObjectId;
    }

    const academicZone = zoneMap["Academic Zone"];
    const hostelZone = zoneMap["Hostel Zone"];
    const gateZone = zoneMap["Gate Zone"];
    const landmarkZone = zoneMap["Landmark Zone"];
    const foodZone = zoneMap["Food Zone"];

    // ── Campus Locations ─────────────────────────────────────────────────────
    const locationData = [
        // Academic Zone
        {
            zoneId: academicZone,
            name: "Faculty of Engineering",
            category: "FACULTY",
            aliases: ["Engineering", "FUTO Engineering", "Engr block"],
            displayOrder: 1,
        },
        {
            zoneId: academicZone,
            name: "Faculty of Sciences",
            category: "FACULTY",
            aliases: ["Sciences", "Sci block", "Faculty of Natural Sciences"],
            displayOrder: 2,
        },
        {
            zoneId: academicZone,
            name: "Faculty of Social Sciences",
            category: "FACULTY",
            aliases: ["Soc Sci", "Social Sciences"],
            displayOrder: 3,
        },
        {
            zoneId: academicZone,
            name: "Faculty of Law",
            category: "FACULTY",
            aliases: ["Law faculty", "Fac of Law"],
            displayOrder: 4,
        },
        {
            zoneId: academicZone,
            name: "Senate Building",
            category: "ADMIN",
            aliases: ["Senate", "Admin block"],
            displayOrder: 5,
        },
        // Hostel Zone
        {
            zoneId: hostelZone,
            name: "Aluu Hostel",
            category: "HOSTEL",
            aliases: ["Aluu", "Aluu hall"],
            displayOrder: 1,
        },
        {
            zoneId: hostelZone,
            name: "Freedom Hall",
            category: "HOSTEL",
            aliases: ["Freedom", "Freedom hostel"],
            displayOrder: 2,
        },
        {
            zoneId: hostelZone,
            name: "Unity Hall",
            category: "HOSTEL",
            aliases: ["Unity", "Unity hostel"],
            displayOrder: 3,
        },
        // Gate Zone
        {
            zoneId: gateZone,
            name: "Main Gate",
            category: "GATE",
            aliases: ["Gate 1", "Front gate", "Choba gate"],
            displayOrder: 1,
        },
        {
            zoneId: gateZone,
            name: "Back Gate",
            category: "GATE",
            aliases: ["Gate 2", "Rear gate"],
            displayOrder: 2,
        },
        // Landmark Zone
        {
            zoneId: landmarkZone,
            name: "University Library",
            category: "LANDMARK",
            aliases: ["Library", "Uniport library"],
            displayOrder: 1,
        },
        {
            zoneId: landmarkZone,
            name: "Sports Complex",
            category: "LANDMARK",
            aliases: ["Sports", "Stadium", "Sports centre"],
            displayOrder: 2,
        },
        // Food Zone
        {
            zoneId: foodZone,
            name: "Student Union Canteen",
            category: "FOOD",
            aliases: ["Canteen", "SUB canteen", "Student union food"],
            displayOrder: 1,
        },
        {
            zoneId: foodZone,
            name: "Choba Market",
            category: "FOOD",
            aliases: ["Choba", "Choba mkt", "Market"],
            displayOrder: 2,
        },
    ];

    for (const loc of locationData) {
        const exists = await CampusLocation.findOne({ campusId, name: loc.name });
        if (!exists) {
            await CampusLocation.create({ campusId, ...loc, isActive: true });
            console.log(`Created location: ${loc.name}`);
        }
    }

    // ── Fare Rules (zone-to-zone) ────────────────────────────────────────────
    // Fares in kobo; symmetric pairs for now (pickup ↔ dropoff both directions)
    const fareData: Array<{
        pickupZone: string;
        dropoffZone: string;
        fareNaira: number;
    }> = [
        { pickupZone: "Gate Zone", dropoffZone: "Academic Zone", fareNaira: 150 },
        { pickupZone: "Gate Zone", dropoffZone: "Hostel Zone", fareNaira: 200 },
        { pickupZone: "Gate Zone", dropoffZone: "Landmark Zone", fareNaira: 200 },
        { pickupZone: "Gate Zone", dropoffZone: "Food Zone", fareNaira: 150 },
        { pickupZone: "Academic Zone", dropoffZone: "Hostel Zone", fareNaira: 150 },
        { pickupZone: "Academic Zone", dropoffZone: "Landmark Zone", fareNaira: 100 },
        { pickupZone: "Academic Zone", dropoffZone: "Food Zone", fareNaira: 150 },
        { pickupZone: "Hostel Zone", dropoffZone: "Landmark Zone", fareNaira: 100 },
        { pickupZone: "Hostel Zone", dropoffZone: "Food Zone", fareNaira: 150 },
        { pickupZone: "Landmark Zone", dropoffZone: "Food Zone", fareNaira: 100 },
    ];

    for (const f of fareData) {
        const pickupZoneId = zoneMap[f.pickupZone];
        const dropoffZoneId = zoneMap[f.dropoffZone];
        const fareKobo = f.fareNaira * 100;

        // Forward direction
        const fwdExists = await FareRule.findOne({
            campusId,
            pickupZoneId,
            dropoffZoneId,
        });
        if (!fwdExists) {
            await FareRule.create({
                campusId,
                pickupZoneId,
                dropoffZoneId,
                fare: fareKobo,
                isActive: true,
            });
            console.log(`Created fare: ${f.pickupZone} → ${f.dropoffZone} ₦${f.fareNaira}`);
        }

        // Reverse direction (same price)
        const revExists = await FareRule.findOne({
            campusId,
            pickupZoneId: dropoffZoneId,
            dropoffZoneId: pickupZoneId,
        });
        if (!revExists) {
            await FareRule.create({
                campusId,
                pickupZoneId: dropoffZoneId,
                dropoffZoneId: pickupZoneId,
                fare: fareKobo,
                isActive: true,
            });
            console.log(`Created fare: ${f.dropoffZone} → ${f.pickupZone} ₦${f.fareNaira}`);
        }
    }

    console.log("Seed complete");
    await mongoose.disconnect();
}

seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
