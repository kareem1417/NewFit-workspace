"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const search_controller_1 = require("../controllers/search.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Search routes
router.get('/', auth_middleware_1.authenticateToken, search_controller_1.search);
router.post('/sync', auth_middleware_1.authenticateToken, search_controller_1.syncSearchVectors);
exports.default = router;
