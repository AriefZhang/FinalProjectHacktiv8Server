const router = require("express").Router();

const {
  payment,
  firstInstallment,
  nextInstallment,
  status,
  updatePayment,
  statusMidtrans,
  histories,
  updatePaid,
} = require("../controllers/paymentController");
const adminAuthentication = require("../middlewares/adminAuth");

const buyerAuthentication = require("../middlewares/buyerAuth");

router.post("/", buyerAuthentication, payment);
router.get("/status", buyerAuthentication, status);
router.post("/status/midtrans", adminAuthentication, statusMidtrans);
router.post("/credits/cars", buyerAuthentication, nextInstallment);
router.patch("/update/:id?", buyerAuthentication, updatePayment);
router.post("/credits/:id?", buyerAuthentication, firstInstallment);
router.get("/histories", histories);
router.patch("/histories/:id", updatePaid);

module.exports = router;
