"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const user_model_1 = __importDefault(require("./src/models/user.model"));
const MONGODB_URI = "mongodb://127.0.0.1:27017/raha-send"; // Match .env
function test() {
    return __awaiter(this, void 0, void 0, function* () {
        yield mongoose_1.default.connect(MONGODB_URI);
        console.log("Connected");
        const clerkId = "user_3A71sKRRSTkbnABuZPr50lYbNyX";
        // Test 1: findOne
        const foundUser = yield user_model_1.default.findOne({ clerkId });
        console.log("findOne result:", foundUser ? "FOUND" : "NOT FOUND");
        if (foundUser) {
            // Test 2: findOneAndUpdate
            try {
                const updatedUser = yield user_model_1.default.findOneAndUpdate({ clerkId }, { $push: { addresses: { name: "Test", location: "Loc" } } }, { new: true, runValidators: true });
                console.log("findOneAndUpdate result:", updatedUser ? "FOUND" : "NOT FOUND (NULL returned)");
            }
            catch (e) {
                console.error("findOneAndUpdate error:", e.message);
            }
        }
        process.exit(0);
    });
}
test();
