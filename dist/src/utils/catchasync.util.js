"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatchAsync = void 0;
/**
 * Wrapper for async route handlers to catch errors
 * Usage: export const handler = CatchAsync(async (req, res) => { ... })
 */
const CatchAsync = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.CatchAsync = CatchAsync;
