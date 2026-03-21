import Razorpay      from "razorpay";
import { serverConfig } from "./index";

export const razorpay = new Razorpay({
  key_id:     serverConfig.RAZORPAY_KEY_ID,
  key_secret: serverConfig.RAZORPAY_KEY_SECRET,
});
