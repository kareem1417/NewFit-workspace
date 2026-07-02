import swaggerAutogen from 'swagger-autogen';
import path from 'path';
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
const outputFile = path.join(__dirname, 'swagger-output.json');
const endpointsFiles = [path.join(__dirname, 'app.ts')]; // 👈 تأكد إن ده مسار ملف السيرفر الرئيسي بتاعك

// توليد ملف الـ Swagger
swaggerAutogen()(outputFile, endpointsFiles, doc).then(() => {
    console.log("Swagger UI documentation generated successfully!");
});