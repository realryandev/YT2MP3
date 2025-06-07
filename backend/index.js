import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import ytdl from "@distube/ytdl-core";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import sanitize from "sanitize-filename";
import NodeID3 from "node-id3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DOWNLOAD_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);

ffmpeg.setFfmpegPath(ffmpegPath);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
});
app.use(limiter);

app.post("/api/download", async (req, res) => {
  const { url } = req.body;
  if (!ytdl.validateURL(url))
    return res.status(400).json({ error: "Invalid URL" });

  try {
    const info = await ytdl.getInfo(url);
    const rawTitle = info.videoDetails.title;
    const title = sanitize(rawTitle).substring(0, 64) || "youtube-audio";
    const fileName = `${title}.mp3`;
    const filePath = path.join(DOWNLOAD_DIR, fileName);
    const author = info.videoDetails.author.name;
    const description = info.videoDetails.description;
    const thumbnail = info.videoDetails.thumbnails.pop().url;

    const stream = ytdl.downloadFromInfo(info, { quality: "highestaudio" });
    const output = fs.createWriteStream(filePath);

    ffmpeg(stream)
      .audioBitrate(320)
      .format("mp3")
      .on("end", async () => {
        const img = await fetch(thumbnail).then((r) => r.arrayBuffer());
        const tags = {
          title: rawTitle,
          artist: author,
          comment: { text: description },
          image: {
            mime: "image/jpeg",
            type: { id: 3, name: "front cover" },
            description: "Thumbnail",
            imageBuffer: Buffer.from(img),
          },
        };
        NodeID3.write(tags, filePath);

        res.setHeader(
          "Content-Disposition",
          `attachment; filename=\"${fileName}\"`
        );
        res.setHeader("Content-Type", "audio/mpeg");

        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
        readStream.on("close", () => fs.unlinkSync(filePath));
      })
      .on("error", (err) => {
        console.error("FFmpeg error:", err);
        res
          .status(500)
          .json({ error: "Processing error", details: err.message });
      })
      .pipe(output);
  } catch (err) {
    console.error("Download failed:", err);
    res.status(500).json({ error: "Internal error", details: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
