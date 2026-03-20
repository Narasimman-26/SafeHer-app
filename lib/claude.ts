export async function generateAlertMessage(
    location: string,
    station: { name: string },
    note?: string
): Promise<string> {
    try {
        const prompt = "Generate urgent emergency police alert. Location: " + location + ". Station: " + station.name + ". Note: " + (note || "None") + ". Time: " + new Date().toLocaleTimeString() + ". Under 60 words. Plain text only.";

        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.EXPO_PUBLIC_CLAUDE_KEY!,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 200,
                messages: [{ role: "user", content: prompt }]
            })
        });
        const data = await res.json();
        return data.content[0].text;
    } catch {
        return "EMERGENCY SOS — SafeHer Alert. User at " + location + " needs immediate help. Station: " + station.name;
    }
}