export const store = {
  pagos: new Map(), // id -> { paidAt, paidOnTime }
  contatos: new Map(), // id -> telefone
  promocaoDoDia: "",
  historicoPagamentos: [],
  ultimoSorteio: null,
  whatsappPadrao: "62991133110",
};