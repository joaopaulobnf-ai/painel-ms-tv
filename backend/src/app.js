import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import clientsRoutes from "./routes/clients.routes.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, "../público");

app.use(cors());
app.use(express.json());

app.use(express.static(publicDir));

app.use("/api/clients", clientsRoutes);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

export default app;
