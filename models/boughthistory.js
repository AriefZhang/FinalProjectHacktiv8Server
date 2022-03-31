"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class BoughtHistory extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      BoughtHistory.belongsTo(models.Buyer, { foreignKey: "BuyerId" });
    }
  }
  BoughtHistory.init(
    {
      carName: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: {
            msg: "Car name is required",
          },
          notEmpty: {
            msg: "Car name is required",
          },
        },
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: {
            msg: "Description is required",
          },
          notEmpty: {
            msg: "Description is required",
          },
        },
      },
      boughtDate: {
        type: DataTypes.DATE,
        allowNull: false,
        validate: {
          notNull: {
            msg: "Bought date is required",
          },
          notEmpty: {
            msg: "Bought date is required",
          },
        },
      },
      paidOff: { type: DataTypes.BOOLEAN, defaultValue: true },
      price: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          notNull: {
            msg: "Price is required",
          },
          notEmpty: {
            msg: "Price is required",
          },
        },
      },
      BuyerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          notNull: {
            msg: "Buyer id is required",
          },
          notEmpty: {
            msg: "Buyer id is required",
          },
        },
      },
      orderId: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: {
            msg: "Buyer id is required",
          },
          notEmpty: {
            msg: "Buyer id is required",
          },
        },
      },
      installment: DataTypes.BOOLEAN,
      currentInstallment: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          notNull: {
            msg: "Buyer id is required",
          },
          notEmpty: {
            msg: "Buyer id is required",
          },
        },
      },
      saved_token_id: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "none",
        validate: {
          notNull: {
            msg: "Save Token Id is required",
          },
          notEmpty: {
            msg: "Save Token Id is required",
          },
        },
      },
      CarId: DataTypes.INTEGER,
      totalInstallment: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          notNull: {
            msg: "Buyer id is required",
          },
          notEmpty: {
            msg: "Buyer id is required",
          },
        },
      },
    },
    {
      sequelize,
      modelName: "BoughtHistory",
    }
  );
  return BoughtHistory;
};
