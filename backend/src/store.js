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
          clientes: [],
          contatos: {},
          observacoes: {},
          pagos: [],
          renovados: [],
          historico: [],
          sessions: [],
          listasHistorico: []
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
      clientes: Array.isArray(parsed.clientes) ? parsed.clientes : [],
      contatos: parsed.contatos && typeof parsed.contatos === "object" ? parsed.contatos : {},
      observacoes: parsed.observacoes && typeof parsed.observacoes === "object" ? parsed.observacoes : {},
      pagos: Array.isArray(parsed.pagos) ? parsed.pagos : [],
      renovados: Array.isArray(parsed.renovados) ? parsed.renovados : [],
      historico: Array.isArray(parsed.historico) ? parsed.historico : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      listasHistorico: Array.isArray(parsed.listasHistorico) ? parsed.listasHistorico : []
    };
  } catch {
    return {
      clientes: [],
      contatos: {},
      observacoes: {},
      pagos: [],
      renovados: [],
      historico: [],
      sessions: [],
      listasHistorico: []
    };
  }
}

function writeData(data) {
  ensureDataFile();

  fs.writeFileSync(
    dataFile,
    JSON.stringify(
      {
        clientes: Array.isArray(data.clientes) ? data.clientes : [],
        contatos: data.contatos && typeof data.contatos === "object" ? data.contatos : {},
        observacoes: data.observacoes && typeof data.observacoes === "object" ? data.observacoes : {},
        pagos: Array.isArray(data.pagos) ? data.pagos : [],
        renovados: Array.isArray(data.renovados) ? data.renovados : [],
        historico: Array.isArray(data.historico) ? data.historico : [],
        sessions: Array.isArray(data.sessions) ? data.sessions : [],
        listasHistorico: Array.isArray(data.listasHistorico) ? data.listasHistorico : []
      },
      null,
      2
    ),
    "utf-8"
  );
}

const persisted = readData();

export const store = {
  clientes: persisted.clientes,
  contatos: persisted.contatos,
  observacoes: persisted.observacoes,
  pagos: persisted.pagos,
  renovados: persisted.renovados,
  historico: persisted.historico,
  sessions: persisted.sessions,
  listasHistorico: persisted.listasHistorico,
  telefoneMsTv: "62991133110"
};

export function saveStore() {
  writeData({
    clientes: store.clientes,
    contatos: store.contatos,
    observacoes: store.observacoes,
    pagos: store.pagos,
    renovados: store.renovados,
    historico: store.historico,
    sessions: store.sessions,
    listasHistorico: store.listasHistorico
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
