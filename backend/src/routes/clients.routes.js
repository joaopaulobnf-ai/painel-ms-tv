import { Router } from "express";
import { getClients, syncClients } from "../controllers/clients.controller.js";
import { store } from "../store.js";

const router = Router();

function normalizePhone(phone = "") {
  return String(phone).replace(/\D/g, "");
}

router.get("/", getClients);
router.get("/sync", syncClients);

router.post("/pagar/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { dueDate, login } = req.body || {};

    const today = new Date();
    let paidOnTime = false;

    if (dueDate && typeof dueDate === "string" && dueDate.includes("/")) {
      const [day, month, year] = dueDate.split("/").map(Number);
      const due = new Date(year, month - 1, day, 23, 59, 59);
      paidOnTime = today <= due;
    }

    store.pagos.set(id, {
      paidAt: new Date().toISOString(),
      paidOnTime,
      login: login || "",
      dueDate: dueDate || "",
    });

    store.historicoPagamentos.push({
      id,
      login: login || "",
      dueDate: dueDate || "",
      paidAt: new Date().toISOString(),
      paidOnTime,
    });

    res.json({ ok: true, id, paidOnTime });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Erro ao marcar como pago" });
  }
});

router.post("/desfazer-pago/:id", (req, res) => {
  const { id } = req.params;
  store.pagos.delete(id);
  res.json({ ok: true, id });
});

router.get("/pagos", (req, res) => {
  const pagos = Array.from(store.pagos.entries()).map(([id, data]) => ({
    id,
    ...data,
  }));
  res.json({ ok: true, pagos });
});

router.post("/contato/:id", (req, res) => {
  const { id } = req.params;
  const { telefone } = req.body || {};
  const phone = normalizePhone(telefone);

  if (!phone) {
    return res.status(400).json({ ok: false, error: "Telefone inválido" });
  }

  store.contatos.set(id, phone);
  res.json({ ok: true, id, telefone: phone });
});

router.get("/contatos", (req, res) => {
  const contatos = Array.from(store.contatos.entries()).map(([id, telefone]) => ({
    id,
    telefone,
  }));
  res.json({ ok: true, contatos });
});

router.post("/promocao", (req, res) => {
  const { mensagem } = req.body || {};
  store.promocaoDoDia = String(mensagem || "").trim();
  res.json({ ok: true, mensagem: store.promocaoDoDia });
});

router.get("/promocao", (req, res) => {
  res.json({ ok: true, mensagem: store.promocaoDoDia });
});

router.get("/sorteio", (req, res) => {
  const elegiveis = Array.from(store.pagos.entries())
    .filter(([, data]) => data.paidOnTime)
    .map(([id, data]) => ({
      id,
      login: data.login || "",
      dueDate: data.dueDate || "",
      paidAt: data.paidAt,
    }));

  if (!elegiveis.length) {
    return res.json({
      ok: true,
      totalElegiveis: 0,
      ganhador: null,
      mensagem: "Nenhum cliente elegível para o sorteio.",
    });
  }

  const index = Math.floor(Math.random() * elegiveis.length);
  const ganhador = elegiveis[index];

  store.ultimoSorteio = {
    ...ganhador,
    sorteadoEm: new Date().toISOString(),
  };

  res.json({
    ok: true,
    totalElegiveis: elegiveis.length,
    ganhador: store.ultimoSorteio,
  });
});

router.get("/sorteio/ultimo", (req, res) => {
  res.json({
    ok: true,
    resultado: store.ultimoSorteio,
  });
});

export default router;
