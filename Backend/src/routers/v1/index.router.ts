import express from 'express';
import pingRouter from './ping.router';
import authRouter from '../../module/auth/auth.routes';
import customerRouter from '../../module/customer/customer.routes';
import ownerRouter from '../../module/owner/owner.routes';
import adminRouter from '../../module/admin/admin.routes';

const v1Router = express.Router();


v1Router.use('/ping',  pingRouter);

v1Router.use('/auth', authRouter);

v1Router.use('/customer', customerRouter);

v1Router.use('/owner', ownerRouter);

v1Router.use('/admin', adminRouter);

export default v1Router;