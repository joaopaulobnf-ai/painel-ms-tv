import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes, { requireAuth } from "./routes/auth.routes.js";
import clientsRoutes from "./routes/clients.routes.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.get("/health", (req, res) => {
  res.json({
    result: true,
    message: "API do painel MS TV online."
  });
});

app.use("/api/auth", authRoutes);
app.use("/api", requireAuth);
app.use("/api/clients", clientsRoutes);

app.use(express.static(publicDir));

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

export default app;
