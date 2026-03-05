import Ably from "ably";

const ABLY_API_KEY = process.env.ABLY_API_KEY || "dummy_key:dummy_secret";

const ablyClient = new Ably.Realtime(ABLY_API_KEY);

ablyClient.connection.on("connected", () => {
    console.log("✅ Connected to Ably Realtime");
});

ablyClient.connection.on("failed", () => {
    console.log("❌ Failed to connect to Ably");
});

export const publishToChannel = async (
    channelName: string,
    eventName: string,
    data: any,
) => {
    try {
        const channel = ablyClient.channels.get(channelName);
        await channel.publish(eventName, data);
        console.log(`[Ably] Published ${eventName} to ${channelName}`);
    } catch (error) {
        console.error(`[Ably] Error publishing to ${channelName}:`, error);
    }
};

export default ablyClient;
