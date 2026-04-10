import express from "express";
import { createSession, getSession, removeSession } from "../store.js";

const router = express.Router();

function getPanelCredentials() {
  return {
    username: process.env.PANEL_USER || "admin",
    password: process.env.PANEL_PASS || "123456"
  };
}

function readTokenFromRequest(req) {
  const authHeader = req.headers.authorization || "";

  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  const cookieHeader = req.headers.cookie || "";
  const cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map(v => v.trim())
      .filter(Boolean)
      .map(part => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );

  return cookies.ms_tv_session || null;
}

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  const valid = getPanelCredentials();

  if (username !== valid.username || password !== valid.password) {
    return res.status(401).json({
      ok: false,
      message: "Usuário ou senha inválidos."
    });
  }

  const token = createSession(username);

  res.setHeader(
    "Set-Cookie",
    `ms_tv_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
  );

  res.json({
    ok: true,
    token,
    username
  });
});

router.get("/me", (req, res) => {
  const token = readTokenFromRequest(req);
  const session = getSession(token);

  if (!session) {
    return res.status(401).json({
      ok: false,
      authenticated: false
    });
  }

  res.json({
    ok: true,
    authenticated: true,
    username: session.username
  });
});

router.post("/logout", (req, res) => {
  const token = readTokenFromRequest(req);

  if (token) {
    removeSession(token);
  }

  res.setHeader(
    "Set-Cookie",
    "ms_tv_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
  );

  res.json({
    ok: true
  });
});

export function requireAuth(req, res, next) {
  if (req.path === "/health") {
    return next();
  }

  if (req.path.startsWith("/api/auth/")) {
    return next();
  }

  const token = readTokenFromRequest(req);
  const session = getSession(token);

  if (!session) {
    return res.status(401).json({
      ok: false,
      message: "Sessão expirada. Faça login novamente."
    });
  }

  req.user = session;
  next();
}

export default router;
