const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/db');

const Blacklist = sequelize.define(
  'Blacklist',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    token: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
  },
  {
    tableName: 'blacklists',
    timestamps: true,
    indexes: [
      { fields: ['token'], unique: true },
      { fields: ['expires_at'] },
    ],
  }
);

Blacklist.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  values._id = values.id;
  return values;
};

/** Find a non-expired blacklisted token; purge expired rows opportunistically. */
Blacklist.findActiveToken = async function findActiveToken(token) {
  await Blacklist.destroy({
    where: {
      expiresAt: { [Op.lt]: new Date() },
    },
  });

  return Blacklist.findOne({
    where: {
      token,
      expiresAt: { [Op.gt]: new Date() },
    },
  });
};

module.exports = Blacklist;
