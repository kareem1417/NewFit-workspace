"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const search_controller_1 = require("../controllers/search.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validation_middleware_1 = require("../middlewares/validation.middleware");
const search_validator_1 = require("../validators/search.validator");
const router = (0, express_1.Router)();
// 🎯 Search routes with Validations
router.get('/', auth_middleware_1.authenticateToken, search_validator_1.searchValidation, validation_middleware_1.validate, search_controller_1.search);
// 🎯 Sync route strictly protected for Admins
router.post('/sync', auth_middleware_1.authenticateToken, search_validator_1.syncSearchValidation, validation_middleware_1.validate, search_controller_1.syncSearchVectors);
exports.default = router;
// ==========================================
