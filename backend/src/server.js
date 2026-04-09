import express from "express";
import cors from "cors";
import clientsRoutes from "./routes/clients.routes.js";
import { loadStore } from "./store.js";

const app = express();

app.use(cors());
app.use(express.json());

loadStore();

app.use("/api", clientsRoutes);

app.listen(process.env.PORT || 10000, () => {
  console.log("Servidor rodando");
});
