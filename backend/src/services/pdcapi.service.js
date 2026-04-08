import axios from "axios";
import { env } from "../config/env.js";

function buildDataTableBody({ draw = 1, start = 0, length = 1000 } = {}) {
  return new URLSearchParams({
    draw: String(draw),
    start: String(start),
    length: String(length)
  }).toString();
}

export async function fetchMyLists(params = {}) {
  if (!env.pdcToken) {
    throw new Error("PDC_TOKEN não configurado.");
  }

  const body = buildDataTableBody(params);
  const response = await axios.post(`${env.pdcApiUrl}/listas/minhas`, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/json, text/javascript, */*; q=0.01",
      Origin: env.pdcOrigin,
      Referer: `${env.pdcOrigin}/`,
      "x-access-token": env.pdcToken,
      x_filtro: "todas"
    },
    timeout: 30000
  });
  return response.data;
}
