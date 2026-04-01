const Groq = require("groq-sdk");

if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY is missing in .env file!");
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function askClaude(messages, systemPrompt = "") {
  const formattedMessages = [];

  if (systemPrompt) {
    formattedMessages.push({ role: "system", content: systemPrompt });
  }

  messages.forEach((msg) => {
    formattedMessages.push({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    });
  });

  const response = await groq.chat.completions.create({
    model: "llama3-8b-8192",
    messages: formattedMessages,
    max_tokens: 1024,
  });

  return response.choices[0].message.content;
}

module.exports = { askClaude };