const express = require("express");
const dotenv = require("dotenv");
const { Worker, isMainThread, parentPort, workerData } = require("worker_threads");
const OpenAI = require("openai");

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Parse JSON requests
app.use(express.json());

// Load API keys from .env
const apiKeys = process.env.API_KEYS.split(",");
let keyIndex = 0;

// Rotate API keys
const getApiKey = () => {
  const currentKey = apiKeys[keyIndex];
  keyIndex = (keyIndex + 1) % apiKeys.length;
  return currentKey;
};

// Worker thread logic
if (!isMainThread) {
  const { base64_image, apiKey } = workerData;

  (async () => {
    try {
      // Initialize OpenAI with the API key
      const openai = new OpenAI({
        apiKey,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      });

      // Prepare the messages array
      const messages = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Send the text from this captcha image. (reply only with the captcha text)",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64_image}`,
              },
            },
          ],
        },
      ];

      // Make the API call
      const response = await openai.chat.completions.create({
        model: "gemini-2.0-flash-exp",
        messages: messages,
      });

      const captchaText = response.choices[0].message.content;

      parentPort.postMessage(captchaText);
    } catch (error) {
      parentPort.postMessage({ error: error.message });
    }
  })();

} else {
  // Main thread logic

  // Worker thread function for concurrency
  const runWorker = (workerData) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData });
      worker.on("message", resolve);
      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
      });
    });
  };

  // Route to solve captcha
  app.post("/solve_captcha", async (req, res) => {
    const { base64_image } = req.body;

    if (!base64_image) {
      return res.status(400).json({ error: "base64_image is required" });
    }

    try {
      const apiKey = getApiKey(); // Rotate and get the next API key
      const workerData = { base64_image, apiKey };
      const result = await runWorker(workerData);
      return res.json({ captcha: result });
    } catch (error) {
      console.error("Error solving captcha:", error);
      return res.status(500).json({ error: "Failed to process the captcha" });
    }
  });

  // Start the server
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}
