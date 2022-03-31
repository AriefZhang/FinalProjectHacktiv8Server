const core = require("../API/core_MidtransAPI");
const snap = require("../API/snap_MidtransAPI");
const apiClient = require("../API/apiClient_MidtransAPI");

const {
  BoughtHistory,
  Buyer,
  Car,
  Dealer,
  Type,
  Brand,
  sequelize,
} = require("../models");
const { format, add } = require("date-fns");

//! CASH PAYMENT
const payment = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { quantity, carId, notes } = req.body;
    const buyerId = req.loginBuyer.id;

    if (!quantity) {
      throw {
        code: 400,
        name: "BAD_REQUEST",
        message: "Quantity can't be empty.",
      };
    }

    if (!carId) {
      throw {
        code: 400,
        name: "BAD_REQUEST",
        message: "Car ID can't be empty.",
      };
    }

    const buyer = await Buyer.findByPk(buyerId);

    const car = await Car.findOne({
      where: {
        id: carId,
      },
      include: [
        {
          model: Type,
          include: {
            model: Brand,
          },
        },
        {
          model: Dealer,
        },
      ],
    });

    if (!car || car.status == "sold") {
      throw {
        code: 404,
        name: "NOT_FOUND",
        message: "Car not found.",
      };
    }

    if (car.status == "pending") {
      throw {
        code: 403,
        name: "FORBIDDEN",
        message: "Car status pending payment for other transaction.",
      };
    }

    const checkCar = await BoughtHistory.findAll({
      where: {
        CarId: carId,
      },
    });

    if (checkCar.length) {
      throw {
        code: 403,
        name: "FORBIDDEN",
        message: "Car already in subcription with term.",
      };
    }

    const history = await BoughtHistory.findAll();
    let orderId;

    if (!history.length) {
      orderId = "OTOSIC-" + 1 + "-" + new Date().getTime();
    } else {
      let num = history[history.length - 1].id + 1;
      orderId = "OTOSIC-" + num + "-" + new Date().getTime();
    }

    const date = format(
      new Date(add(new Date(), { days: 1 })),
      "yyyy-MM-dd hh:mm:ss " + "+0700"
    );

    let parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: car.price,
      },
      item_details: [
        {
          id: carId,
          price: car.price,
          quantity: quantity,
          name: car.name,
          brand: car.Type.Brand.name,
          category: car.Type.modelName,
          merchant_name: car.Dealer.name,
        },
      ],
      customer_details: {
        username: buyer.username,
        email: buyer.email,
        phone: buyer.phoneNumber,
        shipping_address: {
          name: buyer.username,
          email: buyer.email,
          phone: buyer.phoneNumber,
          address: buyer.address,
        },
      },
      enabled_payments: [
        "mandiri_clickpay",
        "cimb_clicks",
        "bca_klikbca",
        "bca_klikpay",
        "bri_epay",
        "echannel",
        "mandiri_ecash",
        "bca_va",
        "bni_va",
        "other_va",
        "gopay",
        "indomaret",
        "alfamart",
        "danamon_online",
        "akulaku",
      ],
      schedule: {
        interval: 1,
        interval_unit: "month",
        max_interval: 1,
        start_time: new Date(),
      },
      bca_va: {
        va_number: "125" + buyer.phoneNumber,
        sub_company_code: "00000",
        free_text: {
          inquiry: [
            {
              en: "text in English",
              id: "text in Bahasa Indonesia",
            },
          ],
          payment: [
            {
              en: "text in English",
              id: "text in Bahasa Indonesia",
            },
          ],
        },
      },
      bni_va: {
        va_number: "145" + buyer.phoneNumber,
      },
      callbacks: {
        finish: "https://demo.midtrans.com",
      },
      expiry: {
        start_time: date,
        unit: "minutes",
        duration: 1,
      },
      custom_field1: notes ? notes : "",
    };

    let data = await snap.createTransaction(parameter);

    await Car.update(
      {
        status: "pending",
      },
      {
        where: {
          id: carId,
        },
        transaction: t,
      }
    );

    await BoughtHistory.create({
      carName: car.name,
      description: car.description,
      boughtDate: new Date(),
      paidOff: true,
      price: car.price,
      BuyerId: buyerId,
      orderId,
      CarId: car.id,
      installment: false,
      currentInstallment: 0,
      totalInstallment: 0,
      saved_token_id: "CASH",
    });

    res.status(200).json({
      message: "Please check your payment.",
      token: data.token,
      redirect_url: data.redirect_url,
    });

    await t.commit();
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

//? GET all bough history

const histories = async (req, res, next) => {
  try {
    const histories = await BoughtHistory.findAll();

    res.status(200).json(histories);
  } catch (err) {
    next(err);
  }
};

const updatePaid = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paidOff } = req.body;
    await BoughtHistory.update(
      { paidOff },
      {
        where: {
          id,
        },
      }
    );

    res.status(200).json({ message: "Payment Updated" });
  } catch (err) {
    next(err);
  }
};

//! CHECK STATUS
const status = async (req, res, next) => {
  try {
    const { BuyerId } = req.query;

    if (!BuyerId) {
      throw {
        code: 400,
        name: "BAD_REQUEST",
        message: "Buyer ID can't be empty.",
      };
    }

    const buyer = await Buyer.findByPk(BuyerId);

    if (!buyer) {
      throw {
        code: 404,
        name: "NOT_FOUND",
        message: "Buyer not found.",
      };
    }

    const history = await BoughtHistory.findAll({
      where: {
        BuyerId,
      },
      order: [
        ["id", "DESC"],
        ["BuyerId", "ASC"],
      ],
      attibutes: {
        exclude: ["createdAt", "updatedAt"],
      },
    });

    if (!history.length) {
      throw {
        code: 404,
        name: "NOT_FOUND",
        message: "Bought history not found.",
      };
    }

    res.status(200).json(history);
  } catch (err) {
    next(err);
  }
};

//! UPDATE PAYMENT
const updatePayment = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    if (!req.params.id) {
      throw {
        code: 400,
        name: "BAD_REQUEST",
        message: "Buyer ID can't be empty.",
      };
    }
    const { id } = req.params;
    const { saved_token_id, CarId } = req.body;

    if (!CarId) {
      throw {
        code: 400,
        name: "BAD_REQUEST",
        message: "Car ID can't be empty.",
      };
    }

    const history = await BoughtHistory.findAll({
      where: {
        id,
        CarId,
        paidOff: false,
      },
    });

    if (!history.length) {
      throw {
        code: 400,
        name: "UNAUTHORIZED",
        message: "Please check your input update payment.",
      };
    }

    let data = {
      paidOff: true,
    };

    saved_token_id ? (data.saved_token_id = saved_token_id) : "";

    await BoughtHistory.update(data, {
      where: {
        id: history[0].id,
      },
      transaction: t,
    });

    await Car.update(
      {
        status: "sold",
      },
      {
        where: {
          id: CarId,
        },
        transaction: t,
      }
    );

    res.status(200).json({ message: "Payment status already updated." });

    await t.commit();
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

//! FIRST PAYMENT SUBCRIPTION
const firstInstallment = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    if (!req.params.id) {
      throw {
        code: 400,
        name: "BAD_REQUEST",
        message: "Buyer ID can't be empty.",
      };
    }

    const { id: CarId } = req.params;
    const { term, dp } = req.body;
    const buyerId = req.loginBuyer.id;

    if (!term) {
      throw {
        code: 400,
        name: "BAD_REQUEST",
        message: "Term can't be empty.",
      };
    }

    if (+term > 60) {
      throw {
        code: 400,
        name: "BAD_REQUEST",
        message: "Term can't more than 60 times.",
      };
    }

    if (!dp) {
      throw {
        code: 400,
        name: "BAD_REQUEST",
        message: "Down Payment can't be empty.",
      };
    }

    const car = await Car.findByPk(+CarId);

    if (car) {
      if (dp > car.price) {
        throw {
          code: 400,
          name: "BAD_REQUEST",
          message: "Down Payment can't extent car price.",
        };
      }
    }

    if (!car || car.status == "sold") {
      throw {
        code: 404,
        name: "NOT_FOUND",
        message: "Car not found.",
      };
    }

    if (car.status == "pending") {
      throw {
        code: 400,
        name: "UNAUTHORIZED",
        message: "Car status pending payment for other transaction.",
      };
    }

    const buyer = await Buyer.findByPk(buyerId);

    const checkCar = await BoughtHistory.findAll({
      where: {
        CarId: car.id,
      },
    });

    if (checkCar.length) {
      throw {
        code: 403,
        name: "FORBIDDEN",
        message: "Car already in subcription with term.",
      };
    }

    let name = "MONTHLY_2021_" + CarId + "_0";

    const borrow = car.dataValues.price - dp;

    const installment = Math.ceil(borrow / term + borrow * 0.01);

    const date = format(
      new Date(add(new Date(), { days: 30 })),
      "yyyy-MM-dd hh:mm:ss " + "+0700"
    );

    const history = await BoughtHistory.create(
      {
        carName: car.name,
        description: car.description,
        boughtDate: new Date(),
        paidOff: true,
        price: car.price,
        BuyerId: buyerId,
        orderId: "OTOSIC-0" + car.id + "-" + new Date().getTime() + "-0",
        CarId: car.id,
        installment: true,
        currentInstallment: 1,
        totalInstallment: term,
        saved_token_id: "NULL",
      },
      {
        transaction: t,
      }
    );

    const payload = {
      payment_type: "credit_card",
      transaction_details: {
        order_id: history.orderId,
        gross_amount: dp,
      },
      credit_card: {
        secure: true,
        installment: {
          required: false,
        },
      },
      enabled_payments: [
        "credit_card",
        "mandiri_clickpay",
        "cimb_clicks",
        "bca_klikbca",
        "bca_klikpay",
        "bri_epay",
        "echannel",
        "mandiri_ecash",
        "bca_va",
        "bni_va",
        "other_va",
        "gopay",
        "indomaret",
        "alfamart",
        "danamon_online",
        "akulaku",
      ],
      schedule: {
        interval: 1,
        interval_unit: "month",
        max_interval: 1,
        start_time: new Date(),
      },
      item_details: [
        {
          id: car.id,
          price: dp,
          quantity: 1,
          name: car.name,
        },
      ],
      customer_details: {
        username: buyer.username,
        email: buyer.email,
        phone: buyer.phoneNumber,
        billing_address: {
          username: buyer.username,
          email: buyer.email,
          phone: buyer.phoneNumber,
          address: buyer.address,
        },
        shipping_address: {
          username: buyer.username,
          email: buyer.email,
          phone: buyer.phoneNumber,
          address: buyer.address,
        },
      },
    };

    let payment = await snap.createTransaction(payload);

    let parameter = {
      name,
      amount: installment.toString(),
      currency: "IDR",
      payment_type: "credit_card",
      token: payment.token,
      schedule: {
        interval: 1,
        interval_unit: "month",
        max_interval: +term,
        start_time: date,
      },
      metadata: {
        description: "Recurring payment for " + car.name,
      },
      customer_details: {
        username: buyer.username,
        email: buyer.email,
        phone: buyer.phoneNumber,
      },
    };

    const resp = await core.createSubscription(parameter);

    await Car.update({ subscriptionId: resp.id }, { where: { id: CarId } });

    const data = await core.enableSubscription(resp.id);

    await Car.update(
      {
        status: "pending",
      },
      {
        where: {
          id: car.id,
        },
        transaction: t,
      }
    );

    console.log(payment, "<<<<< PAYMENT 1st");

    res.status(200).json({
      message: payment.status_message,
      token: payment.token,
      paymentUrl: payment.redirect_url,
    });

    await t.commit();
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

//! NEXT PAYMENT SUBCRIPTION
const nextInstallment = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { CarId } = req.body;

    if (!CarId) {
      throw {
        code: 400,
        name: "BAD_REQUEST",
        message: "Car ID can't be empty.",
      };
    }

    const car = await Car.findByPk(+CarId);

    if (!car) {
      throw {
        code: 404,
        name: "NOT_FOUND",
        message: "Car not found.",
      };
    }

    const history = await BoughtHistory.findAll({
      where: {
        CarId,
      },
      order: [["id", "DESC"]],
    });

    if (history.length >= history[0].totalInstallment + 1) {
      throw {
        code: 403,
        name: "FORBIDDEN",
        message: "Car installment already finished.",
      };
    }

    let name;

    let num = history.length
      ? history[0].dataValues.orderId
          .split("-")
          .map((el, i) => {
            if (i == 3) el = +el + 1;
            return el;
          })
          .join("-")
      : 1;

    if (!history.length) {
      name = "MONTHLY_2021_" + CarId + "_" + num;
    } else {
      name = "MONTHLY_2021_" + CarId + "_" + num;
    }

    const resp = await core.getSubscription(car.subscriptionId);

    const date = format(
      new Date(add(new Date(), { days: 30 })),
      "yyyy-MM-dd hh:mm:ss"
    );

    let updateSubscriptionParam = {
      name,
      amount: resp.amount,
      currency: "IDR",
      token: resp.token,
      schedule: {
        interval: 1,
        next_execution_at: date,
      },
    };

    await core.updateSubscription(car.subscriptionId, updateSubscriptionParam);

    let orderId = history[history.length - 1].dataValues.orderId
      .split("-")
      .map((el, i) => {
        if (i == 2) el = new Date().getTime();
        if (i == 3) el = +el + 1;
        return el;
      })
      .join("-");

    await BoughtHistory.create(
      {
        carName: car.name,
        description: car.description,
        boughtDate: new Date(),
        paidOff: true,
        price: car.price,
        BuyerId: history[0].BuyerId,
        orderId,
        CarId,
        installment: true,
        currentInstallment: history[history.length - 1].currentInstallment + 1,
        totalInstallment: history[0].totalInstallment,
        saved_token_id: history[0].saved_token_id,
      },
      {
        transaction: t,
      }
    );

    await Car.update(
      {
        status: "sold",
      },
      {
        where: {
          id: car.id,
        },
        transaction: t,
      }
    );

    const buyer = await Buyer.findByPk(history[0].BuyerId);

    const payload = {
      payment_type: "credit_card",
      transaction_details: {
        order_id: orderId,
        gross_amount: +resp.amount,
      },
      credit_card: {
        secure: true,
      },
      item_details: [
        {
          id: car.id,
          price: +resp.amount,
          quantity: 1,
          name: car.name,
        },
      ],
      customer_details: {
        username: buyer.username,
        email: buyer.email,
        phone: buyer.phoneNumber,
        billing_address: {
          username: buyer.username,
          email: buyer.email,
          phone: buyer.phoneNumber,
          address: buyer.address,
        },
        shipping_address: {
          username: buyer.username,
          email: buyer.email,
          phone: buyer.phoneNumber,
          address: buyer.address,
        },
      },
      credit_card: {
        secure: true,
      },
      enabled_payments: [
        "credit_card",
        "mandiri_clickpay",
        "cimb_clicks",
        "bca_klikbca",
        "bca_klikpay",
        "bri_epay",
        "echannel",
        "mandiri_ecash",
        "bca_va",
        "bni_va",
        "other_va",
        "gopay",
        "indomaret",
        "alfamart",
        "danamon_online",
        "akulaku",
      ],
    };

    let payment = await snap.createTransaction(payload);

    res
      .status(200)
      .json({ token: payment.token, paymentUrl: payment.redirect_url });

    await t.commit();
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const statusMidtrans = async (req, res, next) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      throw {
        code: 400,
        name: "BAD_REQUEST",
        message: "Order Id is required.",
      };
    }

    const status = await apiClient.transaction.status(order_id);

    res.status(200).json(status);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  payment,
  firstInstallment,
  nextInstallment,
  status,
  updatePayment,
  statusMidtrans,
  histories,
  updatePaid,
};
