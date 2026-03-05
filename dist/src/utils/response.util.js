"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const responseUtil = (res, status, message, data = null) => {
    res.status(status).json({ message, data });
};
exports.default = responseUtil;
