import { fetchMyLists } from "../services/pdcapi.service.js";
import { env } from "../config/env.js";
import { isExpired } from "../utils/date.js";

export async function financeSummary(req, res) {
  try {
    const payload = await fetchMyLists({ length: 1000 });
    const items = payload.data || [];
    const mensalidade = Number(req.query.monthlyPrice || env.defaultMonthlyPrice);

    const trials = items.filter((c) => c.is_trial === "1");
    const paid = items.filter((c) => c.is_trial !== "1");
    const overdue = paid.filter((c) => isExpired(c.exp_date));
    const activePaid = paid.filter((c) => !isExpired(c.exp_date) && c.status === "1");

    res.json({
      result: true,
      data: {
        mensalidadeBase: mensalidade,
        totalClientes: items.length,
        clientesPagantes: paid.length,
        testes: trials.length,
        clientesAtivosPagantes: activePaid.length,
        inadimplentes: overdue.length,
        receitaPrevista: paid.length * mensalidade,
        receitaAtivos: activePaid.length * mensalidade,
        receitaEmRisco: overdue.length * mensalidade
      }
    });
  } catch (error) {
    res.status(500).json({
      result: false,
      message: "Erro ao gerar resumo financeiro.",
      detail: error.response?.data || error.message
    });
  }
}
