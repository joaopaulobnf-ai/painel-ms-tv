import express from "express";
import { store, saveStore } from "../store.js";

const router = express.Router();

function parseConnections(html = "") {
  const match = html.match(/(\d+)\/(\d+)/);
  return {
    current: match ? Number(match[1]) : 0,
    max: match ? Number(match[2]) : 0
  };
}

function toClient(item) {
  const expUnix = Number(item.exp_date || 0);
  const vencimentoDate = expUnix ? new Date(expUnix * 1000) : null;

  const dd = vencimentoDate ? String(vencimentoDate.getDate()).padStart(2, "0") : "";
  const mm = vencimentoDate ? String(vencimentoDate.getMonth() + 1).padStart(2, "0") : "";
  const yyyy = vencimentoDate ? vencimentoDate.getFullYear() : "";

  const hoje = new Date();
  const hojeZero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const vencZero = vencimentoDate
    ? new Date(vencimentoDate.getFullYear(), vencimentoDate.getMonth(), vencimentoDate.getDate())
    : null;

  const isTrial = item.is_trial === "1";
  const active = item.status === "1";
  const vencido = vencZero ? vencZero < hojeZero : false;

  let status = "inativo";
  if (isTrial) status = "teste";
  else if (vencido) status = "vencido";
  else if (active) status = "ativo";

  const conexoes = parseConnections(item.conexoes || "");

  return {
    id: String(item.id),
    login: item.username || "",
    statusOriginal: item.status,
    status,
    ativo: active,
    vencido,
    teste: isTrial,
    vencimento: vencimentoDate ? `${dd}/${mm}/${yyyy}` : "",
    vencimentoIso: vencimentoDate ? vencimentoDate.toISOString() : "",
    diasParaVencer: vencZero ? Math.floor((vencZero - hojeZero) / (1000 * 60 * 60 * 24)) : null,
    autoRenovar: item.auto_renew === "1",
    maxConexoes: Number(item.max_con || conexoes.max || 0),
    conexoesAtuais: conexoes.current || 0,
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
