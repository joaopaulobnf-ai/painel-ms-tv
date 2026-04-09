import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import clientsRoutes from "./routes/clients.routes.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");

function basicAuth(req, res, next) {
  if (req.path === "/health") {
    return next();
  }

  const validUser = process.env.PANEL_USER || "admin";
  const validPass = process.env.PANEL_PASS || "123456";

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Painel MS TV"');
    return res.status(401).send("Autenticação necessária");
  }

  const base64Credentials = authHeader.split(" ")[1];
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
  const [username, password] = credentials.split(":");

  if (username !== validUser || password !== validPass) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Painel MS TV"');
    return res.status(401).send("Usuário ou senha inválidos");
  }

  next();
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(basicAuth);

app.get("/health", (req, res) => {
  res.json({
    result: true,
    message: "API do painel MS TV online."
  });
});

app.use("/api/clients", clientsRoutes);

app.use(express.static(publicDir));

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

export default app;
