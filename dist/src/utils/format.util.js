"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatToNaira = void 0;
exports.formatDateToReadable = formatDateToReadable;
const formatToNaira = (amount) => {
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        minimumFractionDigits: 0,
    }).format(amount);
};
exports.formatToNaira = formatToNaira;
function formatDateToReadable(dateString) {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString("default", { month: "long" });
    const year = date.getFullYear();
    const getOrdinal = (n) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    return `${getOrdinal(day)} ${month}, ${year}`;
}
