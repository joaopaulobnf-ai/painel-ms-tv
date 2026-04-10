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

function parseDateBR(dateStr) {
  const clean = String(dateStr || "").trim();
  const match = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) return null;

  const [, dd, mm, yyyy] = match;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0);
}

function isPastDate(dateStr) {
  const d = parseDateBR(dateStr);
  if (!d) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

  return d < today;
}

function formatDateBRFromSlash(raw) {
  const clean = String(raw || "").trim();
  const match = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})/);

  if (!match) return "";

  const [, dd, mm, yyyy] = match;
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateBRFromText(rawDate) {
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

function sanitizeLogin(login) {
  return String(login || "")
    .replace(/\s*\(teste\)\s*/gi, "")
    .trim();
}

function createSafeId(login, vencimento, index) {
  return `${login}-${vencimento}-${index}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeStatusByDate(baseStatus, vencimento, teste) {
  if (teste) return "teste";
  if (isPastDate(vencimento)) return "vencido";
  return baseStatus === "vencido" ? "vencido" : "ativo";
}

function buildStatusInfo(statusBruto, usuarioBruto, vencimento) {
  const teste = /\(teste\)/i.test(usuarioBruto);
  const rawVencido = /expirada|vencida|vencido/i.test(statusBruto);
  const baseStatus = rawVencido ? "vencido" : "ativo";
  const status = normalizeStatusByDate(baseStatus, vencimento, teste);

  return {
    status,
    teste,
    ativo: status === "ativo",
    vencido: status === "vencido"
  };
}

function parseLinhaModeloAntigo(line, index) {
  const clean = String(line || "").replace(/\r/g, "").trim();
  if (!clean) return null;
  if (!/^\d+/.test(clean)) return null;

  const principalMatch = clean.match(
    /^(\d+)\s+(Expirada|Ativa)\s+(.+?)\s+(\d{1,2}\s+[A-Za-zÀ-ÿ]{3}\s+\d{4}\s+\d{1,2}:\d{1,2}:\d{1,2})\s*.*$/i
  );

  if (!principalMatch) return null;

  const [, id, statusBruto, usuarioBruto, vencimentoBruto] = principalMatch;
  const login = sanitizeLogin(usuarioBruto);
  const vencimento = formatDateBRFromText(vencimentoBruto);
  const statusInfo = buildStatusInfo(statusBruto, usuarioBruto, vencimento);

  return {
    id: String(id).replace(/[^\d]/g, "") || createSafeId(login, vencimento, index),
    login,
    vencimento,
    ...statusInfo
  };
}

function parseLinhaModeloNovoComStatus(line, index) {
  const clean = String(line || "").replace(/\r/g, "").trim();
  if (!clean) return null;

  const match = clean.match(
    /^(Ativa|Expirada)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4},?\s+\d{2}:\d{2}(?::\d{2})?)$/i
  );

  if (!match) return null;

  const [, statusBruto, usuarioBruto, vencimentoBruto] = match;
  const login = sanitizeLogin(usuarioBruto);
  const vencimento = formatDateBRFromSlash(vencimentoBruto);
  const statusInfo = buildStatusInfo(statusBruto, usuarioBruto, vencimento);

  return {
    id: createSafeId(login, vencimento, index),
    login,
    vencimento,
    ...statusInfo
  };
}

function parseLinhaModeloNovoSemStatus(line, index) {
  const clean = String(line || "").replace(/\r/g, "").trim();
  if (!clean) return null;

  const match = clean.match(
    /^(.+?)\s+(\d{2}\/\d{2}\/\d{4},?\s+\d{2}:\d{2}(?::\d{2})?)$/
  );

  if (!match) return null;

  const [, usuarioBruto, vencimentoBruto] = match;
  const login = sanitizeLogin(usuarioBruto);
  const vencimento = formatDateBRFromSlash(vencimentoBruto);
  const statusInfo = buildStatusInfo("Ativa", usuarioBruto, vencimento);

  return {
    id: createSafeId(login, vencimento, index),
    login,
    vencimento,
    ...statusInfo
  };
}

function parseLinhaPrincipal(line, index) {
  return (
    parseLinhaModeloAntigo(line, index) ||
    parseLinhaModeloNovoComStatus(line, index) ||
    parseLinhaModeloNovoSemStatus(line, index)
  );
}

function recalculateClientStatus(cliente) {
  const teste = Boolean(cliente.teste);
  const rawBaseStatus = cliente.status === "vencido" ? "vencido" : "ativo";
  const status = normalizeStatusByDate(rawBaseStatus, cliente.vencimento, teste);

  return {
    ...cliente,
    status,
    ativo: status === "ativo",
    vencido: status === "vencido",
    teste
  };
}

function recalculateAllClients(clientes) {
  return (clientes || []).map(recalculateClientStatus);
}

function parseListaManual(texto) {
  const lines = String(texto || "")
    .split("\n")
    .map(line => line.replace(/\r/g, ""))
    .filter(line => line.trim() !== "");

  const clientes = [];
  let ultimoCliente = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const principal = parseLinhaPrincipal(line, i);

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

  return recalculateAllClients(clientes);
}

function getSafeMonthKeyFromDate(dateStr) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr || "")) return null;
  const [, mm, yyyy] = dateStr.split("/");
  return `${mm}-${yyyy}`;
}

function getMonthLabelFromKey(key) {
  if (!key) return "";
  return key.replace("-", "/");
}

function obterMesReferencia(clientes) {
  const primeiroComData = clientes.find(cliente =>
    /^\d{2}\/\d{2}\/\d{4}$/.test(cliente.vencimento)
  );

  if (!primeiroComData) {
    const agora = new Date();
    const mes = String(agora.getMonth() + 1).padStart(2, "0");
    const ano = agora.getFullYear();
    const key = `${mes}-${ano}`;

    return {
      chave: key,
      label: getMonthLabelFromKey(key)
    };
  }

  const key = getSafeMonthKeyFromDate(primeiroComData.vencimento);

  return {
    chave: key,
    label: getMonthLabelFromKey(key)
  };
}

function montarResumoMensal(clientes) {
  const lista = recalculateAllClients(clientes);
  const ativos = lista.filter(c => c.status === "ativo").length;
  const vencidos = lista.filter(c => c.status === "vencido").length;
  const testes = lista.filter(c => c.status === "teste").length;

  return {
    totalClientes: lista.length,
    renovacoes: ativos,
    vencidos,
    testesGerados: testes,
    dinheiroBruto: ativos * 30
  };
}

router.get("/", (req, res) => {
  store.clientes = recalculateAllClients(store.clientes);
  saveStore();

  res.json({
    result: true,
    total: store.clientes.length,
    clients: store.clientes
  });
});

router.get("/sync", (req, res) => {
  store.clientes = recalculateAllClients(store.clientes);
  saveStore();

  res.json({
    result: true,
    syncedAt: new Date().toISOString(),
    total: store.clientes.length,
    filtered: store.clientes.length,
    clients: store.clientes
  });
});

router.post("/importar-lista", (req, res) => {
  try {
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

    if (!Array.isArray(store.listasHistorico)) {
      store.listasHistorico = [];
    }

    const mesRef = obterMesReferencia(novosClientes);
    const resumo = montarResumoMensal(novosClientes);

    const entradaHistorico = {
      id: String(Date.now()),
      mes: mesRef.chave,
      label: mesRef.label,
      dataImportacao: new Date().toISOString(),
      resumo,
      clientes: novosClientes
    };

    store.listasHistorico = store.listasHistorico.filter(item => {
      const key = (item.mes || "").replace("/", "-");
      return key !== mesRef.chave;
    });

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
      mes: mesRef.label
    });
  } catch (error) {
    console.error("Erro em /importar-lista:", error);
    res.status(500).json({
      ok: false,
      message: "Erro interno ao processar a lista.",
      error: error.message
    });
  }
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
  const listas = (store.listasHistorico || []).map(item => {
    const safeKey = (item.mes || "").replace("/", "-");
    const label = item.label || getMonthLabelFromKey(safeKey);

    return {
      id: item.id,
      mes: safeKey,
      label,
      dataImportacao: item.dataImportacao,
      resumo: item.resumo
    };
  });

  res.json({
    ok: true,
    listas
  });
});

router.get("/listas-historico/:mes/:ano?", (req, res) => {
  const { mes, ano } = req.params;
  const requestedKey = ano ? `${mes}-${ano}` : String(mes || "").replace("/", "-");

  const item = (store.listasHistorico || []).find(entry => {
    const key = String(entry.mes || "").replace("/", "-");
    return key === requestedKey;
  });

  if (!item) {
    return res.status(404).json({
      ok: false,
      message: "Mês não encontrado no histórico."
    });
  }

  res.json({
    ok: true,
    item: {
      ...item,
      mes: String(item.mes || "").replace("/", "-"),
      label: item.label || getMonthLabelFromKey(String(item.mes || "").replace("/", "-")),
      clientes: recalculateAllClients(item.clientes || []),
      resumo: montarResumoMensal(item.clientes || [])
    }
  });
});

router.post("/pagar/:id", (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);

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
  } catch (error) {
    console.error("Erro em /pagar/:id:", error);
    res.status(500).json({
      ok: false,
      message: "Erro ao marcar como pago.",
      error: error.message
    });
  }
});

router.post("/desmarcar-pago/:id", (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);

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
  } catch (error) {
    console.error("Erro em /desmarcar-pago/:id:", error);
    res.status(500).json({
      ok: false,
      message: "Erro ao desmarcar pagamento.",
      error: error.message
    });
  }
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
  try {
    const id = decodeURIComponent(req.params.id);
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
  } catch (error) {
    console.error("Erro em /contatos/:id:", error);
    res.status(500).json({
      ok: false,
      message: "Erro ao salvar contato.",
      error: error.message
    });
  }
});

router.delete("/contatos/:id", (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);

    if (store.contatos[id]) {
      delete store.contatos[id];
      saveStore();
    }

    res.json({
      ok: true,
      contatos: store.contatos
    });
  } catch (error) {
    console.error("Erro em DELETE /contatos/:id:", error);
    res.status(500).json({
      ok: false,
      message: "Erro ao remover contato.",
      error: error.message
    });
  }
});

export default router;
