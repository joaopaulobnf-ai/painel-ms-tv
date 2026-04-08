import { Router } from "express";
import { financeSummary } from "../controllers/finance.controller.js";

const router = Router();
router.get("/summary", financeSummary);
export default router;
