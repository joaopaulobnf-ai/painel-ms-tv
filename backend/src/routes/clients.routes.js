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
  const clean = String(rawDate || "").replace(/\s+/g, " ").trim();

  const match = clean.match(
    /^(\d{1,2})\s+([A-Za-zÀ-ÿ]{3})\s+(\d{4})\s+\d{1,2}:\d{1,2}:\d{1,2}$/
  );

  if (!match) return "";

  const [, day, monthText, year] = match;
  const normalizedMonth = monthText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const month = MONTHS[normalizedMonth];
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
  const clean = String(line || "").replace(/\r/g, "").trim();
  if (!clean) return null;
  if (!/^\d+/.test(clean)) return null;

  const principalMatch = clean.match(
    /^(\d+)\s+(Expirada|Ativa)\s+(.+?)\s+(\d{1,2}\s+[A-Za-zÀ-ÿ]{3}\s+\d{4}\s+\d{1,2}:\d{1,2}:\d{1,2})\s*.*$/i
  );

  if (!principalMatch) return null;

  const [, id, statusBruto, usuarioBruto, vencimentoBruto] = principalMatch;

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

    if (ultimoCliente && /(\d+)\s*\/\s*(\d+)/.test(line)) {
      const conexoes = parseConnections(line);
      ultimoCliente.conexoesAtuais = conexoes.current;
      ultimoCliente.maxConexoes = conexoes.max;
      ultimoCliente.conexoesHtml = `${conexoes.current}/${conexoes.max}`;
    }
  }

  return clientes;
}

function obterMesReferencia(clientes) {
  const primeiroComData = clientes.find(cliente => /^\d{2}\/\d{2}\/\d{4}$/.test(cliente.vencimento));

  if (!primeiroComData) {
    const agora = new Date();
    return {
      chave: `${String(agora.getMonth() + 1).padStart(2, "0")}/${agora.getFullYear()}`,
      label: `${String(agora.getMonth() + 1).padStart(2, "0")}/${agora.getFullYear()}`
    };
  }

  const [, mes, ano] = primeiroComData.vencimento.split("/");
  return {
    chave: `${mes}/${ano}`,
    label: `${mes}/${ano}`
  };
}

function montarResumoMensal(clientes) {
  const ativos = clientes.filter(c => c.status === "ativo").length;
  const vencidos = clientes.filter(c => c.status === "vencido").length;
  const testes = clientes.filter(c => c.status === "teste").length;

  return {
    totalClientes: clientes.length,
    renovacoes: ativos,
    vencidos,
    testesGerados: testes,
    dinheiroBruto: ativos * 30
  };
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

  const mesRef = obterMesReferencia(novosClientes);
  const resumo = montarResumoMensal(novosClientes);

  const entradaHistorico = {
    id: `${Date.now()}`,
    mes: mesRef.chave,
    label: mesRef.label,
    dataImportacao: new Date().toISOString(),
    resumo,
    clientes: novosClientes
  };

  store.listasHistorico = store.listasHistorico.filter(item => item.mes !== mesRef.chave);
  store.listasHistorico.unshift(entradaHistorico);

  store.historico.push({
    acao: "importou_lista_manual",
    total: novosClientes.length,
    mes: mesRef.chave,
    data: new Date().toISOString()
  });

  saveStore();

  res.json({
    ok: true,
    total: store.clientes.length,
    clients: store.clientes,
    mes: mesRef.chave
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

router.get("/listas-historico", (req, res) => {
  res.json({
    ok: true,
    listas: store.listasHistorico.map(item => ({
      id: item.id,
      mes: item.mes,
      label: item.label,
      dataImportacao: item.dataImportacao,
      resumo: item.resumo
    }))
  });
});

router.get("/listas-historico/:mes", (req, res) => {
  const { mes } = req.params;
  const item = store.listasHistorico.find(entry => entry.mes === mes);

  if (!item) {
    return res.status(404).json({
      ok: false,
      message: "Mês não encontrado no histórico."
    });
  }

  res.json({
    ok: true,
    item
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
