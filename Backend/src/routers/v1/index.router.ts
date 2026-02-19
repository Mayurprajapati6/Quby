import express from 'express';
import pingRouter from './ping.router';
import authRouter from '../../module/auth/auth.routes';
import customerRouter from '../../module/customer/customer.routes';

const v1Router = express.Router();



v1Router.use('/ping',  pingRouter);

v1Router.use('/auth', authRouter);

v1Router.use('/customer', customerRouter);

export default v1Router;