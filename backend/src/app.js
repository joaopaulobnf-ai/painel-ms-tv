import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import clientsRoutes from "./routes/clients.routes.js";
import financeRoutes from "./routes/finance.routes.js";
import whatsappRoutes from "./routes/whatsapp.routes.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));

app.get("/health", (req, res) => {
  res.json({ result: true, message: "API do painel MS TV online." });
});

app.use("/api/clients", clientsRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/whatsapp", whatsappRoutes);

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

export default app;
