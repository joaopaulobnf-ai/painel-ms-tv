function cleanBrazilPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function whatsappLink(req, res) {
  const phone = cleanBrazilPhone(req.query.phone);
  const login = req.query.login || "cliente";
  const dueDate = req.query.dueDate || "";
  const price = req.query.price || "30,00";

  if (!phone) {
    return res.status(400).json({ result: false, message: "Informe o telefone." });
  }

  const text = `Olá, tudo bem? Sua lista ${login} ${dueDate ? `vence em ${dueDate}` : "está próxima do vencimento"}. Para renovar, o valor é R$ ${price}. Se desejar, te envio a chave PIX.`;
  const link = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

  return res.json({ result: true, link, text });
}
