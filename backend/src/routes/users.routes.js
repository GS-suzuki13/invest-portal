const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const controller = require("../controllers/users.controller");
const { authRequired, adminRequired } = require("../middlewares/auth");

const loginLimiter = rateLimit({
  windowMs: (Number(process.env.LOGIN_RATELIMIT_WINDOW_MIN) || 15) * 60 * 1000,
  max: Number(process.env.LOGIN_RATELIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Só contam as tentativas que FALHARAM — logins bem-sucedidos não gastam a cota
  // (evita travar quem está usando o sistema de verdade).
  skipSuccessfulRequests: true,
  message: { error: "Muitas tentativas de login. Tente novamente mais tarde." },
});

router.post("/login", loginLimiter, controller.login);
router.get("/me", authRequired, controller.me);
router.post("/me/onboarding", authRequired, controller.marcarOnboarding);

router.get("/", adminRequired, controller.getAll);
router.post("/", adminRequired, controller.create);
router.put("/:id", adminRequired, controller.update);
router.delete("/:id", adminRequired, controller.remove);

module.exports = router;
