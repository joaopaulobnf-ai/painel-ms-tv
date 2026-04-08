import { fetchMyLists } from "../services/pdcapi.service.js";
import { daysUntil, fromUnixTimestamp, isExpired } from "../utils/date.js";

function normalizeConnectionCount(html) {
  if (!html) return { current: 0, max: 0 };
  const match = String(html).match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return { current: 0, max: 0 };
  return { current: Number(match[1]), max: Number(match[2]) };
}

function mapClient(item) {
  const due = fromUnixTimestamp(item.exp_date);
  const expired = isExpired(item.exp_date);
  const trial = item.is_trial === "1";
  const active = item.status === "1";
  const connectionInfo = normalizeConnectionCount(item.conexoes);

  return {
    id: item.id,
    login: item.username,
    statusOriginal: item.status,
    status: trial ? "teste" : active ? (expired ? "vencido" : "ativo") : "inativo",
    ativo: active && !expired,
    vencido: expired,
    teste: trial,
    vencimento: due?.br || null,
    vencimentoIso: due?.iso || null,
    diasParaVencer: daysUntil(item.exp_date),
    autoRenovar: item.auto_renew === "1",
    maxConexoes: Number(item.max_con || connectionInfo.max || 0),
    conexoesAtuais: connectionInfo.current,
    conexoesHtml: item.conexoes || "",
    observacoes: item.reseller_notes || "",
    memberId: item.member_id || "",
    forceServerId: item.force_server_id || "0"
  };
}

export async function syncClients(req, res) {
  try {
    const payload = await fetchMyLists({ length: 1000 });
    const clients = (payload.data || []).map(mapClient);

    res.json({
      result: true,
      syncedAt: new Date().toISOString(),
      total: payload.recordsTotal || clients.length,
      filtered: payload.recordsFiltered || clients.length,
      clients
    });
  } catch (error) {
    res.status(500).json({
      result: false,
      message: "Erro ao sincronizar clientes.",
      detail: error.response?.data || error.message
    });
  }
}

export async function listClients(req, res) {
  try {
    const payload = await fetchMyLists({ length: 1000 });
    let clients = (payload.data || []).map(mapClient);

    const q = String(req.query.q || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim().toLowerCase();

    if (q) {
      clients = clients.filter((c) => c.login.toLowerCase().includes(q));
    }
    if (status) {
      clients = clients.filter((c) => c.status === status);
    }

    res.json({ result: true, total: clients.length, clients });
  } catch (error) {
    res.status(500).json({
      result: false,
      message: "Erro ao listar clientes.",
      detail: error.response?.data || error.message
    });
  }
}

export async function dashboardSummary(req, res) {
  try {
    const payload = await fetchMyLists({ length: 1000 });
    const clients = (payload.data || []).map(mapClient);

    const total = clients.length;
    const ativos = clients.filter((c) => c.status === "ativo").length;
    const testes = clients.filter((c) => c.teste).length;
    const vencidos = clients.filter((c) => c.vencido && !c.teste).length;
    const online = clients.reduce((acc, c) => acc + (c.conexoesAtuais > 0 ? 1 : 0), 0);

    res.json({
      result: true,
      data: {
        totalClientes: total,
        ativos,
        testes,
        vencidos,
        online,
        syncedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      result: false,
      message: "Erro ao gerar dashboard.",
      detail: error.response?.data || error.message
    });
  }
}

export async function expiringClients(req, res) {
  try {
    const days = Number(req.query.days || 3);
    const payload = await fetchMyLists({ length: 1000 });
    const clients = (payload.data || []).map(mapClient)
      .filter((c) => c.diasParaVencer !== null && c.diasParaVencer <= days);

    res.json({ result: true, total: clients.length, days, clients });
  } catch (error) {
    res.status(500).json({
      result: false,
      message: "Erro ao listar vencimentos.",
      detail: error.response?.data || error.message
    });
  }
}
