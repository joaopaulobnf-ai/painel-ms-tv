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

function normalizeLoginKey(login = "") {
  return String(login)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
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
  const teste = /\(teste\)/i.test(usuarioBruto);
  const rawVencido = /expirada|vencida|vencido/i.test(statusBruto);

  return {
    id: String(id).replace(/[^\d]/g, "") || `${normalizeLoginKey(login)}-${index}`,
    login,
    loginKey: normalizeLoginKey(login),
    vencimento,
    status: teste ? "teste" : (rawVencido || isPastDate(vencimento) ? "vencido" : "ativo"),
    teste
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
  const teste = /\(teste\)/i.test(usuarioBruto);
  const rawVencido = /expirada|vencida|vencido/i.test(statusBruto);

  return {
    id: `${normalizeLoginKey(login)}-${index}`,
    login,
    loginKey: normalizeLoginKey(login),
    vencimento,
    status: teste ? "teste" : (rawVencido || isPastDate(vencimento) ? "vencido" : "ativo"),
    teste
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
  const teste = /\(teste\)/i.test(usuarioBruto);

  return {
    id: `${normalizeLoginKey(login)}-${index}`,
    login,
    loginKey: normalizeLoginKey(login),
    vencimento,
    status: teste ? "teste" : (isPastDate(vencimento) ? "vencido" : "ativo"),
    teste
  };
}

function parseListaManual(texto) {
  const lines = String(texto || "")
    .split("\n")
    .map(line => line.replace(/\r/g, ""))
    .filter(line => line.trim() !== "");

  const clientes = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const parsed =
      parseLinhaModeloAntigo(line, i) ||
      parseLinhaModeloNovoComStatus(line, i) ||
      parseLinhaModeloNovoSemStatus(line, i);

    if (!parsed) continue;

    clientes.push({
      id: parsed.id,
      login: parsed.login,
      loginKey: parsed.loginKey,
      vencimento: parsed.vencimento,
      status: parsed.status,
      teste: parsed.teste,
      observacao: store.observacoes[parsed.loginKey] || ""
    });
  }

  return clientes;
}

function montarResumoMensal(clientes, pagosLista = [], renovadosLista = []) {
  const totalClientes = clientes.length;
  const vencidos = clientes.filter(c => c.status === "vencido").length;
  const testesGerados = clientes.filter(c => c.status === "teste").length;
  const renovacoes = renovadosLista.length;
  const dinheiroBruto = pagosLista.length * 30;

  return {
    totalClientes,
    renovacoes,
    vencidos,
    testesGerados,
    dinheiroBruto
  };
}

function getMesReferencia(clientes) {
  const primeiro = clientes.find(c => /^\d{2}\/\d{2}\/\d{4}$/.test(c.vencimento || ""));
  if (!primeiro) {
    const hoje = new Date();
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    const yyyy = String(hoje.getFullYear());
    return { chave: `${mm}-${yyyy}`, label: `${mm}/${yyyy}` };
  }

  const [, mm, yyyy] = primeiro.vencimento.split("/");
  return {
    chave: `${mm}-${yyyy}`,
    label: `${mm}/${yyyy}`
  };
}

function contatosByCurrentIds() {
  const result = {};
  for (const cliente of store.clientes) {
    const telefone = store.contatos[cliente.loginKey];
    if (telefone) result[cliente.id] = telefone;
  }
  return result;
}

function observacoesByCurrentIds() {
  const result = {};
  for (const cliente of store.clientes) {
    const obs = store.observacoes[cliente.loginKey] || "";
    result[cliente.id] = obs;
  }
  return result;
}

function atualizarResumoMensalAtual() {
  if (!Array.isArray(store.listasHistorico) || !store.listasHistorico.length) return;

  const mesRef = getMesReferencia(store.clientes);
  const idx = store.listasHistorico.findIndex(item => item.mes === mesRef.chave);
  if (idx === -1) return;

  store.listasHistorico[idx] = {
    ...store.listasHistorico[idx],
    resumo: montarResumoMensal(store.clientes, store.pagos, store.renovados),
    clientes: store.clientes.map(cliente => ({
      ...cliente,
      telefone: store.contatos[cliente.loginKey] || "",
      observacao: store.observacoes[cliente.loginKey] || "",
      pago: store.pagos.includes(cliente.id),
      renovado: store.renovados.includes(cliente.id)
    }))
  };
}

router.get("/", (req, res) => {
  res.json({
    result: true,
    total: store.clientes.length,
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

    const mesRef = getMesReferencia(novosClientes);

    store.clientes = novosClientes;
    store.pagos = [];
    store.renovados = [];

    const resumo = montarResumoMensal(novosClientes, store.pagos, store.renovados);

    const historicoMes = {
      id: String(Date.now()),
      mes: mesRef.chave,
      label: mesRef.label,
      dataImportacao: new Date().toISOString(),
      resumo,
      clientes: novosClientes.map(cliente => ({
        ...cliente,
        telefone: store.contatos[cliente.loginKey] || "",
        observacao: store.observacoes[cliente.loginKey] || "",
        pago: false,
        renovado: false
      }))
    };

    store.listasHistorico = (store.listasHistorico || []).filter(item => item.mes !== mesRef.chave);
    store.listasHistorico.unshift(historicoMes);

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
      message: "Erro ao processar lista manual.",
      error: error.message
    });
  }
});

router.post("/limpar-lista", (req, res) => {
  store.clientes = [];
  store.pagos = [];
  store.renovados = [];

  store.historico.push({
    acao: "limpou_lista_manual",
    data: new Date().toISOString()
  });

  atualizarResumoMensalAtual();
  saveStore();

  res.json({ ok: true });
});

router.get("/pagos", (req, res) => {
  res.json(store.pagos || []);
});

router.get("/renovados", (req, res) => {
  res.json(store.renovados || []);
});

router.post("/pagar/:id", (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);

    if (!store.pagos.includes(id)) {
      store.pagos.push(id);
    }

    store.historico.push({
      id,
      acao: "marcou_pago",
      data: new Date().toISOString()
    });

    atualizarResumoMensalAtual();
    saveStore();

    res.json({
      ok: true,
      pagos: store.pagos
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

    store.pagos = store.pagos.filter(item => item !== id);

    store.historico.push({
      id,
      acao: "desmarcou_pago",
      data: new Date().toISOString()
    });

    atualizarResumoMensalAtual();
    saveStore();

    res.json({
      ok: true,
      pagos: store.pagos
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

router.post("/renovado/:id", (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);

    if (!store.renovados.includes(id)) {
      store.renovados.push(id);
    }

    store.historico.push({
      id,
      acao: "marcou_renovado",
      data: new Date().toISOString()
    });

    atualizarResumoMensalAtual();
    saveStore();

    res.json({
      ok: true,
      renovados: store.renovados
    });
  } catch (error) {
    console.error("Erro em /renovado/:id:", error);
    res.status(500).json({
      ok: false,
      message: "Erro ao marcar como renovado.",
      error: error.message
    });
  }
});
router.post("/desmarcar-renovado/:id", (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);

    store.renovados = store.renovados.filter(item => item !== id);

    store.historico.push({
      id,
      acao: "desmarcou_renovado",
      data: new Date().toISOString()
    });

    atualizarResumoMensalAtual();
    saveStore();

    res.json({
      ok: true,
      renovados: store.renovados
    });
  } catch (error) {
    console.error("Erro em /desmarcar-renovado/:id:", error);
    res.status(500).json({
      ok: false,
      message: "Erro ao desmarcar renovado.",
      error: error.message
    });
  }
});
router.get("/contatos", (req, res) => {
  res.json(contatosByCurrentIds());
});

router.post("/contatos/:id", (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);
    const { telefone } = req.body || {};
    const cliente = store.clientes.find(c => c.id === id);

    if (!cliente) {
      return res.status(404).json({
        ok: false,
        message: "Cliente não encontrado."
      });
    }

    if (!telefone) {
      return res.status(400).json({
        ok: false,
        message: "Telefone é obrigatório."
      });
    }

    const numeroLimpo = String(telefone).replace(/\D/g, "");

    if (numeroLimpo.length < 10) {
      return res.status(400).json({
        ok: false,
        message: "Telefone inválido."
      });
    }

    store.contatos[cliente.loginKey] = numeroLimpo;
    atualizarResumoMensalAtual();
    saveStore();

    res.json({
      ok: true,
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
    const cliente = store.clientes.find(c => c.id === id);

    if (!cliente) {
      return res.status(404).json({
        ok: false,
        message: "Cliente não encontrado."
      });
    }

    delete store.contatos[cliente.loginKey];
    atualizarResumoMensalAtual();
    saveStore();

    res.json({
      ok: true
    });
  } catch (error) {
    console.error("Erro ao remover contato:", error);
    res.status(500).json({
      ok: false,
      message: "Erro ao remover contato.",
      error: error.message
    });
  }
});

router.get("/observacoes", (req, res) => {
  res.json(observacoesByCurrentIds());
});

router.post("/observacoes/:id", (req, res) => {
  try {
    const id = decodeURIComponent(req.params.id);
    const { observacao } = req.body || {};
    const cliente = store.clientes.find(c => c.id === id);

    if (!cliente) {
      return res.status(404).json({
        ok: false,
        message: "Cliente não encontrado."
      });
    }

    store.observacoes[cliente.loginKey] = String(observacao || "").trim();

    const clienteAtual = store.clientes.find(c => c.id === id);
    if (clienteAtual) {
      clienteAtual.observacao = store.observacoes[cliente.loginKey];
    }

    atualizarResumoMensalAtual();
    saveStore();

    res.json({
      ok: true,
      observacao: store.observacoes[cliente.loginKey]
    });
  } catch (error) {
    console.error("Erro em /observacoes/:id:", error);
    res.status(500).json({
      ok: false,
      message: "Erro ao salvar observação.",
      error: error.message
    });
  }
});

router.get("/listas-historico", (req, res) => {
  const listas = (store.listasHistorico || []).map(item => ({
    id: item.id,
    mes: item.mes,
    label: item.label,
    dataImportacao: item.dataImportacao,
    resumo: item.resumo
  }));

  res.json({
    ok: true,
    listas
  });
});

router.get("/listas-historico/:mes", (req, res) => {
  const mes = decodeURIComponent(req.params.mes);

  const item = (store.listasHistorico || []).find(entry => entry.mes === mes);

  if (!item) {
    return res.status(404).json({
      ok: false,
      message: "Resumo do mês não encontrado."
    });
  }

  res.json({
    ok: true,
    item
  });
});

export default router;
