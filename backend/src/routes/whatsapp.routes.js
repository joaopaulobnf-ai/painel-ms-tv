import { Router } from "express";
import { whatsappLink } from "../controllers/whatsapp.controller.js";

const router = Router();
router.get("/link", whatsappLink);
export default router;
