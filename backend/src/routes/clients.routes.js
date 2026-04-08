import { Router } from "express";
import { dashboardSummary, expiringClients, listClients, syncClients } from "../controllers/clients.controller.js";

const router = Router();
router.get("/", listClients);
router.get("/sync", syncClients);
router.get("/dashboard", dashboardSummary);
router.get("/expiring", expiringClients);
export default router;
