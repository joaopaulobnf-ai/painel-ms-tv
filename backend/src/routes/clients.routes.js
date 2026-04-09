import express from "express";
import { store } from "../store.js";

const router = express.Router();

// Simulação: aqui você pode integrar com sua API real depois
router.get("/sync", (req, res) => {
  res.json({
    result: true,
    total: store.clientes.length,
    clients: store.clientes,
  });
});

// marcar pago
router.post("/pagar/:id", (req, res) => {
  const { id } = req.params;

  store.pagos.add(id);
  store.historico.push({
    id,
    data: new Date(),
  });

  res.json({ ok: true });
});

// listar pagos
router.get("/pagos", (req, res) => {
  res.json([...store.pagos]);
});

// adicionar cliente manual (teste)
router.post("/add", (req, res) => {
  const cliente = {
    id: Date.now().toString(),
    ...req.body,
  };

  store.clientes.push(cliente);

  res.json(cliente);
});

export default router;
