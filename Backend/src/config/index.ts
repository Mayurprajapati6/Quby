// This file contains all the basic configuration logic for the app server to work
import dotenv from 'dotenv';

type ServerConfig = {
    PORT: number,
    JWT_SECRET: string,
    JWT_REFRESH_SECRET: string,
    JWT_REFRESH_SECRET_EXPIRES_IN: string,
    JWT_ACCESS_SECRET_EXPIRES_IN: string,
    CLOUDINARY_CLOUD_NAME: string,
    CLOUDINARY_API_KEY: string,
    CLOUDINARY_API_SECRET: string,
    CORS_ORIGIN: string,
    REDIS_PORT?: number,
    REDIS_HOST?: string,
    MAIL_PASS?: string,
    MAIL_USER?: string,
    RAZORPAY_KEY_ID: string,
    RAZORPAY_KEY_SECRET: string,
    RAZORPAY_WEBHOOK_SECRET: string
}

function loadEnv() {
    dotenv.config();
    console.log(`Environment variables loaded`);
}

loadEnv();

export const serverConfig: ServerConfig = {
    PORT: Number(process.env.PORT) || 3001,
    JWT_SECRET: process.env.JWT_SECRET || "",
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "",
    JWT_REFRESH_SECRET_EXPIRES_IN: process.env.JWT_REFRESH_SECRET_EXPIRES_IN || "",
    JWT_ACCESS_SECRET_EXPIRES_IN: process.env.JWT_ACCESS_SECRET_EXPIRES_IN || "",
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
    CORS_ORIGIN: process.env.CORS_ORIGIN || "",
    REDIS_PORT: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    MAIL_PASS: process.env.MAIL_PASS || '',
    MAIL_USER: process.env.MAIL_USER || '',
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || "",
};