"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const swagger_autogen_1 = __importDefault(require("swagger-autogen"));
const path_1 = __importDefault(require("path"));
const doc = {
    info: {
        title: 'NeoFit API',
        description: 'Complete API Documentation for NeoFit App',
        version: '1.0.0',
    },
    host: 'localhost:3000',
    schemes: ['http'],
    securityDefinitions: {
        bearerAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'Authorization',
            description: 'Enter your bearer token in the format: Bearer <token>'
        }
    }
};
const outputFile = path_1.default.join(__dirname, '../swagger-output.json');
const endpointsFiles = [path_1.default.join(__dirname, 'app.ts')];
// توليد ملف الـ Swagger
(0, swagger_autogen_1.default)()(outputFile, endpointsFiles, doc).then(() => {
    console.log("Swagger UI documentation generated successfully!");
});
