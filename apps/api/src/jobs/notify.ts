export const notify = {
  async send(channel: string, recipientId: string, message: string): Promise<void> {
    if (channel === "telegram" && process.env.TELEGRAM_BOT_TOKEN && recipientId) {
      await sendTelegram(recipientId, message);
      return;
    }

    console.log(`[notify:${channel}] → ${recipientId || "console"}\n${message}`);
  },

  async opsAlert(message: string): Promise<void> {
    const recipientId = process.env.OWNER_TELEGRAM_ID ?? "";
    await notify.send("telegram", recipientId, message);
  },

  async hotLead(input: {
    contactId: string;
    summary: string;
    bookingUrl?: string;
  }): Promise<void> {
    const message = [
      "🔥 Hot lead reply",
      "",
      input.summary,
      "",
      input.bookingUrl ? `Book: ${input.bookingUrl}` : "",
      `Contact ID: ${input.contactId}`,
    ]
      .filter(Boolean)
      .join("\n");

    const recipientId = process.env.OWNER_TELEGRAM_ID ?? "";
    await notify.send("telegram", recipientId, message);
  },
};

async function sendTelegram(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Telegram notify failed: ${body}`);
  }
}
