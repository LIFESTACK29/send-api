import Wallet from "../models/wallet.model";
import User from "../models/user.model";

const buildLocalCustomerCode = (userId: string) => `LOCAL-${userId}`;

export const ensureWalletForUser = async (userId: string) => {
    let wallet = await Wallet.findOne({ userId });
    if (wallet) return wallet;

    const user = await User.findById(userId).select("email");
    try {
        wallet = await Wallet.create({
            userId,
            paystackCustomerCode:
                user?.email?.trim().toLowerCase() ||
                buildLocalCustomerCode(userId),
        });
    } catch (error: any) {
        if (error?.code === 11000) {
            const existingWallet = await Wallet.findOne({ userId });
            if (existingWallet) return existingWallet;
        }
        throw error;
    }

    return wallet;
};
