const {
  Car,
  Image,
  Type,
  Dealer,
  Brand,
  sequelize,
  Inspection,
  Interior,
  Exterior,
  RoadTest,
  Kolong,
} = require("../models");
const transporter = require("../helpers/nodemailer");

const getCars = async (req, res, next) => {
  try {
    const { page, maxItem } = req.query;
    let perPage = 12;
    if (maxItem) {
      perPage = maxItem;
    }
    const query = {};

    if (page > 0) {
      (query.limit = perPage), (query.offset = (page - 1) * perPage);
    }

    const cars = await Car.findAndCountAll({
      ...query,
      include: [
        {
          model: Image,
        },
        {
          model: Dealer,
          attributes: ["storeAddress"],
        },
        { model: Type, include: [{ model: Brand }] },
      ],
    });
    console.log(cars.count);
    res.status(200).json(cars);
  } catch (err) {
    next(err);
  }
};

const addCar = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      name,
      description,
      fuel,
      seats,
      mileage,
      price,
      color,
      yearMade,
      TypeId,
      image,
    } = req.body;
    const dealerId = req.loginDealer.id;

    const car = await Car.create(
      {
        name,
        description,
        fuel,
        seats,
        mileage,
        price,
        color,
        yearMade,
        TypeId,
        DealerId: dealerId,
      },
      { returning: true, transaction: t, logging: false }
    );

    if (!image.length) {
      throw {
        code: 400,
        name: "BAD_REQUEST",
        message: "Image is required",
      };
    }

    let images = image
      .filter((img) => img)
      .map((el) => {
        return {
          CarId: car.id,
          image: el,
        };
      });

    const newImage = await Image.bulkCreate(images, {
      returning: true,
      transaction: t,
      logging: false,
    });

    const inspection = await Inspection.create(
      {
        CarId: car.id,
      },
      { returning: true, transaction: t, logging: false }
    );

    const interior = await Interior.create(
      {
        InspectionId: inspection.id,
      },
      { returning: true, transaction: t, logging: false }
    );

    const exterior = await Exterior.create(
      {
        InspectionId: inspection.id,
      },
      { returning: true, transaction: t, logging: false }
    );

    const roadTest = await RoadTest.create(
      {
        InspectionId: inspection.id,
      },
      { returning: true, transaction: t, logging: false }
    );

    const kolong = await Kolong.create(
      {
        InspectionId: inspection.id,
      },
      { returning: true, transaction: t, logging: false }
    );

    await t.commit();

    let mailOptions = {
      from: "jubelsinaga13@gmail.com",
      to: "jubelsinaga13@gmail.com",
      subject: "Success registration",
      text: "Car created, please schedule an inspection",
    };

    transporter.sendMail(mailOptions, function (err, data) {
      if (err) {
        console.log("Error " + err);
      } else {
        console.log("Email sent successfully");
      }
    });

    res.status(201).json({ message: "Car created" });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const getCar = async (req, res, next) => {
  try {
    const carId = req.params.id;

    const car = await Car.findByPk(carId, {
      include: [
        {
          model: Type,
          include: { model: Brand },
        },
        {
          model: Dealer,
          attributes: [
            "id",
            "name",
            "email",
            "phoneNumber",
            "storeName",
            "storeAddress",
          ],
        },
        { model: Image },
        { model: Inspection },
      ],
      logging: false,
    });

    if (!car) {
      throw {
        code: 404,
        name: "NOT_FOUND",
        message: "Car not found",
      };
    }

    res.status(200).json(car);
  } catch (err) {
    next(err);
  }
};

const deleteCar = async (req, res, next) => {
  try {
    const carId = req.params.id;

    const deleted = await Car.destroy({
      where: {
        id: carId,
      },
      logging: false,
    });

    if (!deleted) {
      throw {
        code: 404,
        name: "NOT_FOUND",
        message: "Car not found",
      };
    }

    res.status(200).json({ message: "Car Deleted succesfully" });
  } catch (err) {
    next(err);
  }
};

const editcar = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const id = req.params.id;
    const {
      name,
      description,
      fuel,
      seats,
      mileage,
      price,
      color,
      yearMade,
      TypeId,
      image,
    } = req.body;

    const foundCar = await Car.findByPk(id, { logging: false });

    if (!foundCar) {
      throw {
        code: 404,
        name: "NOT_FOUND",
        message: "Car not found",
      };
    }

    await Car.update(
      {
        name,
        description,
        fuel,
        seats,
        mileage,
        price,
        color,
        yearMade,
        TypeId,
      },
      {
        where: { id: foundCar.id },
        returning: true,
        transaction: t,
        logging: false,
      }
    );

    if (!image.length) {
      throw {
        code: 400,
        name: "BAD_REQUEST",
        message: "Image is required",
      };
    }

    if (image.length) {
      await Image.destroy({
        where: {
          CarId: foundCar.id,
        },
        transaction: t,
        logging: false,
      });

      let images = image
        .filter((img) => img)
        .map((el) => {
          return {
            CarId: foundCar.id,
            image: el,
          };
        });

      const newImage = await Image.bulkCreate(images, {
        returning: true,
        transaction: t,
        logging: false,
      });
    }

    await t.commit();

    res.status(200).json({ message: "Car updated" });
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const changeInspectionStatus = async (req, res, next) => {
  try {
    const { passedInspection } = req.body;
    const { id } = req.params;

    console.log(passedInspection);
    const foundCar = await Car.findByPk(id, { logging: false });

    if (!foundCar) {
      throw {
        code: 404,
        name: "NOT_FOUND",
        message: "Car not found",
      };
    }

    await Car.update(
      { passedInspection },
      { where: { id: foundCar.id }, logging: false }
    );

    res.status(200).json({ message: "Car inspection status updated" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  addCar,
  getCars,
  getCar,
  deleteCar,
  editcar,
  changeInspectionStatus,
};
