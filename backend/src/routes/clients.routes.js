import express from "express";
import { store, saveStore } from "../store.js";

const router = express.Router();

// ==========================
// LISTAR CLIENTES
// ==========================
router.get("/clients", (req, res) => {
  res.json(store.clients || []);
});

// ==========================
// MARCAR COMO PAGO
// ==========================
router.post("/clients/:id/pay", (req, res) => {
  const { id } = req.params;

  const client = store.clients.find(c => c.id == id);
  if (!client) return res.status(404).json({ error: "Cliente não encontrado" });

  client.pago = true;

  saveStore();
  res.json({ ok: true });
});

// ==========================
// DESMARCAR PAGO
// ==========================
router.post("/clients/:id/unpay", (req, res) => {
  const { id } = req.params;

  const client = store.clients.find(c => c.id == id);
  if (!client) return res.status(404).json({ error: "Cliente não encontrado" });

  client.pago = false;

  saveStore();
  res.json({ ok: true });
});

// ==========================
// SALVAR WHATSAPP
// ==========================
router.post("/clients/:id/whatsapp", (req, res) => {
  const { id } = req.params;
  const { telefone } = req.body;

  const client = store.clients.find(c => c.id == id);
  if (!client) return res.status(404).json({ error: "Cliente não encontrado" });

  client.telefone = String(telefone).replace(/\D/g, "");

  saveStore();

  res.json({ ok: true });
});

export default router;
