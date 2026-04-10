import app from "./app.js";

const PORT = Number(process.env.PORT) || 10000;
const HOST = "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});

server.on("error", error => {
  console.error("Erro ao iniciar servidor:", error);
  process.exit(1);
});
