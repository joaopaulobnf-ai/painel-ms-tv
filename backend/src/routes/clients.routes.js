import express from "express";
import { store, saveStore } from "../store.js";

const router = express.Router();

function parseConnections(html = "") {
  const match = String(html).match(/(\d+)\s*\/\s*(\d+)/);
  return {
    current: match ? Number(match[1]) : 0,
    max: match ? Number(match[2]) : 0
  };
}

function formatDateBR(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return "";
  const dd = String(dateObj.getUTCDate()).padStart(2, "0");
  const mm = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = dateObj.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function toUtcMidday(dateObj) {
  if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return null;
  return new Date(Date.UTC(
    dateObj.getUTCFullYear(),
    dateObj.getUTCMonth(),
    dateObj.getUTCDate(),
    12, 0, 0
  ));
}

function parsePossibleDate(value) {
  if (!value) return null;

  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const num = Number(value);
    if (!Number.isNaN(num) && num > 0) {
      // timestamp em segundos
      if (String(num).length <= 10) {
        return new Date(num * 1000);
      }
      // timestamp em ms
      return new Date(num);
    }
  }

  const str = String(value).trim();

  // já no formato dd/mm/aaaa
  let match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0));
  }

  // formato yyyy-mm-dd
  match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, yyyy, mm, dd] = match;
    return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0));
  }

  // fallback
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeClientDate(item) {
  const candidates = [
    item.exp_date,
    item.expiration,
    item.vencimentoIso,
    item.vencimento,
    item.expiration_date,
    item.expire_date
  ];

  for (const candidate of candidates) {
    const parsed = parsePossibleDate(candidate);
    if (parsed) return toUtcMidday(parsed);
  }

  return null;
}

function toClient(item) {
  const vencimentoDate = normalizeClientDate(item);

  const hoje = new Date();
  const hojeUtc = new Date(Date.UTC(
    hoje.getUTCFullYear(),
    hoje.getUTCMonth(),
    hoje.getUTCDate(),
    12, 0, 0
  ));

  const vencZero = vencimentoDate
    ? new Date(Date.UTC(
        vencimentoDate.getUTCFullYear(),
        vencimentoDate.getUTCMonth(),
        vencimentoDate.getUTCDate(),
        12, 0, 0
      ))
    : null;

  const isTrial = String(item.is_trial || "") === "1";
  const active = String(item.status || "") === "1";
  const vencido = vencZero ? vencZero < hojeUtc : false;

  let status = "inativo";
  if (isTrial) status = "teste";
  else if (vencido) status = "vencido";
  else if (active) status = "ativo";

  const conexoes = parseConnections(item.conexoes || "");

  return {
    id: String(item.id || ""),
    login: item.username || item.login || "",
    statusOriginal: item.status,
    status,
    ativo: active,
    vencido,
    teste: isTrial,
    vencimento: vencimentoDate ? formatDateBR(vencimentoDate) : "",
    vencimentoIso: vencimentoDate ? vencimentoDate.toISOString() : "",
    diasParaVencer: vencZero
      ? Math.floor((vencZero - hojeUtc) / (1000 * 60 * 60 * 24))
      : null,
    autoRenovar: String(item.auto_renew || "") === "1",
    maxConexoes: Number(item.max_con || conexoes.max || 0),
    conexoesAtuais: Number(conexoes.current || 0),
    conexoesHtml: item.conexoes || "",
    observacoes: item.reseller_notes || "",
    memberId: item.member_id || "",
    forceServerId: item.force_server_id || "0"
  };
}

async function fetchRemoteClients() {
  const response = await fetch(`${process.env.PDC_API_URL}/listas/minhas`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Origin": process.env.PDC_ORIGIN,
      "Referer": `${process.env.PDC_ORIGIN}/`,
      "x-access-token": process.env.PDC_TOKEN,
      "x_filtro": "todas"
    },
    body: new URLSearchParams({
      draw: "1",
      start: "0",
      length: "500"
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha PDC: ${response.status} - ${text}`);
  }

  return response.json();
}

router.get("/sync", async (req, res) => {
  try {
    const raw = await fetchRemoteClients();
    const clients = Array.isArray(raw.data) ? raw.data.map(toClient) : [];

    store.clientes = clients;

    res.json({
      result: true,
      syncedAt: new Date().toISOString(),
      total: clients.length,
      filtered: clients.length,
      clients
    });
  } catch (error) {
    console.error("Erro /api/clients/sync:", error);
    res.status(500).json({
      result: false,
      message: "Erro ao sincronizar clientes",
      error: error.message
    });
  }
});

router.get("/", async (req, res) => {
  try {
    if (!store.clientes.length) {
      const raw = await fetchRemoteClients();
      store.clientes = Array.isArray(raw.data) ? raw.data.map(toClient) : [];
    }

    res.json({
      result: true,
      total: store.clientes.length,
      clients: store.clientes
    });
  } catch (error) {
    console.error("Erro /api/clients:", error);
    res.status(500).json({
      result: false,
      message: "Erro ao listar clientes",
      error: error.message
    });
  }
});

router.post("/pagar/:id", (req, res) => {
  const { id } = req.params;

  if (!store.pagos.has(id)) {
    store.pagos.add(id);
    store.historico.push({
      id,
      acao: "marcou_pago",
      data: new Date().toISOString()
    });
    saveStore();
  }

  res.json({
    ok: true,
    pagos: [...store.pagos]
  });
});

router.post("/desmarcar-pago/:id", (req, res) => {
  const { id } = req.params;

  if (store.pagos.has(id)) {
    store.pagos.delete(id);
    store.historico.push({
      id,
      acao: "desmarcou_pago",
      data: new Date().toISOString()
    });
    saveStore();
  }

  res.json({
    ok: true,
    pagos: [...store.pagos]
  });
});

router.get("/pagos", (req, res) => {
  res.json([...store.pagos]);
});

router.get("/historico", (req, res) => {
  res.json(store.historico);
});

router.get("/contatos", (req, res) => {
  res.json(store.contatos);
});

router.post("/contatos/:id", (req, res) => {
  const { id } = req.params;
  const { telefone } = req.body;

  if (!telefone) {
    return res.status(400).json({
      ok: false,
      message: "Telefone é obrigatório"
    });
  }

  const numeroLimpo = String(telefone).replace(/\D/g, "");

  if (numeroLimpo.length < 10) {
    return res.status(400).json({
      ok: false,
      message: "Telefone inválido"
    });
  }

  store.contatos[id] = numeroLimpo;
  saveStore();

  res.json({
    ok: true,
    id,
    telefone: numeroLimpo
  });
});

router.delete("/contatos/:id", (req, res) => {
  const { id } = req.params;

  if (store.contatos[id]) {
    delete store.contatos[id];
    saveStore();
  }

  res.json({
    ok: true,
    contatos: store.contatos
  });
});

export default router;
