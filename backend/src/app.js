import express from "express";
import { store, saveStore } from "../store.js";

const router = express.Router();

const MONTHS = {
  jan: "01",
  fev: "02",
  mar: "03",
  abr: "04",
  mai: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  set: "09",
  out: "10",
  nov: "11",
  dez: "12"
};

function parseConnections(text = "") {
  const match = String(text).match(/(\d+)\s*\/\s*(\d+)/);
  return {
    current: match ? Number(match[1]) : 0,
    max: match ? Number(match[2]) : 1
  };
}

function parseVencimento(rawDate) {
  const match = String(rawDate).trim().match(
    /^(\d{1,2})\s+([A-Za-zÀ-ÿ]{3})\s+(\d{4})\s+\d{1,2}:\d{1,2}:\d{1,2}$/
  );

  if (!match) return "";

  const [, day, monthText, year] = match;
  const month = MONTHS[monthText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")];

  if (!month) return "";

  return `${String(day).padStart(2, "0")}/${month}/${year}`;
}

function normalizarStatus(statusBruto, usuarioBruto) {
  const hasTeste = /\(teste\)/i.test(usuarioBruto);

  if (hasTeste) {
    return {
      status: "teste",
      teste: true,
      ativo: false,
      vencido: false
    };
  }

  if (/expirada/i.test(statusBruto)) {
    return {
      status: "vencido",
      teste: false,
      ativo: false,
      vencido: true
    };
  }

  return {
    status: "ativo",
    teste: false,
    ativo: true,
    vencido: false
  };
}

function parseLinhaPrincipal(line) {
  const clean = String(line).replace(/\r/g, "").trim();
  if (!clean) return null;
  if (!/^\d+/.test(clean)) return null;

  const parts = clean.split(/\t+/).map(v => v.trim()).filter(Boolean);

  if (parts.length < 4) return null;

  const id = parts[0];
  const statusBruto = parts[1];
  const usuarioBruto = parts[2];
  const vencimentoBruto = parts[3];

  const usuario = usuarioBruto.replace(/\s*\(teste\)\s*/i, "").trim();
  const vencimento = parseVencimento(vencimentoBruto);
  const statusInfo = normalizarStatus(statusBruto, usuarioBruto);

  return {
    id,
    login: usuario,
    vencimento,
    ...statusInfo
  };
}

function parseListaManual(texto) {
  const lines = String(texto || "")
    .split("\n")
    .map(line => line.replace(/\r/g, ""))
    .filter(line => line.trim() !== "");

  const clientes = [];
  let ultimoCliente = null;

  for (const line of lines) {
    const principal = parseLinhaPrincipal(line);

    if (principal) {
      ultimoCliente = {
        id: principal.id,
        login: principal.login,
        statusOriginal: principal.status,
        status: principal.status,
        ativo: principal.ativo,
        vencido: principal.vencido,
        teste: principal.teste,
        vencimento: principal.vencimento,
        vencimentoIso: "",
        diasParaVencer: null,
        autoRenovar: false,
        maxConexoes: 1,
        conexoesAtuais: 0,
        conexoesHtml: "0/1",
        observacoes: "",
        memberId: "",
        forceServerId: "0"
      };

      clientes.push(ultimoCliente);
      continue;
    }

    if (ultimoCliente) {
      const conexoes = parseConnections(line);
      if (String(line).match(/(\d+)\s*\/\s*(\d+)/)) {
        ultimoCliente.conexoesAtuais = conexoes.current;
        ultimoCliente.maxConexoes = conexoes.max;
        ultimoCliente.conexoesHtml = `${conexoes.current}/${conexoes.max}`;
      }
    }
  }

  return clientes;
}

router.get("/", (req, res) => {
  res.json({
    result: true,
    total: store.clientes.length,
    clients: store.clientes
  });
});

router.get("/sync", (req, res) => {
  res.json({
    result: true,
    syncedAt: new Date().toISOString(),
    total: store.clientes.length,
    filtered: store.clientes.length,
    clients: store.clientes
  });
});

router.post("/importar-lista", (req, res) => {
  const { lista } = req.body || {};

  if (!lista || !String(lista).trim()) {
    return res.status(400).json({
      ok: false,
      message: "Cole a lista manual antes de processar."
    });
  }

  const novosClientes = parseListaManual(lista);

  if (!novosClientes.length) {
    return res.status(400).json({
      ok: false,
      message: "Nenhum cliente válido foi identificado na lista."
    });
  }

  const idsNovos = new Set(novosClientes.map(cliente => cliente.id));

  store.clientes = novosClientes;
  store.pagos = new Set([...store.pagos].filter(id => idsNovos.has(id)));

  Object.keys(store.contatos).forEach(id => {
    if (!idsNovos.has(id)) {
      delete store.contatos[id];
    }
  });

  store.historico.push({
    acao: "importou_lista_manual",
    total: novosClientes.length,
    data: new Date().toISOString()
  });

  saveStore();

  res.json({
    ok: true,
    total: store.clientes.length,
    clients: store.clientes
  });
});

router.post("/limpar-lista", (req, res) => {
  store.clientes = [];
  store.pagos = new Set();
  store.contatos = {};
  store.historico.push({
    acao: "limpou_lista_manual",
    data: new Date().toISOString()
  });

  saveStore();

  res.json({
    ok: true
  });
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
