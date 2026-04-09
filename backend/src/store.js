import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, "../data");
const dataFile = path.join(dataDir, "store.json");

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(
      dataFile,
      JSON.stringify(
        {
          pagos: [],
          historico: [],
          contatos: {}
        },
        null,
        2
      ),
      "utf-8"
    );
  }
}

function readData() {
  ensureDataFile();

  try {
    const raw = fs.readFileSync(dataFile, "utf-8");
    const parsed = JSON.parse(raw);

    return {
      pagos: Array.isArray(parsed.pagos) ? parsed.pagos : [],
      historico: Array.isArray(parsed.historico) ? parsed.historico : [],
      contatos: parsed.contatos && typeof parsed.contatos === "object" ? parsed.contatos : {}
    };
  } catch {
    return {
      pagos: [],
      historico: [],
      contatos: {}
    };
  }
}

function writeData(data) {
  ensureDataFile();

  fs.writeFileSync(
    dataFile,
    JSON.stringify(
      {
        pagos: Array.isArray(data.pagos) ? data.pagos : [],
        historico: Array.isArray(data.historico) ? data.historico : [],
        contatos: data.contatos && typeof data.contatos === "object" ? data.contatos : {}
      },
      null,
      2
    ),
    "utf-8"
  );
}

const persisted = readData();

export const store = {
  clientes: [],
  pagos: new Set(persisted.pagos),
  historico: persisted.historico,
  telefoneMsTv: "62991133110",
  contatos: persisted.contatos
};

export function saveStore() {
  writeData({
    pagos: [...store.pagos],
    historico: store.historico,
    contatos: store.contatos
  });
}
