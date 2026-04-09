router.get("/contatos", (req, res) => {
  res.json(store.contatos);
});

router.post("/contatos/:id", (req, res) => {
  const { id } = req.params;
  const { telefone } = req.body;

  if (!telefone) {
    return res.status(400).json({ ok: false, message: "Telefone é obrigatório" });
  }

  const numeroLimpo = String(telefone).replace(/\D/g, "");

  store.contatos[id] = numeroLimpo;

  res.json({
    ok: true,
    id,
    telefone: numeroLimpo
  });
});
