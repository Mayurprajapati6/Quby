// This file contains all the basic configuration logic for the app server to work
import dotenv from 'dotenv';

type ServerConfig = {
    PORT: number,
    NODE_ENV: string,
    JWT_SECRET: string,
    JWT_REFRESH_SECRET: string,
    JWT_REFRESH_SECRET_EXPIRES_IN: string,
    JWT_ACCESS_SECRET_EXPIRES_IN: string,
    CLOUDINARY_CLOUD_NAME: string,
    CLOUDINARY_API_KEY: string,
    CLOUDINARY_API_SECRET: string,
    CORS_ORIGIN: string,
    CLIENT_URL: string,
    REDIS_PORT?: number,
    REDIS_HOST?: string,
    REDIS_PASSWORD?: string,
    REDIS_DB?: number,
    MAIL_PASS?: string,
    MAIL_USER?: string,
    RAZORPAY_KEY_ID: string,
    RAZORPAY_KEY_SECRET: string,
    RAZORPAY_WEBHOOK_SECRET: string,
    APP_LOGO_URL: string,
    APP_NAME: string
}

function loadEnv() {
    dotenv.config();
    console.log(`Environment variables loaded`);
}

loadEnv();

export const serverConfig: ServerConfig = {
    PORT: Number(process.env.PORT) || 3001,
    NODE_ENV: process.env.NODE_ENV || "development",
    JWT_SECRET: process.env.JWT_SECRET || "",
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "",
    JWT_REFRESH_SECRET_EXPIRES_IN: process.env.JWT_REFRESH_SECRET_EXPIRES_IN || "",
    JWT_ACCESS_SECRET_EXPIRES_IN: process.env.JWT_ACCESS_SECRET_EXPIRES_IN || "",
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
    CORS_ORIGIN: process.env.CORS_ORIGIN || "",
    CLIENT_URL: process.env.CORS_ORIGIN || "",
    REDIS_PORT: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || "",
    REDIS_DB: process.env.REDIS_DB ? Number(process.env.REDIS_DB) : 0,
    MAIL_PASS: process.env.MAIL_PASS || '',
    MAIL_USER: process.env.MAIL_USER || '',
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || "",
    APP_LOGO_URL: process.env.APP_LOGO_URL || "https://placehold.co/160x56/c9a96e/0f0f0f?text=Quby",
    APP_NAME: process.env.APP_NAME || "Quby"
};