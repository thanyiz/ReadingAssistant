"use strict";
const fs = require("fs");
const { OpenAI } = require("openai");
const { readFileSync } = require("fs");
const { createServer } = require("https");
const { Server } = require("socket.io");

let openai = null;

const httpsServer = createServer({
  key: readFileSync(""),
  cert: readFileSync(""),
});

const io = new Server(httpsServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

async function readJsonFile() {
  try {
    const data = await fs.promises.readFile("openai_key.json", "utf8");
    const jsonObj = JSON.parse(data);
    const apiKey = jsonObj["OPENAI_API_KEY"];
    const baseUrl = jsonObj["OPENAI_BASE_URL"];
    return { apiKey, baseUrl };
  } catch (error) {
    console.error("Error reading/parsing JSON file:", error);
    throw error;
  }
}

async function main() {
  const { apiKey, baseUrl } = await readJsonFile();

  openai = new OpenAI({
    apiKey: apiKey,
    baseURL: baseUrl,
  });

  io.on("connection", (socket) => {
    let messageHistory = [
      { role: "system", content: "你是一个说中文的文章辅助阅读助手. " },
    ];

    socket.on("passage", async (passage) => {
      let prompt_templete = `这是文章的全文: """${passage}""". 你需要结合这篇文章, 回答相关的问题, 可以适当向外延伸. 明白了请回复"收到".`;
      messageHistory.push({ role: "user", content: prompt_templete });
      const completion = await openai.chat.completions.create({
        messages: messageHistory,
        model: "gpt-3.5-turbo-16k",
      });
    });

    // 提问引用与问题, 以及是否以语音返回
    socket.on("prompt", async (data) => {
      let prompt_templete = `引用内容: """${data.prompt}""". 回答使用中文. 代码部分用markdown显示. 问题为: """${data.question}""" `;
      messageHistory.push({ role: "user", content: prompt_templete });
      const stream = await openai.chat.completions.create({
        messages: messageHistory,
        model: "gpt-3.5-turbo-16k",
        stream: true,
      });
      let content = "";
      for await (const chunck of stream) {
        socket.emit(
          "completion_chunk",
          chunck.choices[0]?.delta?.content || ""
        );
        content = content + chunck.choices[0]?.delta?.content || "";
      }
      messageHistory.push({ role: "assistant", content: content });
      socket.emit("chunk_end");

      if (data.toVoice === true) {
        const mp3 = await openai.audio.speech.create({
          model: "tts-1",
          voice: "alloy",
          input: content,
        });
        const buffer = Buffer.from(await mp3.arrayBuffer());
        socket.emit("talk_audio", buffer);
      }
    });

    // 引用朗读
    socket.on("t2v", async (text) => {
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: text,
      });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      socket.emit("t2v_audio", buffer);
    });

    // 语音输入转文字
    socket.on("speech", async (audioBlob) => {
      const fileName = "speech.wav";

      try {
        await fs.promises.writeFile(fileName, Buffer.from(audioBlob));

        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(fileName),
          model: "whisper-1",
        });

        socket.emit("speech2text", transcription.text);
      } catch (error) {
        console.error("Error saving audioBlob to file:", error);
      }
    });

    socket.on("t2p", async (data) => {
      let ref = data.prompt;
      let question = data.question;
      let prompt = ref + question;
      const image = await openai.images.generate({
        model: "dall-e-2",
        prompt: prompt,
        size: "512x512",
      });
      console.log(image.data);
      socket.emit("picture", image.data);
    });
  });
}

main();

httpsServer.listen(443);
