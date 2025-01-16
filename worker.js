const { parentPort, workerData } = require("worker_threads");
const OpenAI = require("openai");

const { base64_image, apiKey } = workerData;

(async () => {
  try {
    // Initialize OpenAI with the API key
    const openai = new OpenAI({
      apiKey, baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
    });

    // Prepare the messages array
    const messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Send the text in this captcha image.",
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
