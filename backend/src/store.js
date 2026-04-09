import fs from "fs";
import path from "path";
import crypto from "crypto";
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
          contatos: {},
          pagos: [],
          historico: [],
          sessions: []
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
      contatos: parsed.contatos && typeof parsed.contatos === "object" ? parsed.contatos : {},
      pagos: Array.isArray(parsed.pagos) ? parsed.pagos : [],
      historico: Array.isArray(parsed.historico) ? parsed.historico : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : []
    };
  } catch {
    return {
      contatos: {},
      pagos: [],
      historico: [],
      sessions: []
    };
  }
}

function writeData(data) {
  ensureDataFile();

  fs.writeFileSync(
    dataFile,
    JSON.stringify(
      {
        contatos: data.contatos && typeof data.contatos === "object" ? data.contatos : {},
        pagos: Array.isArray(data.pagos) ? data.pagos : [],
        historico: Array.isArray(data.historico) ? data.historico : [],
        sessions: Array.isArray(data.sessions) ? data.sessions : []
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
  contatos: persisted.contatos,
  pagos: new Set(persisted.pagos),
  historico: persisted.historico,
  sessions: persisted.sessions,
  telefoneMsTv: "62991133110"
};

export function saveStore() {
  writeData({
    contatos: store.contatos,
    pagos: [...store.pagos],
    historico: store.historico,
    sessions: store.sessions
  });
}

export function createSession(username) {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;

  store.sessions = store.sessions.filter(session => session.expiresAt > Date.now());
  store.sessions.push({
    token,
    username,
    expiresAt
  });

  saveStore();
  return token;
}

export function getSession(token) {
  if (!token) return null;

  const now = Date.now();
  store.sessions = store.sessions.filter(session => session.expiresAt > now);
  saveStore();

  return store.sessions.find(session => session.token === token) || null;
}

export function removeSession(token) {
  store.sessions = store.sessions.filter(session => session.token !== token);
  saveStore();
}
